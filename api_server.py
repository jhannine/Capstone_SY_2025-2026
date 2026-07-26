from flask import Flask, jsonify, request, send_file
from flask_cors import CORS
import xarray as xr
import numpy as np
import glob
import os
import io
import csv
import requests
import mysql.connector
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
CORS(app)  # allows the Expo app to call this server from another device


# =========================
# MYSQL CONNECTION SETTINGS
# =========================
DB_CONFIG = {
    "host": "localhost",
    "user": "root",
    "password": "",
    "database": "lato",
}


def get_db_connection():
    return mysql.connector.connect(**DB_CONFIG)


# =========================
# SHARED READING HELPERS
# (ginagamit ng /salinity, /environment, AT ng monitor refresh)
# =========================
def get_latest_salinity():
    files = glob.glob("*.nc")

    if not files:
        return None, None

    file = max(files, key=os.path.getmtime)
    ds = xr.open_dataset(file)
    sal = ds["so"].values
    valid = sal[~np.isnan(sal)]

    if len(valid) == 0:
        return None, os.path.basename(file)

    return round(float(valid[-1]), 2), os.path.basename(file)


def get_latest_environment():
    latitude = 13.83775
    longitude = 120.6190

    url = (
        f"https://api.open-meteo.com/v1/forecast"
        f"?latitude={latitude}"
        f"&longitude={longitude}"
        f"&current=temperature_2m,shortwave_radiation"
    )

    response = requests.get(url)
    data = response.json()
    current = data.get("current", {})

    temperature = current.get("temperature_2m", None)
    sunlight = current.get("shortwave_radiation", None)

    return temperature, sunlight


# =========================
# ALERTS - shared helpers
# =========================
PARAM_LABELS = {
    "temperature": "Water Temp",
    "salinity": "Salinity",
    "sunlight": "Sunlight",
    "ph": "pH Level",
}

# System defaults -- ginagamit lang kapag wala pang alert_settings row
# ang isang farm (halimbawa: matandang farm bago pa idagdag ang
# register() insert, o data inconsistency). Kaparehas ito ng dating
# hardcoded values sa evaluate_temperature/evaluate_salinity noon.
DEFAULT_THRESHOLDS = {
    "salinity_min": 28.0,
    "salinity_max": 36.0,
    "temperature_min": 25.0,
    "temperature_max": 30.0,
    "ph_min": 7.5,
    "ph_max": 8.5,
    "sunlight_min": 400.0,
    "sunlight_max": 800.0,
    "push_enabled": True,
    "salinity_alerts": True,
    "temperature_alerts": False,
    "ph_alerts": True,
    "sunlight_alerts": True,
}


def evaluate_temperature(value, temperature_min, temperature_max):
    return "normal" if temperature_min <= value <= temperature_max else "warning"


def evaluate_salinity(value, salinity_min, salinity_max):
    if salinity_min <= value <= salinity_max:
        return "normal"
    # warning band: konting baba sa min (salinity_min - 3) o konting
    # taas sa max (+2) -- kaparehas ng dating hardcoded na "25-28" band
    # noong nakapirmi pa sa 28 ang min.
    if (salinity_min - 3 <= value < salinity_min) or (salinity_max < value <= salinity_max + 2):
        return "warning"
    return "critical"


def evaluate_sunlight(value, sunlight_min, sunlight_max):
    return "normal" if sunlight_min <= value <= sunlight_max else "warning"


def evaluate_ph(value, ph_min, ph_max):
    return "normal" if ph_min <= value <= ph_max else "warning"


def build_alert_message(param, value, level, thresholds):
    if param == "temperature":
        return (
            f"{value:.1f}\u00b0C - outside "
            f"{thresholds['temperature_min']:g}-{thresholds['temperature_max']:g}\u00b0C safe range"
        )
    if param == "salinity":
        prefix = "critical, " if level == "critical" else ""
        return (
            f"{value:.1f} ppt - {prefix}outside "
            f"{thresholds['salinity_min']:g}-{thresholds['salinity_max']:g} ppt safe range"
        )
    if param == "sunlight":
        return (
            f"{value:.0f} W/m\u00b2 - outside "
            f"{thresholds['sunlight_min']:g}-{thresholds['sunlight_max']:g} W/m\u00b2 safe range"
        )
    if param == "ph":
        return f"{value:.2f} - outside {thresholds['ph_min']:g}-{thresholds['ph_max']:g} safe range"
    return ""


def serialize_alert(row):
    def iso(dt):
        return dt.isoformat() if dt else None

    return {
        "id": row["id"],
        "farm_id": row["farm_id"],
        "parameter": row["parameter"],
        "title": row["title"],
        "detail": row["detail"],
        "threshold_value": float(row["threshold_value"]) if row.get("threshold_value") is not None else None,
        "actual_value": float(row["actual_value"]) if row.get("actual_value") is not None else None,
        "status": row["status"],
        "created_at": iso(row.get("created_at")),
        "resolved_at": iso(row.get("resolved_at")),
        "deleted_at": iso(row.get("deleted_at")),
    }


# =========================
# ALERT SETTINGS - shared helpers
# =========================
def serialize_alert_settings(row):
    return {
        "farm_id": row["farm_id"],
        "salinity_min": float(row["salinity_min"]),
        "salinity_max": float(row["salinity_max"]),
        "temperature_min": float(row["temperature_min"]),
        "temperature_max": float(row["temperature_max"]),
        "ph_min": float(row["ph_min"]),
        "ph_max": float(row["ph_max"]),
        "sunlight_min": float(row["sunlight_min"]),
        "sunlight_max": float(row["sunlight_max"]),
        "push_enabled": bool(row["push_enabled"]),
        "salinity_alerts": bool(row["salinity_alerts"]),
        "temperature_alerts": bool(row["temperature_alerts"]),
        "ph_alerts": bool(row["ph_alerts"]),
        "sunlight_alerts": bool(row["sunlight_alerts"]),
    }


def default_alert_settings_payload(farm_id):
    payload = dict(DEFAULT_THRESHOLDS)
    payload["farm_id"] = farm_id
    return payload


def get_alert_thresholds(cursor, farm_id):
    """Kunin ang lahat ng threshold + toggle na naka-set ng user sa
    Alerts > Settings (alert_settings table) para sa farm na ito.
    Kung wala pang row (bagong farm / matandang data), gamitin ang
    DEFAULT_THRESHOLDS. Ginagamit ito ng /alerts/evaluate AT ng
    perform_monitor_refresh para iisa lang ang pinagkukunan ng
    thresholds (single source of truth == DB, hindi na galing sa
    client payload)."""
    cursor.execute(
        """SELECT salinity_min, salinity_max, temperature_min, temperature_max,
                  ph_min, ph_max, sunlight_min, sunlight_max, push_enabled,
                  salinity_alerts, temperature_alerts, ph_alerts, sunlight_alerts
           FROM alert_settings WHERE farm_id = %s""",
        (farm_id,),
    )
    row = cursor.fetchone()

    if row:
        return {
            "salinity_min": float(row["salinity_min"]),
            "salinity_max": float(row["salinity_max"]),
            "temperature_min": float(row["temperature_min"]),
            "temperature_max": float(row["temperature_max"]),
            "ph_min": float(row["ph_min"]),
            "ph_max": float(row["ph_max"]),
            "sunlight_min": float(row["sunlight_min"]),
            "sunlight_max": float(row["sunlight_max"]),
            "push_enabled": bool(row["push_enabled"]),
            "salinity_alerts": bool(row["salinity_alerts"]),
            "temperature_alerts": bool(row["temperature_alerts"]),
            "ph_alerts": bool(row["ph_alerts"]),
            "sunlight_alerts": bool(row["sunlight_alerts"]),
        }

    return dict(DEFAULT_THRESHOLDS)


# =========================
# MONITOR - shared helpers
# =========================
def serialize_monitor(row):
    def iso(dt):
        return dt.isoformat() if dt else None

    return {
        "id": row["id"],
        "farm_id": row["farm_id"],
        "node_id": row["node_id"],
        "water_temp": float(row["water_temp"]) if row.get("water_temp") is not None else None,
        "salinity": float(row["salinity"]) if row.get("salinity") is not None else None,
        # Walang pH sensor pa, kaya laging NULL ito hangga't walang
        # totoong hardware na nagpapadala ng reading.
        "ph_level": float(row["ph_level"]) if row.get("ph_level") is not None else None,
        "sunlight": float(row["sunlight"]) if row.get("sunlight") is not None else None,
        "status": row["status"],
        "last_updated": iso(row.get("last_updated")),
        "updated_at": iso(row.get("updated_at")),
    }


def perform_monitor_refresh(cursor, farm_id, node_id=None, thresholds_override=None):
    """Kumuha ng pinakabagong Open-Meteo (temperature/sunlight) at
    Copernicus/.nc (salinity) na datos, i-compute ang status base sa
    thresholds ng farm (mula sa alert_settings, o override kung meron),
    tapos i-save (upsert) sa `monitor` table gamit ang kasalukuyang
    araw/oras. Ginagamit ito ng GET /monitor (auto-refresh sa bawat
    fetch) AT ng POST /monitor/refresh (manual/cron trigger).

    ph_level ay hindi kasama sa pag-refresh na ito -- wala pang pH
    sensor, kaya iiwan na lang NULL hangga't wala pang totoong
    hardware reading na pupuno rito."""

    thresholds = get_alert_thresholds(cursor, farm_id)
    if thresholds_override:
        thresholds.update({k: v for k, v in thresholds_override.items() if v is not None})

    salinity_value, _ = get_latest_salinity()
    temperature_value, sunlight_value = get_latest_environment()

    levels = []
    if temperature_value is not None:
        levels.append(
            evaluate_temperature(temperature_value, thresholds["temperature_min"], thresholds["temperature_max"])
        )
    if salinity_value is not None:
        levels.append(
            evaluate_salinity(salinity_value, thresholds["salinity_min"], thresholds["salinity_max"])
        )
    if sunlight_value is not None:
        levels.append(
            evaluate_sunlight(sunlight_value, thresholds["sunlight_min"], thresholds["sunlight_max"])
        )

    if "critical" in levels:
        status = "critical"
    elif "warning" in levels:
        status = "warning"
    else:
        status = "safe"

    cursor.execute(
        """INSERT INTO monitor
            (farm_id, node_id, water_temp, salinity, ph_level, sunlight, status, last_updated)
           VALUES (%s, %s, %s, %s, NULL, %s, %s, NOW())
           ON DUPLICATE KEY UPDATE
             node_id = COALESCE(VALUES(node_id), node_id),
             water_temp = VALUES(water_temp),
             salinity = VALUES(salinity),
             sunlight = VALUES(sunlight),
             status = VALUES(status),
             last_updated = VALUES(last_updated)""",
        (farm_id, node_id, temperature_value, salinity_value, sunlight_value, status),
    )

    # Log din ang parehong reading sa sensor_readings (ginagamit ng History
    # screen). Galing sa Open-Meteo + satellite salinity file ang datos na
    # ito, hindi pa physical sensor -- kaya 'satellite' ang source, at NULL
    # muna ang ph_level.
    cursor.execute(
        """INSERT INTO sensor_readings
            (farm_id, node_id, water_temp, salinity, ph_level, sunlight, source, recorded_at)
           VALUES (%s, %s, %s, %s, NULL, %s, 'satellite', NOW())""",
        (farm_id, node_id, temperature_value, salinity_value, sunlight_value),
    )

    cursor.execute("SELECT * FROM monitor WHERE farm_id = %s", (farm_id,))
    return cursor.fetchone()


# =========================
# SALINITY API
# =========================
@app.route("/salinity")
def salinity():
    value, filename = get_latest_salinity()

    if filename is None:
        return jsonify({"error": "No nc file found"})

    return jsonify({
        "salinity": value,
        "file": filename
    })


# =========================
# TEMPERATURE + SUNLIGHT API
# =========================
@app.route("/environment")
def environment():
    temperature, sunlight = get_latest_environment()

    return jsonify({
        "temperature": temperature,
        "sunlight": sunlight
    })


# =========================
# GET ALERTS
# Returns all alerts (active/resolved/deleted) for a farm.
# Called from alerts.tsx on load.
# =========================
@app.route("/alerts", methods=["GET"])
def get_alerts():
    farm_id = request.args.get("farm_id", 1)

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute(
            "SELECT * FROM alerts WHERE farm_id = %s ORDER BY created_at DESC",
            (farm_id,),
        )
        alerts = cursor.fetchall()
        return jsonify({"success": True, "alerts": [serialize_alert(a) for a in alerts]})

    finally:
        cursor.close()
        conn.close()


# =========================
# EVALUATE ALERTS
# Takes latest sensor readings, kinukuha ang thresholds mula sa
# alert_settings table ng farm (hindi na sa client payload), tapos
# upserts alerts sa DB:
# - out-of-range param na naka-ON ang alerts + walang active alert pa
#   -> insert new 'active' row
# - out-of-range param na may existing active alert -> update detail/values
# - back-to-normal param na may existing active alert -> mark 'resolved'
# - param na naka-OFF ang alerts sa settings (hal. temperature_alerts=0)
#   -> laktawan, walang gagawing alert
# Called from alerts.tsx every fetch cycle.
# =========================
@app.route("/alerts/evaluate", methods=["POST"])
def evaluate_alerts():
    data = request.get_json(silent=True) or {}

    farm_id = data.get("farm_id", 1)

    readings = {
        "temperature": data.get("temperature"),
        "salinity": data.get("salinity"),
        "sunlight": data.get("sunlight"),
        "ph": data.get("ph"),  # laging None hangga't walang pH sensor -- ok lang, "skip" lang ito
    }

    alert_toggle_key = {
        "temperature": "temperature_alerts",
        "salinity": "salinity_alerts",
        "sunlight": "sunlight_alerts",
        "ph": "ph_alerts",
    }

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        thresholds = get_alert_thresholds(cursor, farm_id)

        for param, raw_value in readings.items():
            if raw_value is None:
                continue

            if not thresholds[alert_toggle_key[param]]:
                continue  # naka-off ang alerts para sa parameter na ito sa settings

            try:
                value = float(raw_value)
            except (TypeError, ValueError):
                continue

            if param == "temperature":
                level = evaluate_temperature(value, thresholds["temperature_min"], thresholds["temperature_max"])
                threshold = thresholds["temperature_max"]
            elif param == "salinity":
                level = evaluate_salinity(value, thresholds["salinity_min"], thresholds["salinity_max"])
                threshold = thresholds["salinity_max"]
            elif param == "ph":
                level = evaluate_ph(value, thresholds["ph_min"], thresholds["ph_max"])
                threshold = thresholds["ph_max"]
            else:
                level = evaluate_sunlight(value, thresholds["sunlight_min"], thresholds["sunlight_max"])
                threshold = thresholds["sunlight_max"]

            cursor.execute(
                """SELECT id FROM alerts WHERE farm_id = %s AND parameter = %s
                   AND status = 'active' ORDER BY id DESC LIMIT 1""",
                (farm_id, param),
            )
            existing = cursor.fetchone()

            if level == "normal":
                if existing:
                    cursor.execute(
                        """UPDATE alerts SET status = 'resolved', resolved_at = NOW(),
                           title = %s, detail = %s, actual_value = %s WHERE id = %s""",
                        (
                            f"{PARAM_LABELS[param]} back in range",
                            f"{value:.1f} - back in safe range",
                            value,
                            existing["id"],
                        ),
                    )
                continue

            detail = build_alert_message(param, value, level, thresholds)

            if existing:
                cursor.execute(
                    """UPDATE alerts SET detail = %s, actual_value = %s,
                       threshold_value = %s WHERE id = %s""",
                    (detail, value, threshold, existing["id"]),
                )
            else:
                cursor.execute(
                    """INSERT INTO alerts (farm_id, parameter, title, detail,
                       threshold_value, actual_value, status)
                       VALUES (%s, %s, %s, %s, %s, %s, 'active')""",
                    (farm_id, param, f"{PARAM_LABELS[param]} out of range", detail, threshold, value),
                )

        conn.commit()

        cursor.execute(
            "SELECT * FROM alerts WHERE farm_id = %s ORDER BY created_at DESC",
            (farm_id,),
        )
        alerts = cursor.fetchall()

        return jsonify({"success": True, "alerts": [serialize_alert(a) for a in alerts]})

    except mysql.connector.Error as err:
        conn.rollback()
        print("EVALUATE ALERTS ERROR:", err)
        return jsonify({"success": False, "message": "Failed to evaluate alerts."}), 500

    finally:
        cursor.close()
        conn.close()


# =========================
# RESOLVE ALERT
# Called when user taps "Resolve" on an active alert.
# =========================
@app.route("/alerts/<int:alert_id>/resolve", methods=["POST"])
def resolve_alert(alert_id):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute(
            "UPDATE alerts SET status = 'resolved', resolved_at = NOW() WHERE id = %s",
            (alert_id,),
        )
        conn.commit()

        cursor.execute("SELECT * FROM alerts WHERE id = %s", (alert_id,))
        alert = cursor.fetchone()

        if not alert:
            return jsonify({"success": False, "message": "Alert not found."}), 404

        return jsonify({"success": True, "alert": serialize_alert(alert)})

    except mysql.connector.Error as err:
        conn.rollback()
        print("RESOLVE ALERT ERROR:", err)
        return jsonify({"success": False, "message": "Failed to resolve alert."}), 500

    finally:
        cursor.close()
        conn.close()


# =========================
# DELETE ALERT
# Soft-delete: called when user taps "Delete" on an alert.
# =========================
@app.route("/alerts/<int:alert_id>/delete", methods=["POST"])
def delete_alert(alert_id):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute(
            "UPDATE alerts SET status = 'deleted', deleted_at = NOW() WHERE id = %s",
            (alert_id,),
        )
        conn.commit()

        cursor.execute("SELECT * FROM alerts WHERE id = %s", (alert_id,))
        alert = cursor.fetchone()

        if not alert:
            return jsonify({"success": False, "message": "Alert not found."}), 404

        return jsonify({"success": True, "alert": serialize_alert(alert)})

    except mysql.connector.Error as err:
        conn.rollback()
        print("DELETE ALERT ERROR:", err)
        return jsonify({"success": False, "message": "Failed to delete alert."}), 500

    finally:
        cursor.close()
        conn.close()


# =========================
# GET ALERT SETTINGS
# Returns the alert_settings row (thresholds + toggles) ng isang farm.
# Called from alerts.tsx pagbukas ng Settings modal / paglo-load ng
# screen, para populated agad ang mga slider ng dating naka-save na
# values ng user (hindi na laging nagre-reset sa default).
# =========================
@app.route("/alert_settings", methods=["GET"])
def get_alert_settings_route():
    farm_id = request.args.get("farm_id", 1)

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute("SELECT * FROM alert_settings WHERE farm_id = %s", (farm_id,))
        row = cursor.fetchone()

        if not row:
            return jsonify({"success": True, "settings": default_alert_settings_payload(int(farm_id))})

        return jsonify({"success": True, "settings": serialize_alert_settings(row)})

    finally:
        cursor.close()
        conn.close()


# =========================
# SAVE ALERT SETTINGS
# Upserts ang thresholds + toggles ng isang farm (alert_settings
# table). Ito ang tinatawag ng "Save Settings" button sa alerts.tsx
# -- dati wala nitong ginagawa kundi mag-fake delay, ngayon talagang
# nase-save na sa DB.
# =========================
@app.route("/alert_settings", methods=["POST"])
def save_alert_settings():
    data = request.get_json(silent=True) or {}

    farm_id = data.get("farm_id")
    if not farm_id:
        return jsonify({"success": False, "message": "Missing farm id."}), 400

    try:
        salinity_min = float(data.get("salinity_min", DEFAULT_THRESHOLDS["salinity_min"]))
        salinity_max = float(data.get("salinity_max", DEFAULT_THRESHOLDS["salinity_max"]))
        temperature_min = float(data.get("temperature_min", DEFAULT_THRESHOLDS["temperature_min"]))
        temperature_max = float(data.get("temperature_max", DEFAULT_THRESHOLDS["temperature_max"]))
        ph_min = float(data.get("ph_min", DEFAULT_THRESHOLDS["ph_min"]))
        ph_max = float(data.get("ph_max", DEFAULT_THRESHOLDS["ph_max"]))
        sunlight_min = float(data.get("sunlight_min", DEFAULT_THRESHOLDS["sunlight_min"]))
        sunlight_max = float(data.get("sunlight_max", DEFAULT_THRESHOLDS["sunlight_max"]))
    except (TypeError, ValueError):
        return jsonify({"success": False, "message": "Invalid threshold values."}), 400

    if salinity_min >= salinity_max:
        return jsonify({"success": False, "message": "Salinity min must be less than salinity max."}), 400
    if temperature_min >= temperature_max:
        return jsonify({"success": False, "message": "Temperature min must be less than temperature max."}), 400
    if ph_min >= ph_max:
        return jsonify({"success": False, "message": "pH min must be less than pH max."}), 400
    if sunlight_min >= sunlight_max:
        return jsonify({"success": False, "message": "Sunlight min must be less than sunlight max."}), 400

    push_enabled = 1 if data.get("push_enabled", True) else 0
    salinity_alerts = 1 if data.get("salinity_alerts", True) else 0
    temperature_alerts = 1 if data.get("temperature_alerts", True) else 0
    ph_alerts = 1 if data.get("ph_alerts", True) else 0
    sunlight_alerts = 1 if data.get("sunlight_alerts", True) else 0

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute(
            """INSERT INTO alert_settings
                (farm_id, salinity_min, salinity_max, temperature_min, temperature_max,
                 ph_min, ph_max, sunlight_min, sunlight_max, push_enabled,
                 salinity_alerts, temperature_alerts, ph_alerts, sunlight_alerts)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
               ON DUPLICATE KEY UPDATE
                 salinity_min = VALUES(salinity_min),
                 salinity_max = VALUES(salinity_max),
                 temperature_min = VALUES(temperature_min),
                 temperature_max = VALUES(temperature_max),
                 ph_min = VALUES(ph_min),
                 ph_max = VALUES(ph_max),
                 sunlight_min = VALUES(sunlight_min),
                 sunlight_max = VALUES(sunlight_max),
                 push_enabled = VALUES(push_enabled),
                 salinity_alerts = VALUES(salinity_alerts),
                 temperature_alerts = VALUES(temperature_alerts),
                 ph_alerts = VALUES(ph_alerts),
                 sunlight_alerts = VALUES(sunlight_alerts)""",
            (
                farm_id, salinity_min, salinity_max, temperature_min, temperature_max,
                ph_min, ph_max, sunlight_min, sunlight_max, push_enabled,
                salinity_alerts, temperature_alerts, ph_alerts, sunlight_alerts,
            ),
        )
        conn.commit()

        cursor.execute("SELECT * FROM alert_settings WHERE farm_id = %s", (farm_id,))
        row = cursor.fetchone()

        return jsonify({"success": True, "settings": serialize_alert_settings(row)})

    except mysql.connector.Error as err:
        conn.rollback()
        print("SAVE ALERT SETTINGS ERROR:", err)
        return jsonify({"success": False, "message": "Failed to save alert settings."}), 500

    finally:
        cursor.close()
        conn.close()


# =========================
# REFRESH MONITOR (manual/cron trigger)
# Same logic na ginagamit ng GET /monitor sa ibaba, pero pwede itong
# tawagin nang hiwalay (halimbawa mula sa isang scheduler/cron job)
# kahit walang bumubukas na app, para laging updated ang monitor table.
# =========================
@app.route("/monitor/refresh", methods=["POST"])
def refresh_monitor():
    data = request.get_json(silent=True) or {}

    farm_id = data.get("farm_id", 1)
    node_id = data.get("node_id")  # optional, None kung wala pang dedicated node

    override_keys = [
        "salinity_min", "salinity_max", "temperature_min", "temperature_max",
        "ph_min", "ph_max", "sunlight_min", "sunlight_max",
    ]
    thresholds_override = {}
    for key in override_keys:
        raw = data.get(key)
        if raw is None:
            continue
        try:
            thresholds_override[key] = float(raw)
        except (TypeError, ValueError):
            continue

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        monitor_row = perform_monitor_refresh(cursor, farm_id, node_id, thresholds_override or None)
        conn.commit()

        return jsonify({"success": True, "monitor": serialize_monitor(monitor_row)})

    except mysql.connector.Error as err:
        conn.rollback()
        print("MONITOR REFRESH ERROR:", err)
        return jsonify({"success": False, "message": "Failed to refresh monitor data."}), 500

    finally:
        cursor.close()
        conn.close()


# =========================
# GET MONITOR
# Bago ibalik ang snapshot, kinukuha muna nito ang pinakabagong
# Open-Meteo + Copernicus (.nc) na reading at sina-save agad sa
# `monitor` table (kasama ang araw/oras sa `last_updated`) -- kaya
# hindi na kailangan tumawag pa ng /monitor/refresh nang hiwalay
# mula sa monitor.tsx (halimbawa sa pull-to-refresh).
#
# ITO ANG ENDPOINT NA DAPAT TAWAGIN NG monitor.tsx PARA TALAGANG
# MAKA-INSERT SA `monitor` AT `sensor_readings` TABLES.
# =========================
@app.route("/monitor", methods=["GET"])
def get_monitor():
    farm_id = request.args.get("farm_id", 1)

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        monitor_row = perform_monitor_refresh(cursor, farm_id)
        conn.commit()

        return jsonify({"success": True, "monitor": serialize_monitor(monitor_row)})

    except mysql.connector.Error as err:
        conn.rollback()
        print("GET MONITOR ERROR:", err)
        return jsonify({"success": False, "message": "Failed to load monitor data."}), 500

    finally:
        cursor.close()
        conn.close()


# =========================
# GET HISTORY (para sa Analytics/History screen -- graph + summary)
# Kumukuha ng per-DAY AVERAGE (AVG) ng bawat parameter mula sa
# `sensor_readings`, para sa huling `days` na araw (7 o 30), kasama
# ang totoong petsa (`date`) ng bawat punto -- ito ang ipapakita kapag
# tinap/na-hover ang dot sa graph. Ang mga araw na walang datos ay
# ibinabalik pa rin (value = null) para hindi maputol ang x-axis.
#
# Ang "summary" naman ay average ng LAHAT ng available na araw sa
# loob ng window (huling 7 o 30 araw mula NGAYON) -- kaya kahit
# bukas pa lang malengkompleto ang 7 araw, tuloy-tuloy itong
# nagre-recompute (rolling window, hindi naka-fix sa isang partikular
# na Linggo).
# =========================
@app.route("/history", methods=["GET"])
def get_history():
    farm_id = request.args.get("farm_id", 1)

    try:
        days = int(request.args.get("days", 7))
    except (TypeError, ValueError):
        days = 7

    days = max(1, min(days, 90))  # simpleng safety cap

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        start_dt = datetime.now() - timedelta(days=days - 1)

        cursor.execute(
            """SELECT DATE(recorded_at) AS day,
                      AVG(water_temp) AS avg_temp,
                      AVG(salinity) AS avg_salinity,
                      AVG(ph_level) AS avg_ph,
                      AVG(sunlight) AS avg_sunlight
               FROM sensor_readings
               WHERE farm_id = %s
                 AND recorded_at >= %s
               GROUP BY DATE(recorded_at)
               ORDER BY day ASC""",
            (farm_id, start_dt.strftime("%Y-%m-%d 00:00:00")),
        )
        rows_by_day = {r["day"]: r for r in cursor.fetchall()}

        result = []
        for i in range(days):
            day = (datetime.now() - timedelta(days=days - 1 - i)).date()
            r = rows_by_day.get(day)

            result.append({
                "date": day.isoformat(),        # e.g. "2026-07-26" -- para sa tap/hover na petsa
                "label": day.strftime("%a"),     # e.g. "Sun"
                "temperature": round(float(r["avg_temp"]), 2) if r and r["avg_temp"] is not None else None,
                "salinity": round(float(r["avg_salinity"]), 2) if r and r["avg_salinity"] is not None else None,
                "ph": round(float(r["avg_ph"]), 2) if r and r["avg_ph"] is not None else None,
                "sunlight": round(float(r["avg_sunlight"]), 2) if r and r["avg_sunlight"] is not None else None,
            })

        def avg_of(key):
            vals = [d[key] for d in result if d[key] is not None]
            return round(sum(vals) / len(vals), 1) if vals else None

        summary = {
            "avg_temp": avg_of("temperature"),
            "avg_salinity": avg_of("salinity"),
            "avg_ph": avg_of("ph"),
            "avg_sunlight": avg_of("sunlight"),
        }

        return jsonify({"success": True, "days": result, "summary": summary})

    finally:
        cursor.close()
        conn.close()


# =========================
# GET RAW SENSOR LOGS (Sensor Log Records table sa History screen)
# Filtered by ONE selected date (default: today), may pagination
# via limit/offset para sa "Load more records" button sa history.tsx.
# =========================
@app.route("/history/logs", methods=["GET"])
def get_history_logs():
    farm_id = request.args.get("farm_id", 1)
    date_str = request.args.get("date")  # "YYYY-MM-DD", default today

    try:
        limit = int(request.args.get("limit", 10))
        offset = int(request.args.get("offset", 0))
    except (TypeError, ValueError):
        limit, offset = 10, 0
    limit = max(1, min(limit, 100))
    offset = max(0, offset)

    try:
        target_date = (
            datetime.strptime(date_str, "%Y-%m-%d").date()
            if date_str else datetime.now().date()
        )
    except ValueError:
        return jsonify({"success": False, "message": "Invalid date."}), 400

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        day_start = f"{target_date} 00:00:00"
        day_end = f"{target_date} 23:59:59"

        cursor.execute(
            """SELECT COUNT(*) AS total FROM sensor_readings
               WHERE farm_id = %s AND recorded_at BETWEEN %s AND %s""",
            (farm_id, day_start, day_end),
        )
        total = cursor.fetchone()["total"]

        cursor.execute(
            """SELECT id, water_temp, salinity, ph_level, sunlight, source, recorded_at
               FROM sensor_readings
               WHERE farm_id = %s AND recorded_at BETWEEN %s AND %s
               ORDER BY recorded_at DESC
               LIMIT %s OFFSET %s""",
            (farm_id, day_start, day_end, limit, offset),
        )
        rows = cursor.fetchall()

        thresholds = get_alert_thresholds(cursor, farm_id)
        logs = []
        for r in rows:
            levels = []
            if r["water_temp"] is not None:
                levels.append(evaluate_temperature(float(r["water_temp"]), thresholds["temperature_min"], thresholds["temperature_max"]))
            if r["salinity"] is not None:
                levels.append(evaluate_salinity(float(r["salinity"]), thresholds["salinity_min"], thresholds["salinity_max"]))
            if r["sunlight"] is not None:
                levels.append(evaluate_sunlight(float(r["sunlight"]), thresholds["sunlight_min"], thresholds["sunlight_max"]))
            status = "critical" if "critical" in levels else "warning" if "warning" in levels else "normal"

            logs.append({
                "id": r["id"],
                "time": r["recorded_at"].strftime("%I:%M %p").lstrip("0"),
                "recorded_at": r["recorded_at"].isoformat(),
                "water_temp": float(r["water_temp"]) if r["water_temp"] is not None else None,
                "salinity": float(r["salinity"]) if r["salinity"] is not None else None,
                "ph_level": float(r["ph_level"]) if r["ph_level"] is not None else None,
                "sunlight": float(r["sunlight"]) if r["sunlight"] is not None else None,
                "status": status,
            })

        return jsonify({
            "success": True,
            "date": target_date.isoformat(),
            "logs": logs,
            "total": total,
            "has_more": offset + len(logs) < total,
        })

    finally:
        cursor.close()
        conn.close()


# =========================
# EXPORT HISTORY (CSV/PDF) -- Export Data card sa History screen
# Kinukuha ang lahat ng RAW readings (hindi na-average) sa pinili ng
# user na date range (`from`-`to`), ginagawang CSV o PDF file, tapos
# bago i-send yung file pabalik sa app, nagsesave muna ng record sa
# `export_logs` table (sino nag-export, anong farm, anong format,
# ilang araw ang saklaw). Ito ang tinatawag ng "Download All Report"
# button sa history.tsx.
# =========================
@app.route("/history/export", methods=["GET"])
def export_history():
    farm_id = request.args.get("farm_id", 1)
    user_id = request.args.get("user_id")
    date_from = request.args.get("from")   # "YYYY-MM-DD"
    date_to = request.args.get("to")       # "YYYY-MM-DD"
    export_format = request.args.get("format", "csv").lower()

    if not user_id:
        return jsonify({"success": False, "message": "Missing user id."}), 400

    if export_format not in ("csv", "pdf"):
        return jsonify({"success": False, "message": "Invalid export format."}), 400

    try:
        d_from = datetime.strptime(date_from, "%Y-%m-%d").date()
        d_to = datetime.strptime(date_to, "%Y-%m-%d").date()
    except (TypeError, ValueError):
        return jsonify({"success": False, "message": "Invalid date range."}), 400

    if d_from > d_to:
        return jsonify({"success": False, "message": "'From' date must be before 'to' date."}), 400

    range_days = (d_to - d_from).days + 1

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute(
            """SELECT recorded_at, water_temp, salinity, ph_level, sunlight, source
               FROM sensor_readings
               WHERE farm_id = %s
                 AND recorded_at BETWEEN %s AND %s
               ORDER BY recorded_at ASC""",
            (farm_id, f"{date_from} 00:00:00", f"{date_to} 23:59:59"),
        )
        rows = cursor.fetchall()

        filename = f"lato_report_{date_from}_to_{date_to}.{export_format}"

        if export_format == "csv":
            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(["Recorded At", "Water Temp (C)", "Salinity (ppt)", "pH", "Sunlight (W/m2)", "Source"])
            for r in rows:
                writer.writerow([
                    r["recorded_at"],
                    r["water_temp"],
                    r["salinity"],
                    r["ph_level"],
                    r["sunlight"],
                    r["source"],
                ])
            file_bytes = output.getvalue().encode("utf-8")
            mimetype = "text/csv"

        else:
            # PDF export -- kailangan: pip install reportlab
            from reportlab.lib.pagesizes import letter
            from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
            from reportlab.lib import colors
            from reportlab.lib.styles import getSampleStyleSheet

            buf = io.BytesIO()
            doc = SimpleDocTemplate(buf, pagesize=letter)
            styles = getSampleStyleSheet()

            elements = [
                Paragraph("Lato Farm Monitor - Sensor Report", styles["Title"]),
                Paragraph(f"Range: {date_from} to {date_to}", styles["Normal"]),
                Spacer(1, 12),
            ]

            data = [["Recorded At", "Temp (C)", "Salinity (ppt)", "pH", "Sunlight (W/m2)", "Source"]]
            for r in rows:
                data.append([
                    str(r["recorded_at"]),
                    r["water_temp"] if r["water_temp"] is not None else "-",
                    r["salinity"] if r["salinity"] is not None else "-",
                    r["ph_level"] if r["ph_level"] is not None else "-",
                    r["sunlight"] if r["sunlight"] is not None else "-",
                    r["source"],
                ])

            table = Table(data, repeatRows=1)
            table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2e8b57")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f4f8f5")]),
            ]))
            elements.append(table)
            doc.build(elements)

            file_bytes = buf.getvalue()
            mimetype = "application/pdf"

        # I-log ang export request sa export_logs -- ginagawa lang ito
        # KAPAG matagumpay na na-build ang file, para walang orphaned
        # log kung sakaling mag-fail ang query sa sensor_readings.
        cursor.execute(
            """INSERT INTO export_logs (user_id, farm_id, export_type, range_days, file_path)
               VALUES (%s, %s, %s, %s, %s)""",
            (user_id, farm_id, export_format, range_days, filename),
        )
        conn.commit()

        mem = io.BytesIO(file_bytes)
        return send_file(
            mem,
            mimetype=mimetype,
            as_attachment=True,
            download_name=filename,
        )

    except mysql.connector.Error as err:
        conn.rollback()
        print("EXPORT HISTORY ERROR:", err)
        return jsonify({"success": False, "message": "Failed to export report."}), 500

    finally:
        cursor.close()
        conn.close()


# =========================
# GET EXPORT LOGS (optional -- kung gusto mong ipakita sa app ang
# history ng mga na-download na report, hal. sa isang "Recent Exports"
# list sa ilalim ng Export Data card)
# =========================
@app.route("/export_logs", methods=["GET"])
def get_export_logs():
    farm_id = request.args.get("farm_id", 1)

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute(
            """SELECT id, user_id, farm_id, export_type, range_days, file_path, created_at
               FROM export_logs WHERE farm_id = %s ORDER BY created_at DESC LIMIT 20""",
            (farm_id,),
        )
        logs = cursor.fetchall()

        for log in logs:
            log["created_at"] = log["created_at"].isoformat() if log.get("created_at") else None

        return jsonify({"success": True, "logs": logs})

    finally:
        cursor.close()
        conn.close()


# =========================
# REGISTER API
# Creates a user + a default farm + default alert settings
# Called from create_account.tsx
# =========================
@app.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}

    full_name = (data.get("full_name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not full_name or not email or not password:
        return jsonify({"success": False, "message": "Please fill in all required fields."})

    if "@" not in email or "." not in email.split("@")[-1]:
        return jsonify({"success": False, "message": "Please enter a valid email address."})

    if len(password) < 6:
        return jsonify({"success": False, "message": "Password must be at least 6 characters."})

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute("SELECT id FROM users WHERE email = %s", (email,))
        if cursor.fetchone():
            return jsonify({"success": False, "message": "Email is already registered."})

        password_hash = generate_password_hash(password)

        cursor.execute(
            "INSERT INTO users (full_name, email, password_hash) VALUES (%s, %s, %s)",
            (full_name, email, password_hash),
        )
        user_id = cursor.lastrowid

        cursor.execute(
            """INSERT INTO farms (user_id, farm_name, barangay, municipality, province, latitude, longitude)
               VALUES (%s, 'Lato Farm', 'Brgy. Uno', 'Calatagan', 'Batangas', 13.837750, 120.619000)""",
            (user_id,),
        )
        farm_id = cursor.lastrowid

        cursor.execute("INSERT INTO alert_settings (farm_id) VALUES (%s)", (farm_id,))

        conn.commit()

        return jsonify({
            "success": True,
            "user": {"id": user_id, "full_name": full_name, "email": email, "farm_id": farm_id},
        })

    except mysql.connector.Error as err:
        conn.rollback()
        print("REGISTER ERROR:", err)
        return jsonify({"success": False, "message": "Registration failed. Please try again."}), 500

    finally:
        cursor.close()
        conn.close()


# =========================
# LOGIN API
# Verifies email/password
# Called from login.tsx
# =========================
@app.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}

    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"success": False, "message": "Please fill in all required fields."})

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        # LEFT JOIN farms para maisama ang farm_id ng user sa response --
        # ito ang gagamitin ng app sa halip na hardcoded farm_id=1, para
        # bawat user ay makita lang ang datos ng sarili niyang farm.
        cursor.execute(
            """SELECT u.id, u.full_name, u.email, u.password_hash, u.contact_number,
                      f.id AS farm_id
               FROM users u
               LEFT JOIN farms f ON f.user_id = u.id
               WHERE u.email = %s""",
            (email,),
        )
        user = cursor.fetchone()

        if not user or not check_password_hash(user["password_hash"], password):
            return jsonify({"success": False, "message": "Invalid email or password. Please try again."})

        user.pop("password_hash", None)

        return jsonify({"success": True, "user": user})

    finally:
        cursor.close()
        conn.close()


# =========================
# UPDATE PROFILE API
# Updates full_name, email, contact_number
# Called from profile.tsx
# =========================
@app.route("/update_profile", methods=["POST"])
def update_profile():
    data = request.get_json(silent=True) or {}

    user_id = data.get("id")
    full_name = (data.get("full_name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    contact_number = (data.get("contact_number") or "").strip() or None

    if not user_id:
        return jsonify({"success": False, "message": "Missing user id."})

    if not full_name or not email:
        return jsonify({"success": False, "message": "Please fill in all required fields."})

    if "@" not in email or "." not in email.split("@")[-1]:
        return jsonify({"success": False, "message": "Please enter a valid email address."})

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute("SELECT id FROM users WHERE id = %s", (user_id,))
        if not cursor.fetchone():
            return jsonify({"success": False, "message": "User not found."})

        cursor.execute(
            "SELECT id FROM users WHERE email = %s AND id != %s",
            (email, user_id),
        )
        if cursor.fetchone():
            return jsonify({"success": False, "message": "That email is already used by another account."})

        cursor.execute(
            "UPDATE users SET full_name = %s, email = %s, contact_number = %s WHERE id = %s",
            (full_name, email, contact_number, user_id),
        )
        conn.commit()

        cursor.execute(
            "SELECT id, full_name, email, contact_number FROM users WHERE id = %s",
            (user_id,),
        )
        updated_user = cursor.fetchone()

        return jsonify({
            "success": True,
            "message": "Profile updated successfully.",
            "user": updated_user,
        })

    except mysql.connector.Error as err:
        conn.rollback()
        print("UPDATE PROFILE ERROR:", err)
        return jsonify({"success": False, "message": "Failed to update profile. Please try again."}), 500

    finally:
        cursor.close()
        conn.close()


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=5000,
        debug=True
    )
