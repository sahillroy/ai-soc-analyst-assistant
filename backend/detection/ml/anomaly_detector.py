import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
import ipaddress  # Convert IP string → numeric 


def ip_to_int(ip):
    return int(ipaddress.ip_address(ip))
# Since ML model can't understand 192.168.1.10 so we are converting it into integer 3232235786

def preprocess_data(df):
    # Convert timestamp to datetime
    df['timestamp'] = pd.to_datetime(df['timestamp'])

    # Extract hour from timestamp
    df['hour'] = df['timestamp'].dt.hour
    # As 2 AM login attempts → suspicious whereas Office hours traffic → normal

    # Convert IP addresses to integers
    df['source_ip_encoded'] = df['source_ip'].apply(ip_to_int)
    df['destination_ip_encoded'] = df['destination_ip'].apply(ip_to_int)

    # Encode protocol (TCP=0, UDP=1)
    df['protocol_encoded'] = df['protocol'].map({'TCP': 0, 'UDP': 1})

    return df


def run_anomaly_detection(df, contamination=0.05):
    if isinstance(df, str):
        df = pd.read_csv(df)
        
    # Preprocess
    df = preprocess_data(df)

    # Select features
    features = [
        'port',
        'bytes_transferred',
        'failed_logins',
        'hour',
        'source_ip_encoded',
        'destination_ip_encoded',
        'protocol_encoded'
    ]

    # Ensure columns exist and fillna
    for feat in features:
        if feat not in df.columns:
            df[feat] = 0
            
    X = df[features].fillna(0)

    # Train Isolation Forest
    model = IsolationForest(contamination=contamination, random_state=42)
    model.fit(X)

    # Predict anomalies
    df['anomaly'] = model.predict(X) 
    #Model learning normal pattern structure
    
    df['anomaly_score'] = model.decision_function(X)
    # This shows Confidence % (How much the model is sure about the attack)
    
    # Convert anomaly score to confidence (0–100 scale)
    df['confidence'] = (1 - df['anomaly_score']) * 100 # converting anomaly score into a percentage-like value
    df['confidence'] = df['confidence'].clip(0, 100)
    # Isolation Forest gives: Negative score → highly anomalous
    # Positive score → normal

    # Convert (-1 → 1 suspicious, 1 → 0 normal)
    df['anomaly'] = df['anomaly'].map({1: 0, -1: 1})

    # Split data
    normal_logs = df[df['anomaly'] == 0]
    suspicious_logs = df[df['anomaly'] == 1]

    # Export results — create outputs dir if it doesn't exist
    # (Render's ephemeral filesystem won't have this pre-created)
    import os as _os_ad
    _out_dir = _os_ad.path.join(
        _os_ad.path.abspath(_os_ad.path.join(_os_ad.path.dirname(__file__), "..", "..", "..")),
        "outputs"
    )
    _os_ad.makedirs(_out_dir, exist_ok=True)
    try:
        normal_logs.to_csv(_os_ad.path.join(_out_dir, "normal_logs.csv"), index=False)
        suspicious_logs.to_csv(_os_ad.path.join(_out_dir, "suspicious_logs.csv"), index=False)
    except Exception as _e:
        print(f"[WARN] Could not write output CSVs: {_e}")  # non-fatal

    print("Anomaly detection completed.")
    print(f"Normal logs: {len(normal_logs)}")
    print(f"Suspicious logs: {len(suspicious_logs)}")
    print(df.columns)
    
    return df