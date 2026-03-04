
import pandas as pd


def detect_bruteforce(df, threshold=10):
    df['rule_bruteforce'] = df['failed_logins'] > threshold
    # This creates a new column: rule bruteforce is true if failed login is more than threshold(10), false otherwise
    return df
# Detect brute force attack: If failed_logins > threshold 
# This catches SSH brute force attempts


def detect_port_scan(df, port_threshold=10):
    port_counts = df.groupby('source_ip')['port'].nunique()
    suspicious_ips = port_counts[port_counts > port_threshold].index

    df['rule_port_scan'] = df['source_ip'].isin(suspicious_ips)
    # Mark those IPs as suspicious
    return df
# Detect port scanning: If same source_ip hits more than X unique ports
# This is Port Scanning Attack

def detect_traffic_spike(df, byte_threshold=10000):

    df['rule_traffic_spike'] = df['bytes_transferred'] > byte_threshold
    return df
# Detect high data transfer (possible exfiltration)

def apply_rules(df):
    df = detect_bruteforce(df)
    df = detect_port_scan(df)
    df = detect_traffic_spike(df)
    # Making these functions as Dataframe for combining

    # Combine rule results
    df['rule_triggered'] = (
        df['rule_bruteforce'] |
        df['rule_port_scan'] |
        df['rule_traffic_spike']
    )
    # Combined using | (OR)
    # if ANY rule is true: → rule_triggered = True
    
    df = assign_severity(df) # Defining based of severity(Low,medium,high) 
    df = assign_alert_type(df) # Shows name of attack in alert

    return df

def assign_severity(df):
    # Assigning severity based on rule + anomaly

    severity = []

    for _, row in df.iterrows():

        if row['rule_bruteforce']:
            severity.append("High")

        elif row['rule_port_scan']:
            severity.append("Medium")

        elif row['rule_traffic_spike']:
            severity.append("Medium")

        elif row['anomaly'] == 1:
            severity.append("Low")

        else:
            severity.append("Normal")

    df['severity'] = severity
    return df
# This functions shows severity(Low, Medium, High)

def assign_alert_type(df):
    # Assign alert type based on triggered rule
    
    alert_type = []

    for _, row in df.iterrows():

        if row['rule_bruteforce']:
            alert_type.append("Brute Force Attempt")

        elif row['rule_port_scan']:
            alert_type.append("Port Scanning Activity")

        elif row['rule_traffic_spike']:
            alert_type.append("Traffic Spike / Possible Exfiltration")

        elif row['anomaly'] == 1:
            alert_type.append("Behavioral Anomaly")

        else:
            alert_type.append("Normal Activity")

    df['alert_type'] = alert_type
    return df
#This will show type of Attack in alert