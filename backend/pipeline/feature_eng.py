import pandas as pd
import numpy as np

def selecting_features(df):
    df = df.copy()
    anomaly_log = {}

    duration_hours = (df['tpep_dropoff_datetime'] - df['tpep_pickup_datetime']).dt.total_seconds() / 3600.0
    df['avg_speed_mph'] = np.where(duration_hours > 0, df['trip_distance'] / duration_hours, 0)

    
    speed_mask = df['avg_speed_mph'] < 80
    anomaly_log['speed_glitches_dropped'] = len(df) - speed_mask.sum()
    df = df[speed_mask].copy()

    df['tip_percentage'] = np.where(df['fare_amount'] > 0, (df['tip_amount'] / df['fare_amount']) * 100, 0)

    hour = df['tpep_pickup_datetime'].dt.hour
    day_of_week = df['tpep_pickup_datetime'].dt.dayofweek

    is_weekday = day_of_week < 5
    is_am_rush = (hour >= 7) & (hour <= 9)
    is_pm_rush = (hour >= 16) & (hour <= 19)

    df['is_rush_hour'] = is_weekday & (is_am_rush | is_pm_rush)

    return df, anomaly_log

# adding the bubble sort algorithm
def find_top_k_destinations(df, k=10):
    
    dropoff_counts = {}
    for do_id in df['DOLocationID']:
        if do_id in dropoff_counts:
            dropoff_counts[do_id] += 1
        else:
            dropoff_counts[do_id] = 1
            
    frequency_list = list(dropoff_counts.items())
    n = len(frequency_list)
    
    for i in range(n):
        max_idx = i
        for j in range(i + 1, n):
            if frequency_list[j][1] > frequency_list[max_idx][1]:
                max_idx = j
        frequency_list[i], frequency_list[max_idx] = frequency_list[max_idx], frequency_list[i]
        
    return frequency_list[:k]