import pandas as pd
import numpy as np
import json
import uuid
import os as _os

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


_PROJECT_ROOT = _os.path.abspath(_os.path.join(_os.path.dirname(__file__), "..", ".."))


def generate_incident_id():
    return "INC-" + str(uuid.uuid4())[:8].upper()


# ── Type sanitisation ─────────────────────────────────────────────────────────

def _coerce_bool_columns(df: pd.DataFrame) -> pd.DataFrame:
    """
    Convert all bool/numpy bool_ columns to plain Python int (0/1).

    WHY: rule_engine.py produces boolean columns via .isin() and comparison
    operators (e.g. df['bytes_zscore'] > z_threshold). These come out as
    numpy bool_ dtype. PostgreSQL expects INTEGER for those columns and
    psycopg2 raises:
        'invalid input syntax for type integer: True'
    This must run BEFORE any DB write and BEFORE the suspicious-row filter
    so that the filter comparison (== 1, == True) works reliably too.
    """
    bool_cols = [
        'anomaly', 'rule_bruteforce', 'rule_port_scan',
        'rule_traffic_spike', 'rule_triggered', 'ip_suspicious',
    ]
    for col in bool_cols:
        if col in df.columns:
            df[col] = df[col].fillna(0).astype(bool).astype(int)
    return df


def _coerce_numeric_columns(df: pd.DataFrame) -> pd.DataFrame:
    """
    Ensure float/int columns have no NaN and correct Python types.
    NaN in a non-nullable PostgreSQL column raises DataError.
    """
    float_cols = ['bytes_transferred', 'anomaly_score', 'confidence',
                  'bytes_zscore', 'risk_score']
    int_cols   = ['port', 'failed_logins']
    text_cols  = [
        'incident_id', 'timestamp', 'source_ip', 'destination_ip',
        'protocol', 'severity', 'alert_type', 'campaign_id',
        'mitre_technique', 'incident_summary', 'recommended_action',
        'soc_playbook_action', 'escalation', 'automation_result',
        'ip_country', 'status', 'notes',
    ]

    for col in float_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0.0)

    for col in int_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0).astype(int)

    for col in text_cols:
        if col in df.columns:
            df[col] = df[col].fillna('').astype(str)

    return df


# ── Pipeline ──────────────────────────────────────────────────────────────────

def run_pipeline(input_path=None, config=None):
    cfg = config or {}

    bruteforce_threshold  = int(cfg.get("bruteforce_threshold",  5))
    port_scan_threshold   = int(cfg.get("port_scan_threshold",   5))
    traffic_spike_z_score = float(cfg.get("traffic_spike_z_score", 3.0))
    ml_contamination      = float(cfg.get("ml_contamination",    0.05))
    critical_assets       = str(cfg.get("critical_assets",       "10.0.0.5"))

    print("[+] Starting SOC pipeline...")
    print(f"    bruteforce_threshold={bruteforce_threshold}, port_scan_threshold={port_scan_threshold}")
    print(f"    traffic_spike_z_score={traffic_spike_z_score}, ml_contamination={ml_contamination}")
    print(f"    critical_assets={critical_assets}")

    # Step 1 — Load data: in-memory DataFrame takes priority over file I/O
    try:
        from backend.detection.column_mapper import map_columns

        # PRIORITY 1: in-memory DataFrame from uploaded logs
        if "_input_df" in cfg:
            raw_df = cfg["_input_df"].copy()
            print(f"[1a] Using in-memory uploaded DataFrame: {len(raw_df)} rows")

        # PRIORITY 2: file fallback
        else:
            if input_path is None:
                uploaded = _os.path.join(_PROJECT_ROOT, "data", "uploaded_logs.csv")
                default  = _os.path.join(_PROJECT_ROOT, "data", "logs.csv")
                input_path = uploaded if _os.path.exists(uploaded) else default
            print(f"[1a] Loading from file: {input_path}")
            from backend.detection.log_parser import parse_logs
            raw_df = parse_logs(input_path)

        raw_df, mapping_report = map_columns(raw_df)
        if mapping_report:
            print(f"[1b] Column mapping: {mapping_report}")
        df = run_anomaly_detection(raw_df, contamination=ml_contamination)

    except Exception as _parse_err:
        print(f"[WARN] Pipeline load failed ({_parse_err}), falling back to file")
        if input_path is None:
            uploaded = _os.path.join(_PROJECT_ROOT, "data", "uploaded_logs.csv")
            default  = _os.path.join(_PROJECT_ROOT, "data", "logs.csv")
            input_path = uploaded if _os.path.exists(uploaded) else default
        df = run_anomaly_detection(input_path, contamination=ml_contamination)

    print(f"[1] Anomaly detection done. Rows: {len(df)}")

    # Step 2 — Rule-based detection
    df = apply_rules(df,
        bruteforce_threshold=bruteforce_threshold,
        port_scan_threshold=port_scan_threshold,
        traffic_spike_z_score=traffic_spike_z_score,
    )
    print(f"[2] Rules applied.")

    # Step 3 — Coerce bool columns to int RIGHT AFTER rule engine runs.
    df = _coerce_bool_columns(df)
    print(f"[3] Bool columns coerced to int.")

    # Step 4 — Severity scoring
    df = assign_severity_scored(df, critical_assets=critical_assets)
    print(f"[4] Severity scored.")

    # Step 5 — Alert classification
    df = assign_alert_type(df)
    print(f"[5] Alert types assigned.")

    # Step 6 — Filter to suspicious rows only
    suspicious = df[
        (df['anomaly'] == 1) | (df['rule_triggered'] == 1)
    ].copy().reset_index(drop=True)
    suspicious = suspicious.head(20)  # cap for free-tier LLM budget
    print(f"[6] Filtered to {len(suspicious)} suspicious rows (was {len(df)} total).")

    if len(suspicious) == 0:
        print("[!] No suspicious activity detected.")
        return suspicious

    # Step 7 — Correlation
    suspicious = correlate_alerts(suspicious)
    print(f"[7] Correlation done.")

    # Step 8 — Enrichment
    suspicious = enrich_alerts(suspicious)

    # Step 9 — Final type coercion (enrichment adds ip_suspicious as bool etc.)
    suspicious = _coerce_bool_columns(suspicious)
    suspicious = _coerce_numeric_columns(suspicious)

    print(f"[✓] Pipeline completed. {len(suspicious)} alerts ready.")
    return suspicious


# ── Enrichment ────────────────────────────────────────────────────────────────

def enrich_alerts(df):
    summaries        = []
    recommendations  = []
    mitre_list       = []
    responses        = []
    incident_ids     = []
    escalations      = []
    automation_logs  = []
    countries        = []
    ip_flags         = []  # collected as int (0/1) from the start

    total = len(df)

    for i, (_, row) in enumerate(df.iterrows()):
        print(f"  Enriching {i+1}/{total} — {row.get('source_ip','?')} [{row.get('alert_type','?')}]")

        # ── MITRE (before LLM so summary can reference technique) ────────────
        mitre = json.dumps(map_to_mitre(row['alert_type']))
        mitre_list.append(mitre)

        row = row.copy()
        row['mitre_technique'] = mitre

        # ── Local Rule-Based Summary ─────────────────────────────────────────
        try:
            desc, rec = generate_summary(row)
            summaries.append(desc)
            recommendations.append(rec)
        except Exception as e2:
            print(f"    [!] Fallback summary failed: {e2}")
            summaries.append("No summary available.")
            recommendations.append("Manual investigation required.")

        # ── SOC playbook ─────────────────────────────────────────────────────
        try:
            responses.append(recommend_response(row['severity']))
        except Exception:
            responses.append("")

        # ── Incident ID ──────────────────────────────────────────────────────
        incident_ids.append(generate_incident_id())

        # ── IP reputation ────────────────────────────────────────────────────
        try:
            intel = check_ip_reputation(row['source_ip'])
        except Exception as e:
            print(f"    [!] IP check failed: {e}")
            intel = {"country": "Unknown", "is_suspicious": False}
        countries.append(intel.get('country', 'Unknown') or 'Unknown')
        ip_flags.append(1 if intel.get('is_suspicious', False) else 0)

        # ── Escalation ───────────────────────────────────────────────────────
        try:
            conf = float(row.get('confidence', 0))
            sev  = str(row.get('severity', ''))
            escalations.append(
                "Escalated to Tier-2" if sev in ("High", "Critical") and conf > 85
                else "Under Review"
            )
        except Exception:
            escalations.append("Under Review")

        # ── Automation ───────────────────────────────────────────────────────
        try:
            automation_logs.append(simulate_response(row))
        except Exception:
            automation_logs.append("")

    df = df.copy()
    df['incident_summary']    = summaries
    df['recommended_action']  = recommendations
    df['mitre_technique']     = mitre_list
    df['soc_playbook_action'] = responses
    df['incident_id']         = incident_ids
    df['escalation']          = escalations
    df['automation_result']   = automation_logs
    df['status']              = "New"
    df['ip_country']          = countries
    df['ip_suspicious']       = ip_flags  # already int

    # ── AI Aggregated Tactical Summary ──────────────────────────────────
    try:
        from backend.enrichment.llm_summarizer import generate_tactical_summary
        tactical_abstract = generate_tactical_summary(df.to_dict('records'))
        
        # Prepend to High/Critical alerts so it shows in the "AI Tactical Summary" box
        def prepend_tactical(row):
            if row['severity'] in ['High', 'Critical']:
                return f"{tactical_abstract}\n\n[Analyst Detail] {row['incident_summary']}"
            return row['incident_summary']

        df['incident_summary'] = df.apply(prepend_tactical, axis=1)
        print(f"[AI] Successfully injected aggregated tactical summary into {len(df[df['severity'].isin(['High','Critical'])])} alerts.")
    except Exception as e:
        print(f"[!] Aggregated tactical summary failed: {e}")

    return df
