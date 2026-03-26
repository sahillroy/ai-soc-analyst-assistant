import pandas as pd

# Detection
from backend.detection.rule_engine import apply_rules, assign_alert_type
from backend.detection.severity_engine import assign_severity_scored
from backend.detection.correlator import correlate_alerts
from backend.detection.ml.anomaly_detector import run_anomaly_detection

# Enrichment
from backend.enrichment.llm_summarizer import generate_llm_summary
from backend.enrichment.incident_summary import generate_summary
from backend.enrichment.mitre import map_to_mitre
from backend.enrichment.ip_reputation import check_ip_reputation

# Response
from backend.response.playbook import recommend_response
from backend.response.automation import simulate_response

import uuid
import json


# 🔹 Incident ID generator
def generate_incident_id():
    return "INC-" + str(uuid.uuid4())[:8].upper()


# 🔹 MAIN PIPELINE
def run_pipeline(input_path="data/logs.csv"):
    print("[+] Starting SOC pipeline...")

    # Step 2 — ML anomaly detection
    df = run_anomaly_detection(input_path)

    # Step 3 — Rule-based detection
    df = apply_rules(df)

    # Step 4 — Severity scoring
    df = assign_severity_scored(df)

    # Step 5 — Alert classification
    df = assign_alert_type(df)

    # Step 6 — Correlation
    df = correlate_alerts(df)

    # Step 7 — Enrichment
    df = enrich_alerts(df)

    print(f"[✓] Pipeline completed. Total alerts: {len(df)}")

    return df


# 🔹 ENRICHMENT LAYER
def enrich_alerts(df):
    summaries = []
    recommendations = []
    mitre_list = []
    responses = []
    incident_ids = []
    escalations = []
    automation_logs = []
    countries = []
    ip_flags = []

    for _, row in df.iterrows():
        # ---- LLM / fallback summary ----
        try:
            llm_output = generate_llm_summary(row)

            summary = llm_output.get("summary", "")
            action = llm_output.get("action", "")

        except Exception:
            summary, action = generate_summary(row)

        summaries.append(summary)
        recommendations.append(action)

        # ---- MITRE mapping ----
        mitre = map_to_mitre(row['alert_type'])
        mitre_list.append(json.dumps(mitre))

        # ---- SOC response ----
        responses.append(recommend_response(row['severity']))

        # ---- Incident ID ----
        incident_ids.append(generate_incident_id())

        # ---- Threat Intel ----
        intel = check_ip_reputation(row['source_ip'])

        countries.append(intel.get('country', 'Unknown'))
        ip_flags.append(intel.get('is_suspicious', False))

        # ---- Escalation logic ----
        if row['severity'] in ["High", "Critical"] and row['confidence'] > 85:
            escalations.append("Escalated to Tier-2")
        else:
            escalations.append("Under Review")

        # ---- Automation ----
        automation_logs.append(simulate_response(row))

    # 🔹 Assign back to DataFrame
    df['incident_summary'] = summaries
    df['recommended_action'] = recommendations
    df['mitre_technique'] = mitre_list
    df['soc_playbook_action'] = responses
    df['incident_id'] = incident_ids
    df['escalation'] = escalations
    df['automation_result'] = automation_logs
    df['status'] = ["New"] * len(df)
    df['ip_country'] = countries
    df['ip_suspicious'] = ip_flags

    return df