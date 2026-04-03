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


def assign_severity_scored(df, critical_assets="10.0.0.5"):
    # Base score (vectorized — no iterrows)
    base_score = (
        df['rule_bruteforce'].astype(int)    * 40 +
        df['rule_port_scan'].astype(int)     * 25 +
        df['rule_traffic_spike'].astype(int) * 30 +
        df['anomaly'].astype(int)            * 15
    )

    # Confidence factor (0.5 – 1.0)
    confidence_factor = 0.5 + (df['confidence'].clip(0, 100) / 200)

    # Time multiplier — use 'hour' if already added by anomaly_detector, else compute it
    if 'hour' not in df.columns:
        hour_col = pd.to_datetime(df['timestamp']).dt.hour
    else:
        hour_col = df['hour']

    time_multiplier = np.where((hour_col < 6) | (hour_col > 22), 1.3, 1.0)

    # Asset criticality multiplier — built from configurable IP list
    asset_map = {ip.strip(): 1.5 for ip in critical_assets.split(",") if ip.strip()}
    asset_multiplier = df['destination_ip'].map(asset_map).fillna(1.0)

    # Final risk score — intermediate values NOT written to df (keeps DB clean)
    df['risk_score'] = (
        base_score * confidence_factor * time_multiplier * asset_multiplier
    ).round(2)

    # Severity bands
    df['severity'] = np.select(
        [
            df['risk_score'] >= 60,
            df['risk_score'] >= 40,
            df['risk_score'] >= 20,
            df['risk_score'] > 0,
        ],
        ["Critical", "High", "Medium", "Low"],
        default="Normal"
    )

    return df
