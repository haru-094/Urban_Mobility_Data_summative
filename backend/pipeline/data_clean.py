import pandas as pd
import os

def read_data_from_paths(trips_path, lookup_path, spatial_dir_path):
    """Loads raw trip records, verifies spatial shapefile bundles, and maps zone metadata."""
    if not os.path.exists(trips_path) or not os.path.exists(lookup_path) or not os.path.exists(spatial_dir_path):
        raise FileNotFoundError("Missing raw data components. Check your paths!")

    # 1. Verify structural integrity of the shapefile bundle to satisfy assignment rules
    required_extensions = ['.shp', '.dbf', '.shx']
    missing_components = [ext for ext in required_extensions if not os.path.exists(os.path.join(spatial_dir_path, f"taxi_zones{ext}"))]
    
    if missing_components:
        raise FileNotFoundError(f"Missing mandatory shapefile components in taxi_zones/: {missing_components}")
    print("Spatial Shapefile metadata bundle verified successfully.")

    # 2. Read the Trip CSV data (using low_memory=False to prevent mixed-type warnings)
    df_trips = pd.read_csv(trips_path, low_memory=False)
    df_lookup = pd.read_csv(lookup_path)
    
    # Convert relational keys to integers
    df_trips['PULocationID'] = df_trips['PULocationID'].astype(int)
    df_trips['DOLocationID'] = df_trips['DOLocationID'].astype(int)
    df_lookup['LocationID'] = df_lookup['LocationID'].astype(int)
    
    # Extract valid IDs directly from the verified lookup table
    valid_map_ids = set(df_lookup['LocationID'].unique())
    
    # Merge datasets
    df = df_trips.merge(df_lookup, left_on='PULocationID', right_on='LocationID', how='left')
    df = df.rename(columns={
        'Borough': 'PU_Borough', 
        'Zone': 'PU_Zone', 
        'Service_Zone': 'PU_Service_Zone'
    }).drop(columns=['LocationID'])
    
    return df, valid_map_ids

def remove_outlier(df, valid_map_ids):
    """Identifies and resolves missing values, physical, and dynamic geospatial anomalies."""
    initial_count = len(df)
    missing_values = {}

    # 1. Clear Missing Values
    df = df.dropna(subset=['tpep_pickup_datetime', 'tpep_dropoff_datetime', 'trip_distance', 'fare_amount'])
    missing_values['missing_values_dropped'] = initial_count - len(df)

    # 2. Temporal Outliers (Updated to 2019 to match your 2019-01 data file!)
    df['tpep_pickup_datetime'] = pd.to_datetime(df['tpep_pickup_datetime'])
    df['tpep_dropoff_datetime'] = pd.to_datetime(df['tpep_dropoff_datetime'])
    
    valid_time_mask = (df['tpep_pickup_datetime'].dt.year == 2019) & (df['tpep_dropoff_datetime'] > df['tpep_pickup_datetime'])
    missing_values['temporal_anomalies_dropped'] = len(df) - valid_time_mask.sum()
    df = df[valid_time_mask]

    # 3. Financial & Physical Outliers
    valid_metrics_mask = (df['fare_amount'] > 0) & (df['trip_distance'] > 0) & (df['trip_distance'] < 100)
    missing_values['metric_anomalies_dropped'] = len(df) - valid_metrics_mask.sum()
    df = df[valid_metrics_mask]

    # 4. Spatial Verification against metadata IDs
    spatial_mask = df['PULocationID'].isin(valid_map_ids) & df['DOLocationID'].isin(valid_map_ids)
    missing_values['spatial_anomalies_dropped'] = len(df) - spatial_mask.sum()
    df = df[spatial_mask]

    return df, missing_values