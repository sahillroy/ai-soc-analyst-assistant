import numpy as np
import pandas as pd  

SEVERITY_WEIGHTS = {
    'rule_bruteforce':    {'score': 40, 'impact': 'credential_theft'},
    'rule_port_scan':     {'score': 25, 'impact': 'reconnaissance'},
    'rule_traffic_spike': {'score': 30, 'impact': 'data_exfiltration'},
    'anomaly':            {'score': 15, 'impact': 'unknown'},
}

ASSET_CRITICALITY = {
    '10.0.0.5': 1.5,
    'default':   1.0,
}

def calculate_risk_score(row):
    base_score = 0
    
    for rule, config in SEVERITY_WEIGHTS.items():
        if row.get(rule) == 1 or row.get(rule) is True:
            base_score += config['score']
    
    confidence_factor = 0.5 + (min(row.get('confidence', 50), 100) / 200)
    
    dest_ip = row.get('destination_ip', '')
    asset_multiplier = ASSET_CRITICALITY.get(dest_ip, ASSET_CRITICALITY['default'])
    
    try:
        hour = pd.to_datetime(row['timestamp']).hour
        time_multiplier = 1.3 if (hour < 6 or hour > 22) else 1.0
    except:
        time_multiplier = 1.0
    
    final_score = base_score * confidence_factor * asset_multiplier * time_multiplier
    return round(final_score, 2)

def assign_severity_scored(df):


    # Base score (vectorized)
    df['risk_score'] = (
        df['rule_bruteforce'].astype(int) * 40 +
        df['rule_port_scan'].astype(int) * 25 +
        df['rule_traffic_spike'].astype(int) * 30 +
        df['anomaly'].astype(int) * 15
    )

    # Confidence factor
    df['confidence_factor'] = 0.5 + (df['confidence'].clip(0, 100) / 200)

    # Time multiplier
    df['hour'] = pd.to_datetime(df['timestamp']).dt.hour
    df['time_multiplier'] = np.where(
        (df['hour'] < 6) | (df['hour'] > 22),
        1.3,
        1.0
    )

    # Asset criticality
    df['asset_multiplier'] = df['destination_ip'].map({
        '10.0.0.5': 1.5
    }).fillna(1.0)

    # Final score
    df['risk_score'] = (
        df['risk_score'] *
        df['confidence_factor'] *
        df['time_multiplier'] *
        df['asset_multiplier']
    ).round(2)

    # Severity mapping
    df['severity'] = np.select(
        [
            df['risk_score'] >= 60,
            df['risk_score'] >= 40,
            df['risk_score'] >= 20,
            df['risk_score'] > 0
        ],
        ["Critical", "High", "Medium", "Low"],
        default="Normal"
    )

    return df