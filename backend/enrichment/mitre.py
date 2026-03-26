# rules/mitre_mapping.py — production-grade version

MITRE_TECHNIQUES = {
    "Brute Force Attempt": {
        "technique_id": "T1110",
        "technique_name": "Brute Force",
        "tactic": "Credential Access",
        "tactic_id": "TA0006",
        "sub_technique": "T1110.001",
        "sub_technique_name": "Password Guessing",
        "description": "Adversary attempts to gain access by systematically checking passwords.",
        "mitre_url": "https://attack.mitre.org/techniques/T1110/",
        "detection_guidance": "Monitor authentication logs for repeated failures from single source.",
        "mitigations": ["M1036 - Account Use Policies", "M1032 - Multi-factor Authentication"]
    },
    "Port Scanning Activity": {
        "technique_id": "T1046",
        "technique_name": "Network Service Discovery",
        "tactic": "Discovery",
        "tactic_id": "TA0007",
        "description": "Adversary enumerates services running on remote hosts.",
        "mitre_url": "https://attack.mitre.org/techniques/T1046/",
        "detection_guidance": "Detect rapid port sweep patterns from a single source IP.",
        "mitigations": ["M1031 - Network Intrusion Prevention", "M1030 - Network Segmentation"]
    },
    "Traffic Spike / Possible Exfiltration": {
        "technique_id": "T1041",
        "technique_name": "Exfiltration Over C2 Channel",
        "tactic": "Exfiltration",
        "tactic_id": "TA0010",
        "description": "Data exfiltrated over the existing C2 channel.",
        "mitre_url": "https://attack.mitre.org/techniques/T1041/",
        "detection_guidance": "Baseline outbound traffic and alert on statistical deviations.",
        "mitigations": ["M1031 - Network Intrusion Prevention", "M1057 - Data Loss Prevention"]
    },
    "Behavioral Anomaly": {
        "technique_id": "T1562",
        "technique_name": "Impair Defenses",
        "tactic": "Defense Evasion",
        "tactic_id": "TA0005",
        "description": "Adversary modifies system or network defenses to evade detection.",
        "mitre_url": "https://attack.mitre.org/techniques/T1562/",
        "detection_guidance": "ML-detected deviation from behavioral baseline.",
        "mitigations": ["M1038 - Execution Prevention", "M1022 - Restrict File and Directory Permissions"]
    }
}

def map_to_mitre(alert_type):
    tech = MITRE_TECHNIQUES.get(alert_type)
    if not tech:
        return {"technique_id": "Unknown", "tactic": "Unknown"}
    return tech

def get_mitre_summary(alert_type):
    """Returns compact string for dashboard display"""
    tech = MITRE_TECHNIQUES.get(alert_type, {})
    tid = tech.get("technique_id", "N/A")
    tname = tech.get("technique_name", "Unknown")
    tactic = tech.get("tactic", "")
    return f"{tid} · {tname} [{tactic}]"