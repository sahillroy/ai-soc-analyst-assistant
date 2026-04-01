import pandas as pd
import json
import uuid

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


def generate_incident_id():
    return "INC-" + str(uuid.uuid4())[:8].upper()


import os as _os
_PROJECT_ROOT = _os.path.abspath(_os.path.join(_os.path.dirname(__file__), "..", ".."))


def run_pipeline(input_path=None):
    if input_path is None:
        input_path = _os.path.join(_PROJECT_ROOT, "data", "logs.csv")
    print("[+] Starting SOC pipeline...")

    # Step 1 — ML anomaly detection (returns full df with anomaly column)
    df = run_anomaly_detection(input_path)
    print(f"[1] Anomaly detection done. Total rows: {len(df)}")

    # Step 2 — Rule-based detection
    df = apply_rules(df)
    print(f"[2] Rules applied.")

    # Step 3 — Severity scoring
    df = assign_severity_scored(df)
    print(f"[3] Severity scored.")

    # Step 4 — Alert classification
    df = assign_alert_type(df)
    print(f"[4] Alert types assigned.")

    # ── FILTER TO SUSPICIOUS ROWS ONLY ────────────────────────────────────────
    # This is the critical fix. Without this, enrichment runs on all 550 rows
    # including normal traffic — causing 27+ min hangs from ip_reputation calls.
    suspicious = df[
        (df['anomaly'] == 1) | (df['rule_triggered'] == True)
    ].copy().reset_index(drop=True)

    print(f"[5] Filtered to {len(suspicious)} suspicious rows (was {len(df)} total).")

    if len(suspicious) == 0:
        print("[!] No suspicious activity detected.")
        return suspicious

    # Step 5 — Correlation (run on suspicious rows only — much faster)
    suspicious = correlate_alerts(suspicious)
    print(f"[6] Correlation done.")

    # Step 6 — Enrichment (LLM + IP rep + MITRE — suspicious rows only)
    suspicious = enrich_alerts(suspicious)
    print(f"[✓] Pipeline completed. {len(suspicious)} alerts.")

    return suspicious


def enrich_alerts(df):
    summaries        = []
    recommendations  = []
    mitre_list       = []
    responses        = []
    incident_ids     = []
    escalations      = []
    automation_logs  = []
    countries        = []
    ip_flags         = []

    total = len(df)

    for i, (_, row) in enumerate(df.iterrows()):
        print(f"  Enriching row {i+1}/{total} — {row.get('source_ip', '?')} [{row.get('alert_type', '?')}]")

        # ---- LLM summary (only for High/Critical — gated inside llm_summarizer) ----
        try:
            llm_output = generate_llm_summary(row)
            summaries.append(llm_output.get("summary", ""))
            recommendations.append(llm_output.get("action", ""))
        except Exception as e:
            print(f"    [!] LLM failed: {e}")
            desc, rec = generate_summary(row)
            summaries.append(desc)
            recommendations.append(rec)

        # ---- MITRE mapping ----
        mitre_list.append(json.dumps(map_to_mitre(row['alert_type'])))

        # ---- SOC playbook ----
        responses.append(recommend_response(row['severity']))

        # ---- Incident ID ----
        incident_ids.append(generate_incident_id())

        # ---- Threat Intel (private IPs return immediately — no network call) ----
        intel = check_ip_reputation(row['source_ip'])
        countries.append(intel.get('country', 'Unknown'))
        ip_flags.append(intel.get('is_suspicious', False))

        # ---- Escalation ----
        if row['severity'] in ["High", "Critical"] and row['confidence'] > 85:
            escalations.append("Escalated to Tier-2")
        else:
            escalations.append("Under Review")

        # ---- Automation simulation ----
        automation_logs.append(simulate_response(row))

    df['incident_summary']    = summaries
    df['recommended_action']  = recommendations
    df['mitre_technique']     = mitre_list
    df['soc_playbook_action'] = responses
    df['incident_id']         = incident_ids
    df['escalation']          = escalations
    df['automation_result']   = automation_logs
    df['status']              = "New"
    df['ip_country']          = countries
    df['ip_suspicious']       = ip_flags

    return df
