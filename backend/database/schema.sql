DROP TABLE IF EXISTS fact_trips;
DROP TABLE IF EXISTS dim_zones;

CREATE TABLE dim_zones (
    location_id INTEGER PRIMARY KEY,
    borough TEXT NOT NULL,
    zone TEXT NOT NULL,
    service_zone TEXT NOT NULL
);

CREATE TABLE fact_trips (
    trip_id INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor_id INTEGER,
    pickup_datetime TEXT NOT NULL,
    dropoff_datetime TEXT NOT NULL,
    passenger_count INTEGER,
    trip_distance REAL,
    pu_location_id INTEGER,
    do_location_id INTEGER,
    fare_amount REAL,
    tip_amount REAL,
    total_amount REAL,
    avg_speed_mph REAL,
    tip_percentage REAL,
    is_rush_hour INTEGER,
    FOREIGN KEY (pu_location_id) REFERENCES dim_zones(location_id),
    FOREIGN KEY (do_location_id) REFERENCES dim_zones(location_id)
);

CREATE INDEX idx_trips_pickup ON fact_trips(pickup_datetime);
CREATE INDEX idx_trips_pu_location ON fact_trips(pu_location_id);
CREATE INDEX idx_trips_do_location ON fact_trips(do_location_id);