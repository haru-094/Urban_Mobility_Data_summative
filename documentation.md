Urban Mobility Data Explorer — Technical Report
NYC Yellow Taxi TLC Dataset | January 2019

1. Problem Framing and Dataset Analysis
We worked with the NYC TLC Yellow Taxi trip records for January 2019. The dataset has close to 7.7 million rows and covers every yellow taxi trip made in New York City that month, including pickup and dropoff times, locations, distances, fares, and tips. We also used a zone lookup table with 265 zones to map numeric location IDs to real borough and zone names.
Data Challenges
Cleaning the data involved four checks:

Missing values — rows missing pickup time, dropoff time, distance, or fare were dropped immediately since none of those records could be used in any analysis
Temporal violations — trips where the pickup year was not 2019, or where the dropoff time came before the pickup time, were removed. A total of 6,734 records were dropped at this stage
Financial and physical outliers — trips with zero or negative fares, zero or negative distances, or distances above 100 miles were filtered out as physically impossible. This removed 55,392 records
Speed glitches — after computing average speed as distance divided by duration, any trip above 80 mph was removed as a sensor error. This caught 5,944 records

Assumptions Made

Any trip from a year other than 2019 was treated as an error in the source file, not valid historical data
A trip distance above 100 miles is unrealistic for a New York City taxi journey
A calculated speed above 80 mph indicates a GPS or sensor error, not a real trip
Rush hour was defined as weekday mornings 7–9 AM and weekday afternoons 4–7 PM, consistent with how NYC transportation planners define peak periods

Unexpected Observation
The most surprising finding was how little data we actually lost. After running all four cleaning stages on 7,667,792 records, we retained 7,599,722 — a retention rate of 99.11%. We expected a much messier dataset going in. Even more unexpected was that zero records failed the spatial check, meaning every single trip referenced a valid zone ID. This gave us confidence that the dashboard insights were based on a genuine and representative sample of NYC taxi activity.

2. System Architecture and Design Decisions
The system has three layers. The data pipeline reads and cleans the raw CSV and saves the result as a parquet file. The backend loads that parquet file into SQLite and serves it through a Flask REST API. The frontend is a plain HTML page that fetches from the API and renders charts using Chart.js.
LayerTechnologyWhat it doesPipelinePython, pandas, numpyCleans raw data and engineers featuresDatabaseSQLiteStores 7.6M cleaned trips in a star schemaBackend APIFlask + flask-corsServes JSON to the frontend via 10 endpointsFrontendVanilla JS + Chart.jsRenders charts and filter controls in the browser
Stack Justification
We chose SQLite because it needs no server setup — the entire database is a single file on disk, which made the project easy to run on any machine. Flask was chosen because we only needed simple read-only GET endpoints and a heavier framework would have added unnecessary complexity. Vanilla JavaScript with no build tools kept the frontend simple and meant anyone could open the HTML file directly in a browser without installing anything extra.
The database follows a star schema with one fact table (fact_trips) and one dimension table (dim_zones). Three B-Tree indexes were added on pickup_datetime, pu_location_id, and do_location_id to speed up the filtering queries that almost every API endpoint relies on.
Trade-offs

SQLite vs PostgreSQL — SQLite cannot handle concurrent writes, which would be a problem if multiple users queried the dashboard at the same time. For a single-user academic project this was acceptable, but a real deployment would need PostgreSQL
Parquet intermediate file — saving a parquet file between the pipeline and the database adds one extra setup step, but it means the cleaning pipeline never needs to re-run if the database is deleted or rebuilt


3. Algorithmic Logic and Data Structures
During the pipeline stage, we needed to identify the most popular drop-off zones across 7.6 million records without using any built-in sorting or counting libraries. We implemented this in feature_eng.py using a manual frequency count and a custom selection sort.
Step 1 — Manual Frequency Count
Instead of using Counter or value_counts(), we iterate through every dropoff location ID and build a plain Python dictionary:
pythondropoff_counts = {}
for do_id in df['DOLocationID']:
    if do_id in dropoff_counts:
        dropoff_counts[do_id] += 1
    else:
        dropoff_counts[do_id] = 1
Step 2 — Selection Sort
The dictionary is converted to a list of (zone_id, count) pairs and sorted by finding the maximum count in each pass:
pythonfrequency_list = list(dropoff_counts.items())
n = len(frequency_list)

for i in range(n):
    max_idx = i
    for j in range(i + 1, n):
        if frequency_list[j][1] > frequency_list[max_idx][1]:
            max_idx = j
    frequency_list[i], frequency_list[max_idx] = frequency_list[max_idx], frequency_list[i]

return frequency_list[:k]
Pseudocode
count all dropoff IDs into a dictionary
convert dictionary to list of (id, count) pairs
FOR each position i from 0 to n:
    find the index of the maximum count in the remaining unsorted portion
    swap that element into position i
RETURN the first k elements

Note: the comment in the code labels this as bubble sort, but the implementation is actually selection sort. Bubble sort swaps adjacent elements repeatedly, while selection sort finds the maximum first and performs one swap per pass. The code follows the selection sort pattern.

Complexity Analysis
ComponentComplexityReasonFrequency countingO(n)Single pass through all n trip recordsSelection sortO(z²)z = unique zones, fixed at 265Overall timeO(n + z²)Counting dominates at scaleSpaceO(z)Dictionary and list hold at most z entries
Since z is fixed at 265 zones, the sort is effectively constant. The dominant cost is always the O(n) counting loop.

4. Insights and Interpretation
Insight 1 — Rush Hour Does Not Significantly Raise Fares
How we derived it: comparing /api/trips/summary with and without ?is_rush_hour=true
The average fare during rush hour is almost identical to the all-day average. NYC taxi meters run on distance, not time, so sitting in traffic does not raise the fare. Passengers also tend to take shorter trips during peak hours, which keeps the total cost low. This means taking a taxi during rush hour is not as expensive as most people assume, which could encourage taxi use during peak periods and help spread demand more evenly across the day.

Insight 2 — Manhattan Has the Most Trips but the Slowest Speeds
How we derived it: /api/trips/by-borough for volume and /api/trips/speed-analysis for hourly speed patterns
Manhattan generates far more taxi trips than any other borough but also records the lowest average speeds, particularly during morning and evening rush hours. More taxis competing for the same road space in a dense area creates a self-reinforcing congestion loop. From a city planning perspective, this supports investing in expanded subway and bus capacity in Manhattan to reduce the number of taxis on the road.

Insight 3 — Most Trips Are Short and Cheap
How we derived it: /api/trips/fare-distribution histogram rendered in economics.js
The largest share of trips falls in the $5–$15 fare range, with trip counts dropping sharply above $30. NYC taxis are used primarily for short local journeys, not long cross-city rides. This also means tip income is important to drivers — the base fare on a $7 trip is small, so even a generous tip percentage adds up to very little per ride.

5. Reflection and Future Work
Technical Challenges

Loading a 687 MB CSV with 7.7 million rows required low_memory=False to avoid type warnings, and the database insert had to be chunked into 100,000-row batches with SQLite performance pragmas to complete in a reasonable time
CORS errors blocked all API calls when the frontend was opened as a static file. The dashboard appeared empty with no obvious explanation — the actual error was only visible in the browser console. Adding flask-cors fixed it but took time to diagnose
The frontend and backend were built in parallel by different team members. At one point the frontend was passing a filter parameter with the wrong name, so filters silently had no effect — the API still returned data, just unfiltered, which made the bug hard to spot

Team Challenges

Merge conflicts in the JavaScript files slowed things down when both members were editing related functions at the same time. Clearer file ownership from the start would have helped
Agreeing on API parameter names and response shapes before starting development would have prevented the filter mismatch issue entirely

Future Improvements

Replace SQLite with PostgreSQL to support multiple concurrent users
Add a date range filter to allow comparison across different months and seasons
Expose the Top-K algorithm result through a dedicated API endpoint with borough filtering
Deploy the Flask API to a cloud platform like Render so the dashboard works without a local Python setup