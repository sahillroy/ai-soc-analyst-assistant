def recommend_response(severity):

    if severity == "High":
        return "Immediate containment required. Block IP and escalate to Tier-2."

    elif severity == "Medium":
        return "Monitor closely and review firewall logs."

    elif severity == "Low":
        return "Log for review and baseline analysis."

    return "No action required."