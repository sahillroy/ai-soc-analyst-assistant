def map_to_mitre(alert_type):

    mapping = {
        "Brute Force Attempt": "T1110 - Brute Force",
        "Port Scanning Activity": "T1046 - Network Service Discovery",
        "Traffic Spike / Possible Exfiltration": "T1041 - Exfiltration Over C2 Channel",
        "Behavioral Anomaly": "T1562 - Defense Evasion"
    }

    return mapping.get(alert_type, "Unknown Technique")