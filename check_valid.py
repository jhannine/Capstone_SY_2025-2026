import xarray as xr
import numpy as np
import glob

file = glob.glob("*.nc")[0]

ds = xr.open_dataset(file)

sal = ds["so"]

valid = np.where(~np.isnan(sal.values))

print("Valid indexes:", valid)

if len(valid[0]) > 0:

    t = valid[0][0]
    d = valid[1][0]
    lat = valid[2][0]
    lon = valid[3][0]

    print("SALINITY:",
          sal.values[t,d,lat,lon])

    print("LATITUDE:",
          ds.latitude.values[lat])

    print("LONGITUDE:",
          ds.longitude.values[lon])