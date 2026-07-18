import copernicusmarine

copernicusmarine.subset(
    dataset_id="cmems_mod_glo_phy-so_anfc_0.083deg_P1D-m",
    variables=["so"],

    minimum_longitude=120.55,
    maximum_longitude=120.68,

    minimum_latitude=13.78,
    maximum_latitude=13.90,

    output_directory="."
)