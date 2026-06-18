import sqlite3
import pandas as pd
from pathlib import Path

# init the directory path
base_dir = Path(__file__).resolve().parent.parent
db_path = base_dir / "final_data/urban_mobility.db"
schema_path = base_dir / "database/schema.sql"
parquet_path = base_dir / "final_data/cleaned_trips.parquet"
lookup_path = base_dir / "raw_data/taxi_zone_lookup.csv"

def inserting_data_into_db():
    print("Initializing Database Layout...")
    db_path.parent.mkdir(parents=True, exist_ok=True)
    
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    cursor.execute("PRAGMA synchronous = OFF;")
    cursor.execute("PRAGMA journal_mode = MEMORY;")
    cursor.execute("PRAGMA foreign_keys = OFF;")
    
    with open(schema_path, "r") as f:
        cursor.executescript(f.read())
    print("Database tables and B-Tree indexes created.")

    print("Loading zone dimensions...")
    df_lookup = pd.read_csv(lookup_path)
    df_lookup.columns = ['location_id', 'borough', 'zone', 'service_zone']
    df_lookup = df_lookup.fillna("Unknown").apply(lambda x: x.astype(str).str.strip() if x.name != 'location_id' else x)
    
    df_lookup.to_sql("dim_zones", conn, if_exists="append", index=False)
    print(f"Successfully added {len(df_lookup)} records to dim_zones.")

    if not parquet_path.exists():
        print(f"Error: Cache missing at {parquet_path}. Run your pipeline script first!")
        return

    print("Streaming trip records into fact_trips...")
    df_trips = pd.read_parquet(parquet_path)
    
    df_trips = df_trips.rename(columns={
        'VendorID': 'vendor_id',
        'PULocationID': 'pu_location_id',
        'DOLocationID': 'do_location_id',
        'tpep_pickup_datetime': 'pickup_datetime',
        'tpep_dropoff_datetime': 'dropoff_datetime'
    })
    
    df_trips['pickup_datetime'] = df_trips['pickup_datetime'].astype(str)
    df_trips['dropoff_datetime'] = df_trips['dropoff_datetime'].astype(str)
    df_trips['is_rush_hour'] = df_trips['is_rush_hour'].astype(int)

    cursor.execute("BEGIN TRANSACTION;")
    df_trips.to_sql("fact_trips", conn, if_exists="append", index=False, chunksize=100000)
    conn.commit()
    
    cursor.execute("PRAGMA foreign_keys = ON;")
    conn.close()
    
    print(f"Success! Relational database completely seeded at:\n{db_path}\n")

if __name__ == "__main__":
    inserting_data_into_db()