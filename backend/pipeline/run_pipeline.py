import os
import sys
import json
from pathlib import Path

# fixing the pipeline error when running from the terminal
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pipeline.data_clean import read_data_from_paths, remove_outlier
from pipeline.feature_eng import selecting_features, find_top_k_destinations
from pipeline.normalize import data_normalize

def _save_parquet(df, path: Path):
    """Save dataframe to parquet, overwriting if it already exists."""
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        print(f"Overwriting existing file: {path.name}")
    else:
        print(f"Creating new file: {path.name}")
    df.to_parquet(str(path), index=False)

def main():
    project_root_path = Path(__file__).resolve().parent.parent.parent
    raw_trips_data     = project_root_path / "backend/raw_data/yellow_tripdata_2019-01.csv"
    raw_lookup_data    = project_root_path / "backend/raw_data/taxi_zone_lookup.csv"
    raw_spatial_dir    = project_root_path / "backend/raw_data/taxi_zones"
    new_data_output    = project_root_path / "backend/final_data/cleaned_trips.parquet"

    print("Launching Full Modular Data Processing Pipeline...")
    print(f"Trips   : {raw_trips_data}")
    print(f"Lookup  : {raw_lookup_data}")
    print(f"Spatial : {raw_spatial_dir}\n")

    df_raw, valid_map_ids = read_data_from_paths(str(raw_trips_data), str(raw_lookup_data), str(raw_spatial_dir))
    initial_count = len(df_raw)

    df_clean, cleaning_logs = remove_outlier(df_raw, valid_map_ids)
    df_features, feature_logs = selecting_features(df_clean)
    
    top_destinations = find_top_k_destinations(df_features, k=5)
    df_final = data_normalize(df_features)

    print("\nWriting output file...")
    _save_parquet(df_final, new_data_output)

    transparency_report = {
        "total_records_ingested": int(initial_count),
        "anomalies_detected": {
            "missing_values_scrubbed": int(cleaning_logs.get('missing_values_dropped', 0)),
            "temporal_violations":     int(cleaning_logs.get('temporal_anomalies_dropped', 0)),
            "fare_or_distance_outliers": int(cleaning_logs.get('metric_anomalies_dropped', 0)),
            "spatial_border_anomalies": int(cleaning_logs.get('spatial_anomalies_dropped', 0)),
            "unrealistic_speed_glitches": int(feature_logs.get('speed_glitches_dropped', 0))
        },
        "final_clean_records_retained": int(len(df_final)),
        "data_retention_percentage": round((len(df_final) / initial_count) * 100, 2),
        "top_k_destinations": [
            {"location_id": int(zone_id), "dropoff_count": int(count)}
            for zone_id, count in top_destinations
        ]
    }

    # Save the transparency report (includes top-k) to disk for the API to serve
    log_output = project_root_path / "backend/final_data/anomaly_transparency_log.json"
    log_output.parent.mkdir(parents=True, exist_ok=True)
    with open(str(log_output), "w") as f:
        json.dump(transparency_report, f, indent=2)
    print(f"Transparency log saved to: {log_output}")

    print("\n" + "="*45)
    print("TRANSPARENCY REPORT (FOR YOUR PDF REPORT SECTION 1)")
    print("="*45)
    print(json.dumps(transparency_report, indent=2))
    print("="*45)
    
    print("\n" + "="*45)
    print("CUSTOM ALGORITHM OUTPUT: TOP 5 DROP-OFF ZONE FREQUENCIES")
    print("="*45)
    for rank, (zone_id, count) in enumerate(top_destinations, 1):
        print(f"Rank {rank}: Location ID {zone_id} | Total Drop-offs: {count}")
    print("="*45)
    
    print(f"\nSuccess! Data safely prepared for database seeding at:\n{new_data_output}\n")

if __name__ == "__main__":
    main()