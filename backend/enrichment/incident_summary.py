def generate_summary(row):
    # Generate intelligent SOC-style incident summary

    source_ip = row['source_ip']
    destination_ip = row['destination_ip']
    port = row['port']
    failed_logins = row['failed_logins']
    bytes_transferred = row['bytes_transferred']
    severity = row['severity']
    confidence = round(row['confidence'], 2) # Rounding off to 2 decimal values
    # Extracting important fields from the DataFrame row

    indicators = []
    reasoning = []
    # Lists is created

    # Rule-based indicators
    if row.get('rule_bruteforce'):
        indicators.append("Multiple failed login attempts")
        reasoning.append(f"{failed_logins} failed authentication attempts detected")

    if row.get('rule_port_scan'):
        indicators.append("Port scanning behavior")
        reasoning.append("Multiple destination ports were targeted")

    if row.get('rule_traffic_spike'):
        indicators.append("Unusual data transfer volume")
        reasoning.append(f"Data transfer of {bytes_transferred} bytes observed")

    # If only ML anomaly triggered
    if not indicators and row['anomaly'] == 1:
        indicators.append("Behavioral anomaly")
        reasoning.append("Activity deviates from baseline network patterns")

    indicator_text = ", ".join(indicators)
    reasoning_text = "; ".join(reasoning)
    # If multiple triggers exist we are joining it

    description = (
        f"A {severity} severity security event was detected involving "
        f"source IP {source_ip} targeting {destination_ip} on port {port}. "
        f"Indicators observed: {indicator_text}. "
        f"Technical details: {reasoning_text}. "
        f"Model confidence level: {confidence}%."
    )
    # creates a complete structured SOC alert of report

    # Dynamic recommendation
    if severity == "High":
        recommendation = "Immediately block the source IP and initiate incident response investigation."

    elif severity == "Medium":
        recommendation = "Monitor activity closely and review related system logs."

    elif severity == "Low":
        recommendation = "Perform manual log review to confirm anomalous behavior."

    else:
        recommendation = "No immediate action required."
    # decide action based on severity(Priority Based)

    return description, recommendation