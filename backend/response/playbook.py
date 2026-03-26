def recommend_response(severity):
    playbooks = {
        "Critical": "IMMEDIATE: Isolate affected host, revoke credentials, notify CISO, open P1 incident.",
        "High": "Immediate containment required. Block IP and escalate to Tier-2.",
        "Medium": "Monitor closely and review firewall logs within 4 hours.",
        "Low": "Log for review and baseline analysis within 24 hours.",
    }
    return playbooks.get(severity, "No action required.")