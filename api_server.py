from flask import Flask, jsonify, request
from flask_cors import CORS
import xarray as xr
import numpy as np
import glob
import os
import requests
import mysql.connector
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
# SALINITY API
# =========================
@app.route("/salinity")
def salinity():

    files = glob.glob("*.nc")

    if not files:
        return jsonify({
            "error": "No nc file found"
        })

    file = max(
        files,
        key=os.path.getmtime
    )

    ds = xr.open_dataset(file)

    sal = ds["so"].values

    valid = sal[~np.isnan(sal)]

    value = float(valid[-1])

    return jsonify({
        "salinity": round(value, 2),
        "file": os.path.basename(file)
    })


# =========================
# TEMPERATURE + SUNLIGHT API
# =========================
@app.route("/environment")
def environment():

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

    temperature = current.get(
        "temperature_2m",
        None
    )

    sunlight = current.get(
        "shortwave_radiation",
        None
    )

    return jsonify({
        "temperature": temperature,
        "sunlight": sunlight
    })


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
            "user": {"id": user_id, "full_name": full_name, "email": email},
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
        cursor.execute(
            "SELECT id, full_name, email, password_hash, contact_number FROM users WHERE email = %s",
            (email,),
        )
        user = cursor.fetchone()

        if not user or not check_password_hash(user["password_hash"], password):
            return jsonify({"success": False, "message": "Invalid email or password. Please try again."})

        user.pop("password_hash", None)

        return jsonify({"success": True, "user": user})

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
