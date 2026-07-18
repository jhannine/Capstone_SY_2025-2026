import xarray as xr
import glob

file = glob.glob("*.nc")[0]

ds = xr.open_dataset(file)

print(ds)
print(ds.variables)

for var in ds.data_vars:
    print(var)
    print(ds[var].values)