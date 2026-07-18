from flask import Flask, jsonify
import xarray as xr
import numpy as np
import glob

app = Flask(__name__)

@app.route("/salinity")
def salinity():

    file = glob.glob("*.nc")[0]

    ds = xr.open_dataset(file)

    sal = ds["so"].values

    valid = sal[~np.isnan(sal)]

    value = float(valid[-1])

    return jsonify({
        "salinity": round(value, 2)
    })

if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=5000,
        debug=True
    )