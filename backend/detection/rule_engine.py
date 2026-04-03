import pandas as pd
import numpy as np

# IMPROVED — time-windowed aggregation (production approach)
def detect_bruteforce(df, threshold=5, window_minutes=10):
    df = df.sort_values('timestamp')
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    
    # Group by IP and rolling time window
    df = df.set_index('timestamp')
    
    # Count failed logins per IP within a rolling window
    failed_window = (
        df[df['failed_logins'] > 0]
        .groupby('source_ip')['failed_logins']
        .rolling(f'{window_minutes}min')
        .sum()
        .reset_index()
        .rename(columns={'failed_logins': 'windowed_failed'})
    )
    
    suspicious_ips = failed_window[
        failed_window['windowed_failed'] > threshold
    ]['source_ip'].unique()
    
    df = df.reset_index()
    df['rule_bruteforce'] = df['source_ip'].isin(suspicious_ips)
    return df

# EVEN BETTER — also flag based on login velocity (attempts per minute)
def detect_bruteforce_advanced(df, threshold=5, velocity_threshold=2):
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    
    ip_stats = df.groupby('source_ip').agg(
        total_failed=('failed_logins', 'sum'),
        attempt_count=('failed_logins', 'count'),
        time_range=('timestamp', lambda x: (x.max() - x.min()).total_seconds() / 60)
    ).reset_index()
    
    ip_stats['login_velocity'] = ip_stats['total_failed'] / (ip_stats['time_range'] + 0.1)
    
    suspicious = ip_stats[
        (ip_stats['total_failed'] > threshold) |
        (ip_stats['login_velocity'] > velocity_threshold)
    ]['source_ip']
    
    df['rule_bruteforce'] = df['source_ip'].isin(suspicious)
    return df
# Detect brute force attack: If failed_logins > threshold 
# This catches SSH brute force attempts


def detect_port_scan(df, port_threshold=5, window_minutes=2):
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df_sorted = df.sort_values('timestamp')
    
    suspicious_ips = set()
    
    for ip, group in df_sorted.groupby('source_ip'):
        group = group.set_index('timestamp').sort_index()
        # Rolling window: how many unique ports hit in any 2-minute window?
        rolling_unique = (
            group['port']
            .rolling(f'{window_minutes}min')
            .apply(lambda x: len(set(x)), raw=False)
        )
        if rolling_unique.max() > port_threshold:
            suspicious_ips.add(ip)
    
    df['rule_port_scan'] = df['source_ip'].isin(suspicious_ips)
    return df
# Detect port scanning: If same source_ip hits more than X unique ports
# This is Port Scanning Attack

def detect_traffic_spike(df, z_threshold=3.0):
    ip_stats = df.groupby('source_ip')['bytes_transferred'].agg(['mean', 'std']).reset_index()
    ip_stats.columns = ['source_ip', 'mean_bytes', 'std_bytes']
    ip_stats['std_bytes'] = ip_stats['std_bytes'].fillna(1)  # avoid divide-by-zero
    
    df = df.merge(ip_stats, on='source_ip', how='left')
    
    # Z-score: how many standard deviations above the mean?
    df['bytes_zscore'] = (df['bytes_transferred'] - df['mean_bytes']) / df['std_bytes']
    df['rule_traffic_spike'] = df['bytes_zscore'] > z_threshold
    
    df = df.drop(columns=['mean_bytes', 'std_bytes'])
    return df

# Detect high data transfer (possible exfiltration)

def apply_rules(df, bruteforce_threshold=5, port_scan_threshold=5, traffic_spike_z_score=3.0):
    df = detect_bruteforce(df, threshold=bruteforce_threshold)
    df = detect_port_scan(df, port_threshold=port_scan_threshold)
    df = detect_traffic_spike(df, z_threshold=traffic_spike_z_score)
    # Making these functions as Dataframe for combining

    # Combine rule results
    df['rule_triggered'] = (
        df['rule_bruteforce'] |
        df['rule_port_scan'] |
        df['rule_traffic_spike']
    )
    # Combined using | (OR)
    # if ANY rule is true: → rule_triggered = True
    return df


def assign_alert_type(df):
    conditions = [
        df['rule_bruteforce'] == True,
        df['rule_port_scan'] == True,
        df['rule_traffic_spike'] == True,
        df['anomaly'] == 1,
    ]

    choices = [
        "Brute Force Attempt",
        "Port Scanning Activity",
        "Traffic Spike / Possible Exfiltration",
        "Behavioral Anomaly"
    ]

    df['alert_type'] = np.select(conditions, choices, default="Normal Activity")
    return df