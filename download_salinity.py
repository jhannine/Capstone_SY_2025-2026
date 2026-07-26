
import copernicusmarine
import os
from datetime import datetime, timedelta, timezone

# ============================================================
# I-TUNE ITO BASE SA LOKASYON NG FARM (Brgy. Uno, Calatagan)
# ============================================================
DATASET_ID = "cmems_mod_glo_phy_anfc_0.083deg_PT1H-m"  # global physics analysis-forecast (may kasamang "so" = salinity)
LATITUDE = 13.83775
LONGITUDE = 120.61900
BUFFER = 0.05  # padding papaligid ng coordinates (degrees) -- maliit na bounding box lang

# Parehong folder ng server.py, dahil doon din tumitingin ang glob.glob("*.nc")
OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))

# Ilang pinaka-bagong .nc file lang ang panatilihin (para hindi mapuno ang disk)
KEEP_LATEST_N = 5


def download_latest_salinity():
    now = datetime.now(timezone.utc)
    start = now - timedelta(hours=6)
    end = now

    filename = f"salinity_{now.strftime('%Y%m%d_%H%M%S')}.nc"

    print(f"Kinukuha ang bagong salinity data ({start.isoformat()} hanggang {end.isoformat()})...")

    copernicusmarine.subset(
        dataset_id=DATASET_ID,
        variables=["so"],
        minimum_longitude=LONGITUDE - BUFFER,
        maximum_longitude=LONGITUDE + BUFFER,
        minimum_latitude=LATITUDE - BUFFER,
        maximum_latitude=LATITUDE + BUFFER,
        start_datetime=start.isoformat(),
        end_datetime=end.isoformat(),
        output_directory=OUTPUT_DIR,
        output_filename=filename,
    )

    print(f"Na-download: {os.path.join(OUTPUT_DIR, filename)}")

    _cleanup_old_files()


def _cleanup_old_files():

    nc_files = sorted(
        [f for f in os.listdir(OUTPUT_DIR) if f.endswith(".nc")],
        key=lambda f: os.path.getmtime(os.path.join(OUTPUT_DIR, f)),
        reverse=True,
    )

    for old_file in nc_files[KEEP_LATEST_N:]:
        path = os.path.join(OUTPUT_DIR, old_file)
        try:
            os.remove(path)
            print(f"Binura ang lumang file: {old_file}")
        except OSError as e:
            print(f"Hindi mabura ang {old_file}: {e}")


if __name__ == "__main__":
    download_latest_salinity()

