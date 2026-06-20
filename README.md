# Urban Mobility Data Explorer

An end-to-end data engineering and analytics application built to process, store, and interactively explore NYC Yellow Taxi trip records from January 2019. The system includes a modular Python data pipeline, a normalized SQLite database, a Flask REST API, and a browser-based analytics dashboard.

---

## Project Structure

```
Urban_Mobility_Data_summative/
│
├── backend/
│   ├── app.py                         # Flask web server — serves frontend + REST API
│   │
│   ├── pipeline/
│   │   ├── run_pipeline.py            # Master orchestration script
│   │   ├── data_clean.py              # Outlier removal and validation
│   │   ├── feature_eng.py             # Derived metrics + custom Top-K algorithm
│   │   └── normalize.py               # Type casting and schema standardization
│   │
│   ├── database/
│   │   ├── schema.sql                 # Star Schema DDL with B-Tree indexes
│   │   └── insert_data.py             # Bulk seeding from parquet into SQLite
│   │
│   ├── raw_data/
│   │   ├── yellow_tripdata_2019-01.csv  # Source dataset (not tracked in git)
│   │   ├── taxi_zone_lookup.csv         # Zone dimension table
│   │   └── taxi_zones/                  # Spatial shapefiles (not tracked)
│   │
│   └── final_data/
│       ├── cleaned_trips.parquet        # Processed columnar cache (not tracked)
│       ├── urban_mobility.db            # Production SQLite database (not tracked)
│       └── anomaly_transparency_log.json  # Pipeline quality report (tracked)
│
├── frontend/
│   ├── index.html                     # Dashboard entry point
│   ├── css/
│   │   └── style.css                  # Full styling
│   └── js/
│       ├── main.js                    # App bootstrap and event wiring
│       ├── api.js                     # Shared fetch wrapper and query builder
│       ├── config.js                  # API base URL and chart color palette
│       ├── overview.js                # KPI cards and borough charts
│       ├── temporal.js                # Hourly and daily charts
│       ├── geography.js               # Zone ranking chart and sortable table
│       ├── economics.js               # Fare distribution histogram
│       ├── speed.js                   # Speed and congestion charts
│       ├── transparency.js            # Data quality report cards
│       └── utils.js                   # Shared formatters and DOM helpers
│
├── diagrams/
│   └── NYC_Taxi_Urban.drawio.png      # System architecture diagram
│
├── .gitignore
└── README.md
```

---

- **Team Task Sheet:** [Google Sheets Link](https://docs.google.com/spreadsheets/d/1vDnTStL2Lha4P6t_-vPUV3Y7KT5pEA-xgKN5OdKn6V0/edit?gid=0#gid=0)
- **Video Walkthrough:** [YouTube Demonstration Link](https://www.youtube.com/watch?v=dQw4w9WgXcQ) *(Placeholder link: replace with actual video URL before final submission)*

## Database Schema

The database follows a **Star Schema** with one fact table and one dimension table.

### `dim_zones` (Dimension)

| Column | Type | Description |
|---|---|---|
| `location_id` | INTEGER PK | Unique taxi zone ID |
| `borough` | TEXT | NYC borough name |
| `zone` | TEXT | Zone name |
| `service_zone` | TEXT | Service category |

### `fact_trips` (Fact)

| Column | Type | Description |
|---|---|---|
| `trip_id` | INTEGER PK | Auto-incremented row ID |
| `vendor_id` | INTEGER | Vendor identifier |
| `pickup_datetime` | TEXT | Trip start timestamp |
| `dropoff_datetime` | TEXT | Trip end timestamp |
| `passenger_count` | INTEGER | Number of passengers |
| `trip_distance` | REAL | Distance in miles |
| `pu_location_id` | INTEGER FK | Pickup zone (→ dim_zones) |
| `do_location_id` | INTEGER FK | Drop-off zone (→ dim_zones) |
| `fare_amount` | REAL | Metered fare (USD) |
| `tip_amount` | REAL | Tip paid (USD) |
| `total_amount` | REAL | Total charged (USD) |
| `avg_speed_mph` | REAL | Derived: distance ÷ duration |
| `tip_percentage` | REAL | Derived: tip ÷ fare × 100 |
| `is_rush_hour` | INTEGER | 1 if weekday 7–9 AM or 4–7 PM |

**B-Tree Indexes:**
- `idx_trips_pickup` on `pickup_datetime`
- `idx_trips_pu_location` on `pu_location_id`
- `idx_trips_do_location` on `do_location_id`

---

## Pipeline — Derived Features

The pipeline computes three engineered columns before database insertion:

| Feature | Logic |
|---|---|
| `avg_speed_mph` | `trip_distance / duration_hours` — trips with speed ≥ 80 mph are dropped as sensor glitches |
| `tip_percentage` | `(tip_amount / fare_amount) × 100` — only computed when `fare_amount > 0` |
| `is_rush_hour` | `1` if the pickup is on a weekday during 7–9 AM or 4–7 PM, else `0` |

The pipeline also runs a **custom Top-K selection sort algorithm** (`find_top_k_destinations`) to rank the most frequent drop-off zones without using any external sorting library.

---

## API Endpoints

The Flask server runs on `http://localhost:5000`. All endpoints return JSON.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | Serves the frontend dashboard |
| GET | `/api/health` | Liveness check — confirms DB is reachable |
| GET | `/api/zones` | All 265 taxi zone records |
| GET | `/api/trips/summary` | KPI aggregation (total trips, avg fare, avg speed, rush %) |
| GET | `/api/trips/hourly` | Trip volume and avg fare by hour (0–23) |
| GET | `/api/trips/daily` | Trip volume by day of week |
| GET | `/api/trips/by-borough` | Stats grouped by pickup borough |
| GET | `/api/trips/top-zones` | Top N pickup or drop-off zones by volume |
| GET | `/api/trips/fare-distribution` | Bucketed fare histogram ($5 increments) |
| GET | `/api/trips/speed-analysis` | Avg speed mph by hour of day |
| GET | `/api/transparency` | Pre-computed pipeline quality report |
| GET | `/api/trips/top-k-destinations` | Top-K drop-off zones ranked by selection sort |

### Query Parameters

Most trip endpoints accept optional filters:

| Parameter | Values | Example |
|---|---|---|
| `borough` | `Manhattan`, `Brooklyn`, `Queens`, `Bronx`, `Staten Island`, `EWR` | `?borough=Manhattan` |
| `is_rush_hour` | `true` / `false` | `?is_rush_hour=true` |
| `limit` | Integer up to 50 (top-zones only) | `?limit=15` |
| `type` | `pickup` / `dropoff` (top-zones only) | `?type=dropoff` |

---

## How to Run

### Prerequisites

- Python 3.8+
- The raw dataset file `yellow_tripdata_2019-01.csv` placed in `backend/raw_data/`
- The zone lookup file `taxi_zone_lookup.csv` in `backend/raw_data/`

---

### Step 1 — Create and Activate Virtual Environment

```bash
# Create the environment
python3 -m venv .venv

# Activate it (Linux / macOS)
source .venv/bin/activate

# Activate it (Windows)
.venv\Scripts\activate
```

### Step 2 — Install Dependencies

```bash
pip install -r requirements.txt
```

---

### Step 3 — Run the Data Pipeline

This reads the raw CSV, cleans it, engineers features, and outputs a compressed parquet file plus a transparency report.

```bash
python3 backend/pipeline/run_pipeline.py
```

Expected output in `backend/final_data/`:
- `cleaned_trips.parquet` — processed and validated trip records

The terminal will also print a **Transparency Report** showing how many records were ingested, dropped, and retained, and the **Top 5 Drop-off Zones** ranked by the custom selection sort algorithm.

---

### Step 4 — Seed the Database

This reads the parquet file and loads it into the SQLite relational database.

```bash
python3 backend/database/insert_data.py
```

Expected output in `backend/final_data/`:
- `urban_mobility.db` — production SQLite database

---

### Step 5 — Start the Flask API Server

```bash
python3 backend/app.py
```

The server starts at **http://localhost:5000**.

Open your browser and go to `http://localhost:5000` to view the interactive dashboard.

---

### Quick API Test

Once the server is running you can test any endpoint from a second terminal:

```bash
# Health check
curl http://localhost:5000/api/health

# Summary for Manhattan during rush hour
curl "http://localhost:5000/api/trips/summary?borough=Manhattan&is_rush_hour=true"

# Top 10 pickup zones
curl "http://localhost:5000/api/trips/top-zones?limit=10&type=pickup"
```

---

## What is Not Tracked in Git

The following files are excluded via `.gitignore` because they are either too large or auto-generated:

| Path | Reason |
|---|---|
| `backend/raw_data/yellow_tripdata_2019-01.csv` | 687 MB source file |
| `backend/raw_data/taxi_zones/` | Shapefile directory |
| `backend/final_data/urban_mobility.db` | 1.2 GB SQLite database |
| `backend/final_data/cleaned_trips.parquet` | 176 MB processed cache |
| `.venv/` | Python virtual environment |
| `__pycache__/` | Python bytecode |

The `anomaly_transparency_log.json` is tracked because it is small and documents pipeline quality.
