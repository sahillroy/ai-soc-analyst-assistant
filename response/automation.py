def simulate_response(row):

    if row['severity'] == "High":
        return f"Firewall rule created to block IP {row['source_ip']}."

    elif row['severity'] == "Medium":
        return f"Monitoring rule activated for IP {row['source_ip']}."

    return "Logged for baseline tracking."