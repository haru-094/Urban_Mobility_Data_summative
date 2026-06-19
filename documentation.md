# Technical Report — Urban Mobility Data Explorer

---

## 1. Problem Framing and Dataset Analysis

We used the NYC TLC Yellow Taxi trip records for January 2019 — about 7.7 million rows covering pickups, dropoffs, fares, distances, and tips across New York City.

**Data challenges we handled:**

| Issue | What we did |
|---|---|
| Missing fields | Dropped rows missing pickup time, dropoff time, distance, or fare |
| Temporal violations | Removed 6,734 trips from wrong years or where dropoff came before pickup |
| Fare/distance outliers | Removed 55,392 trips with zero fares, zero distance, or distance above 100 miles |
| Speed glitches | Removed 5,944 trips where calculated speed exceeded 80 mph |

**Assumptions:** trips outside 2019 were errors, 100 miles is the maximum realistic NYC taxi distance, 80 mph means a sensor fault, and rush hour means weekday 7–9 AM and 4–7 PM.

**Unexpected observation:** we retained 7,599,722 out of 7,667,792 records — a **99.11% retention rate**. We expected far more noise. Zero records failed the spatial check, which confirmed the dataset was reliable enough to build real insights from.

---

## 2. System Architecture and Design Decisions

The system has three layers — a Python pipeline that cleans the data, a Flask API that serves it, and a vanilla JS frontend that visualises it.

Raw CSV → Pipeline → cleaned_trips.parquet → SQLite DB → Flask API → Browser Dashboard

| Layer | Technology | Role |
|---|---|---|
| Pipeline | Python, pandas, numpy | Cleans data and engineers features |
| Database | SQLite | Stores 7.6M trips in a star schema |
| Backend | Flask + flask-cors | REST API with 10 JSON endpoints |
| Frontend | Vanilla JS + Chart.js | Charts and filters in the browser |

**Why these choices:**
- **SQLite** — no server needed, runs as a single file on any machine
- **Flask** — lightweight, fits simple read-only endpoints perfectly
- **Vanilla JS** — no build tools, open the HTML file and it works

**Schema:** one fact table (`fact_trips`) joined to one dimension table (`dim_zones`), with B-Tree indexes on `pickup_datetime`, `pu_location_id`, and `do_location_id` for fast filtering.

**Trade-offs:** SQLite cannot handle multiple users writing at the same time — fine for a single-user academic project, but a real deployment would need PostgreSQL. The parquet intermediate file adds a setup step but means the pipeline never needs to re-run if the database is rebuilt.

---

## 3. Algorithmic Logic and Data Structures

We needed to rank the most popular drop-off zones across 7.6 million records **without using `Counter`, `sort_values`, or any sorting library**.

Our solution in `feature_eng.py` — manual frequency count + custom selection sort:

```python
# Step 1 — count manually
dropoff_counts = {}
for do_id in df['DOLocationID']:
    if do_id in dropoff_counts:
        dropoff_counts[do_id] += 1
    else:
        dropoff_counts[do_id] = 1

# Step 2 — selection sort
frequency_list = list(dropoff_counts.items())
n = len(frequency_list)

for i in range(n):
    max_idx = i
    for j in range(i + 1, n):
        if frequency_list[j][1] > frequency_list[max_idx][1]:
            max_idx = j
    frequency_list[i], frequency_list[max_idx] = frequency_list[max_idx], frequency_list[i]

return frequency_list[:k]
```

**Pseudocode:**
count each dropoff ID into a dictionary

convert to list of (id, count) pairs

FOR each position i:

find the highest count in the unsorted portion

swap it into position i

RETURN first k results

> The code comment says bubble sort but this is actually **selection sort** — it finds the maximum first and swaps once per pass, not adjacent swaps like bubble sort.

**Complexity:**

| | Complexity | Why |
|---|---|---|
| Counting loop | O(n) | One pass through all trips |
| Selection sort | O(z²) | z = 265 unique zones, effectively constant |
| Overall time | O(n + z²) | Counting dominates |
| Space | O(z) | Dictionary holds at most 265 entries |

---

## 4. Insights and Interpretation

### Insight 1 — Rush hour barely affects fares
Derived from `/api/trips/summary` with and without `?is_rush_hour=true`. The average fare during rush hour is almost identical to the all-day average because NYC meters run on **distance, not time**. Sitting in traffic does not cost more. Passengers also tend to take shorter trips during peak hours, keeping fares low.

### Insight 2 — Manhattan: most trips, slowest speeds
Derived from `/api/trips/by-borough` and `/api/trips/speed-analysis`. Manhattan has by far the highest trip volume but the lowest average speed, especially during rush hours. More taxis in a dense area creates a self-reinforcing congestion loop — a strong argument for better public transport to take taxis off the road.

### Insight 3 — Most trips are short and cheap
Derived from `/api/trips/fare-distribution`. The biggest share of trips fall in the **$5–$15 range**, with counts dropping sharply above $30. NYC taxis are used for short local trips, not long journeys. This makes tip income critical for drivers since the base fare on short rides is small.

---

## 5. Reflection and Future Work

**Challenges we ran into:**

- Inserting 7.6M rows into SQLite was slow until we used 100,000-row chunks and `PRAGMA synchronous = OFF`
- CORS errors made the dashboard appear blank with no explanation — the error was hidden in the browser console, not Flask's terminal
- The frontend and backend were built in parallel and at one point the filter parameter names did not match, causing filters to silently do nothing
- Merge conflicts slowed us down when both members edited the same JS files at the same time

**What we would do differently or next:**

- Switch SQLite to PostgreSQL for multi-user support
- Add a date range filter to compare across months and seasons
- Deploy to Render or Railway so the dashboard works without a local Python setup
- Surface the Top-K algorithm result on the dashboard with borough filtering

