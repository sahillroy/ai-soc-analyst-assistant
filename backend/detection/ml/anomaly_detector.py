import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
import ipaddress  # Convert IP string → numeric
import os

# Resolve project root relative to this file: backend/detection/ml/anomaly_detector.py
_PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ))


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


def run_anomaly_detection(input_file=None):
    if input_file is None:
        input_file = os.path.join(_PROJECT_ROOT, "data", "logs.csv")
    # Load data
    df = pd.read_csv(input_file)

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

    X = df[features]

    # Train Isolation Forest
    model = IsolationForest(contamination=0.05, random_state=42)
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

    # Export results (using absolute paths so they work on any server)
    os.makedirs(os.path.join(_PROJECT_ROOT, "outputs"), exist_ok=True)
    normal_logs.to_csv(os.path.join(_PROJECT_ROOT, "outputs", "normal_logs.csv"), index=False)
    suspicious_logs.to_csv(os.path.join(_PROJECT_ROOT, "outputs", "suspicious_logs.csv"), index=False)
    # Separated logs for SOC analyst review
    # index = False -> row labels (the index) are excluded when saving data to a file

    print("Anomaly detection completed.")
    print(f"Normal logs: {len(normal_logs)}")
    print(f"Suspicious logs: {len(suspicious_logs)}")
    print(df.columns)
    
    return df