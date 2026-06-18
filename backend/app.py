import sqlite3
import json
from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_cors import CORS
from pathlib import Path

app = Flask(__name__, template_folder=str(Path(__file__).resolve().parent.parent / 'frontend'))
CORS(app)

base_dir = Path(__file__).resolve().parent
db_path  = base_dir / "final_data/urban_mobility.db"
log_path = base_dir / "final_data/anomaly_transparency_log.json"

# make connection with the database
def get_db_connection():
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    return conn

# the root app that render the index.html
@app.route("/")
def home():
    return render_template("index.html")

@app.route("/<path:filename>")
def static_files(filename):
    frontend_dir = Path(__file__).resolve().parent.parent / "frontend"
    return send_from_directory(str(frontend_dir), filename)

# api zone
@app.route('/api/zones', methods=['GET'])
def get_zones():
    try:
        conn = get_db_connection()
        rows = conn.execute(
            "SELECT location_id, borough, zone, service_zone FROM dim_zones ORDER BY location_id ASC;"
        ).fetchall()
        conn.close()
        return jsonify({"success": True, "data": [dict(r) for r in rows]}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/trips/summary', methods=['GET'])
def get_trips_summary():
    borough_filter   = request.args.get('borough',      default=None)
    rush_hour_filter = request.args.get('is_rush_hour', default=None)

    query = """
        SELECT
            COUNT(f.trip_id)                     AS total_trips,
            ROUND(AVG(f.trip_distance),   2)     AS avg_distance_miles,
            ROUND(AVG(f.fare_amount),     2)     AS avg_fare_usd,
            ROUND(AVG(f.tip_percentage),  2)     AS avg_tip_pct,
            ROUND(AVG(f.avg_speed_mph),   2)     AS avg_speed_mph,
            ROUND(AVG(f.total_amount),    2)     AS avg_total_amount,
            SUM(f.is_rush_hour)                  AS total_rush_hour_trips,
            ROUND(AVG(f.passenger_count), 2)     AS avg_passengers
        FROM fact_trips f
        JOIN dim_zones z ON f.pu_location_id = z.location_id
        WHERE 1=1
    """
    params = []

    if borough_filter:
        query += " AND z.borough = ?"
        params.append(borough_filter.strip().title())

    if rush_hour_filter is not None:
        query += " AND f.is_rush_hour = ?"
        params.append(1 if rush_hour_filter.lower() == 'true' else 0)

    try:
        conn   = get_db_connection()
        result = conn.execute(query, params).fetchone()
        conn.close()

        total = result["total_trips"] or 0
        rush  = result["total_rush_hour_trips"] or 0

        summary = {
            "total_trips":          total,
            "avg_distance_miles":   result["avg_distance_miles"]  or 0.0,
            "avg_fare_usd":         result["avg_fare_usd"]        or 0.0,
            "avg_tip_pct":          result["avg_tip_pct"]         or 0.0,
            "avg_speed_mph":        result["avg_speed_mph"]       or 0.0,
            "avg_total_amount":     result["avg_total_amount"]    or 0.0,
            "total_rush_hour_trips": rush,
            "rush_hour_pct":        round((rush / total * 100), 2) if total else 0.0,
            "avg_passengers":       result["avg_passengers"]      or 0.0,
        }
        return jsonify({
            "success":        True,
            "filters_applied": {"borough": borough_filter, "is_rush_hour": rush_hour_filter},
            "summary":        summary
        }), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/trips/hourly', methods=['GET'])
def get_trips_hourly():
    borough_filter   = request.args.get('borough',      default=None)
    rush_hour_filter = request.args.get('is_rush_hour', default=None)

    query = """
        SELECT
            CAST(strftime('%H', f.pickup_datetime) AS INTEGER) AS hour,
            COUNT(f.trip_id)                                   AS trip_count,
            ROUND(AVG(f.fare_amount), 2)                       AS avg_fare,
            ROUND(AVG(f.trip_distance), 2)                     AS avg_distance
        FROM fact_trips f
        JOIN dim_zones z ON f.pu_location_id = z.location_id
        WHERE 1=1
    """
    params = []

    if borough_filter:
        query += " AND z.borough = ?"
        params.append(borough_filter.strip().title())

    if rush_hour_filter is not None:
        query += " AND f.is_rush_hour = ?"
        params.append(1 if rush_hour_filter.lower() == 'true' else 0)

    query += " GROUP BY hour ORDER BY hour ASC;"

    try:
        conn = get_db_connection()
        rows = conn.execute(query, params).fetchall()
        conn.close()
        return jsonify({"success": True, "data": [dict(r) for r in rows]}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/trips/by-borough', methods=['GET'])
def get_trips_by_borough():

    query = """
        SELECT
            z.borough,
            COUNT(f.trip_id)               AS total_trips,
            ROUND(AVG(f.fare_amount),  2)  AS avg_fare,
            ROUND(AVG(f.trip_distance),2)  AS avg_distance,
            ROUND(AVG(f.tip_percentage),2) AS avg_tip_pct,
            SUM(f.is_rush_hour)            AS rush_hour_trips
        FROM fact_trips f
        JOIN dim_zones z ON f.pu_location_id = z.location_id
        GROUP BY z.borough
        ORDER BY total_trips DESC;
    """
    try:
        conn = get_db_connection()
        rows = conn.execute(query).fetchall()
        conn.close()
        return jsonify({"success": True, "data": [dict(r) for r in rows]}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500



@app.route('/api/trips/top-zones', methods=['GET'])
def get_top_zones():
    limit_raw    = request.args.get('limit',   default='10')
    borough_filter = request.args.get('borough', default=None)
    zone_type    = request.args.get('type',    default='pickup').lower()

    try:
        limit = min(int(limit_raw), 50)
    except ValueError:
        limit = 10

    if zone_type == 'dropoff':
        join_col = "f.do_location_id"
    else:
        join_col = "f.pu_location_id"

    query = f"""
        SELECT
            z.zone,
            z.borough,
            z.service_zone,
            COUNT(f.trip_id)               AS total_trips,
            ROUND(AVG(f.fare_amount),  2)  AS avg_fare,
            ROUND(AVG(f.trip_distance),2)  AS avg_distance
        FROM fact_trips f
        JOIN dim_zones z ON {join_col} = z.location_id
        WHERE 1=1
    """
    params = []

    if borough_filter:
        query += " AND z.borough = ?"
        params.append(borough_filter.strip().title())

    query += f" GROUP BY z.location_id ORDER BY total_trips DESC LIMIT ?;"
    params.append(limit)

    try:
        conn = get_db_connection()
        rows = conn.execute(query, params).fetchall()
        conn.close()
        return jsonify({
            "success":   True,
            "zone_type": zone_type,
            "data":      [dict(r) for r in rows]
        }), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/trips/daily', methods=['GET'])
def get_trips_daily():
    borough_filter = request.args.get('borough', default=None)

    query = """
        SELECT
            CAST(strftime('%w', f.pickup_datetime) AS INTEGER) AS day_of_week,
            COUNT(f.trip_id)               AS trip_count,
            ROUND(AVG(f.fare_amount),  2)  AS avg_fare,
            ROUND(AVG(f.trip_distance),2)  AS avg_distance
        FROM fact_trips f
        JOIN dim_zones z ON f.pu_location_id = z.location_id
        WHERE 1=1
    """
    params = []

    if borough_filter:
        query += " AND z.borough = ?"
        params.append(borough_filter.strip().title())

    query += " GROUP BY day_of_week ORDER BY day_of_week ASC;"

    try:
        conn = get_db_connection()
        rows = conn.execute(query, params).fetchall()
        conn.close()

        day_names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
        data = []
        for r in rows:
            d = dict(r)
            d["day_name"] = day_names[d["day_of_week"]]
            data.append(d)

        return jsonify({"success": True, "data": data}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/trips/fare-distribution', methods=['GET'])
def get_fare_distribution():
    
    borough_filter = request.args.get('borough', default=None)
    query = """
        SELECT
            CASE
                WHEN f.fare_amount <  5  THEN '0-5'
                WHEN f.fare_amount < 10  THEN '5-10'
                WHEN f.fare_amount < 15  THEN '10-15'
                WHEN f.fare_amount < 20  THEN '15-20'
                WHEN f.fare_amount < 25  THEN '20-25'
                WHEN f.fare_amount < 30  THEN '25-30'
                WHEN f.fare_amount < 40  THEN '30-40'
                WHEN f.fare_amount < 50  THEN '40-50'
                WHEN f.fare_amount < 75  THEN '50-75'
                ELSE '75+'
            END AS fare_bucket,
            COUNT(*) AS trip_count
        FROM fact_trips f
        JOIN dim_zones z ON f.pu_location_id = z.location_id
        WHERE f.fare_amount > 0
    """
    params = []

    if borough_filter:
        query += " AND z.borough = ?"
        params.append(borough_filter.strip().title())

    query += " GROUP BY fare_bucket;"

    try:
        conn = get_db_connection()
        rows = conn.execute(query, params).fetchall()
        conn.close()
        # Preserve natural bucket order
        order = ['0-5','5-10','10-15','15-20','20-25','25-30','30-40','40-50','50-75','75+']
        data_map = {r['fare_bucket']: r['trip_count'] for r in rows}
        data = [{"fare_bucket": b, "trip_count": data_map.get(b, 0)} for b in order]
        return jsonify({"success": True, "data": data}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/trips/speed-analysis', methods=['GET'])
def get_speed_analysis():
    borough_filter = request.args.get('borough', default=None)

    query = """
        SELECT
            CAST(strftime('%H', f.pickup_datetime) AS INTEGER) AS hour,
            ROUND(AVG(f.avg_speed_mph), 2) AS avg_speed_mph,
            COUNT(f.trip_id)               AS trip_count
        FROM fact_trips f
        JOIN dim_zones z ON f.pu_location_id = z.location_id
        WHERE f.avg_speed_mph > 0
    """
    params = []

    if borough_filter:
        query += " AND z.borough = ?"
        params.append(borough_filter.strip().title())

    query += " GROUP BY hour ORDER BY hour ASC;"

    try:
        conn = get_db_connection()
        rows = conn.execute(query, params).fetchall()
        conn.close()
        return jsonify({"success": True, "data": [dict(r) for r in rows]}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500



@app.route('/api/transparency', methods=['GET'])
def get_transparency_report():
    try:
        if not log_path.exists():
            return jsonify({"success": False, "error": "Transparency log not found. Run pipeline first."}), 404
        with open(log_path, "r") as f:
            report = json.load(f)
        return jsonify({"success": True, "report": report}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500



@app.route('/api/health', methods=['GET'])
def health_check():
    try:
        conn = get_db_connection()
        row  = conn.execute("SELECT COUNT(*) AS cnt FROM fact_trips;").fetchone()
        conn.close()
        return jsonify({
            "success": True,
            "status":  "healthy",
            "db_path": str(db_path),
            "total_trips_in_db": row["cnt"]
        }), 200
    except Exception as e:
        return jsonify({"success": False, "status": "unhealthy", "error": str(e)}), 500


if __name__ == '__main__':
    print("=" * 55)
    print("  Urban Mobility Data Explorer — Flask API Server")
    print("=" * 55)
    print(f"  Database : {db_path}")
    print(f"  DB exists: {db_path.exists()}")
    print("  Endpoints:")
    print("    GET /api/health")
    print("    GET /api/zones")
    print("    GET /api/transparency")
    print("    GET /api/trips/summary")
    print("    GET /api/trips/hourly")
    print("    GET /api/trips/daily")
    print("    GET /api/trips/by-borough")
    print("    GET /api/trips/top-zones")
    print("    GET /api/trips/fare-distribution")
    print("    GET /api/trips/speed-analysis")
    print("=" * 55)
    app.run(host='0.0.0.0', port=5000, debug=True)