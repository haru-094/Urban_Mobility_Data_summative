import pandas as pd

def _safe_round(df, col, decimals=2):
    """Round a numeric column only if it exists in the dataframe."""
    if col in df.columns:
        df[col] = df[col].astype(float).round(decimals)
    return df

def _safe_str_clean(df, col, fill='Unknown', title_case=False):
    """Clean a string column only if it exists in the dataframe."""
    if col in df.columns:
        s = df[col].fillna(fill).astype(str).str.strip()
        df[col] = s.str.title() if title_case else s
    return df

def data_normalize(df):
    print("Normalizing fields for database readiness...")
    df_norm = df.copy()

    # Datetime columns
    df_norm['tpep_pickup_datetime']  = pd.to_datetime(df_norm['tpep_pickup_datetime'])
    df_norm['tpep_dropoff_datetime'] = pd.to_datetime(df_norm['tpep_dropoff_datetime'])

    # Numeric columns - skip gracefully if column absent
    for col in ['trip_distance', 'fare_amount', 'tip_amount', 'total_amount',
                'avg_speed_mph', 'tip_percentage']:
        df_norm = _safe_round(df_norm, col)

    # String / categorical columns
    df_norm = _safe_str_clean(df_norm, 'PU_Borough',      title_case=True)
    df_norm = _safe_str_clean(df_norm, 'PU_Zone')
    df_norm = _safe_str_clean(df_norm, 'PU_Service_Zone')

    # Boolean / integer columns
    if 'is_rush_hour' in df_norm.columns:
        df_norm['is_rush_hour'] = df_norm['is_rush_hour'].astype(bool)
    if 'passenger_count' in df_norm.columns:
        df_norm['passenger_count'] = df_norm['passenger_count'].fillna(1).astype(int)

    return df_norm