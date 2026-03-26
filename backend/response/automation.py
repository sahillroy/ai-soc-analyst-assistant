def simulate_response(row):
    severity = row['severity']
    ip = row['source_ip']

    if severity == "Critical":
        return f"[CRITICAL] Host isolated. Firewall block + EDR quarantine triggered for {ip}."
    elif severity == "High":
        return f"Firewall rule created to block IP {ip}."
    elif severity == "Medium":
        return f"Monitoring rule activated for IP {ip}."
    elif severity == "Low":
        return f"Alert logged for {ip}. Added to watchlist."
    return "No automated action taken."