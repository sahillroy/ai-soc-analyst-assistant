"""
services/pipeline_service.py — Background pipeline execution service

Orchestrates the SOC detection pipeline as a background task.
This isolates heavy processing from the API layer so routes stay thin.

Flow:
  1. Run full SOC pipeline (ML + Rules + Enrichment)
  2. Sanitise DataFrame for PostgreSQL compatibility
  3. Write alerts to DB
  4. Release pipeline lock (always — even on failure)
"""
import datetime
import traceback
import pandas as pd
from sqlalchemy import text

from backend.core.database import engine, db_set_pipeline_done
from backend.detection.pipeline import run_pipeline


def _sanitise_df(df: pd.DataFrame) -> pd.DataFrame:
    """
    Coerce all DataFrame columns to PostgreSQL-safe types before to_sql().

    - bool/numpy bool_ → int (0/1)  — psycopg2 rejects bool in INTEGER columns
    - NaN in numeric cols → 0       — prevents DataError on non-nullable columns
    - All text cols → str            — avoids None type confusion
    """
    bool_as_int = [
        "anomaly", "rule_bruteforce", "rule_port_scan",
        "rule_traffic_spike", "rule_triggered", "ip_suspicious",
    ]
    float_cols = ["bytes_transferred", "anomaly_score", "confidence", "bytes_zscore", "risk_score"]
    int_cols   = ["port", "failed_logins"]
    text_cols  = [
        "incident_id", "timestamp", "source_ip", "destination_ip",
        "protocol", "severity", "alert_type", "campaign_id",
        "mitre_technique", "incident_summary", "recommended_action",
        "soc_playbook_action", "escalation", "automation_result",
        "ip_country", "status", "notes",
    ]

    for col in bool_as_int:
        if col in df.columns:
            df[col] = df[col].fillna(0).astype(bool).astype(int)
    for col in float_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)
    for col in int_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0).astype(int)
    for col in text_cols:
        if col in df.columns:
            df[col] = df[col].fillna("").astype(str)

    return df


def run_pipeline_on_logs(logs: list, settings: dict):
    """
    Run the detection pipeline on user-uploaded logs.
    Passes the DataFrame IN-MEMORY via config to avoid file I/O race conditions.
    No temp file needed — uploaded data goes directly into the pipeline.
    """
    print(f"[Sentinel] run_pipeline_on_logs called with {len(logs)} rows")
    try:
        df_input = pd.DataFrame(logs)
        print(f"[Sentinel] DataFrame built: {len(df_input)} rows, cols: {df_input.columns.tolist()}")
        # Inject the DataFrame directly into config — pipeline.py checks for _input_df first
        cfg = {**settings, "_input_df": df_input}
        run_pipeline_background(cfg)
    except Exception as e:
        print(f"[Sentinel] run_pipeline_on_logs ERROR: {e}")
        traceback.print_exc()
        try:
            from backend.core.database import db_set_pipeline_running
            with engine.connect() as conn:
                db_set_pipeline_running(conn, False)
        except Exception:
            pass


def run_pipeline_background(config: dict = None):
    """
    Entry point for FastAPI BackgroundTasks.

    The try/finally guarantees the pipeline lock is ALWAYS released,
    even if the pipeline crashes mid-execution.
    """
    now_iso = lambda: datetime.datetime.utcnow().isoformat()
    cfg = config or {}
    print(f"[pipeline-service] Starting with config keys: {[k for k in cfg.keys()]}")
    total_alerts_written = 0

    try:
        df = run_pipeline(config=cfg)

        # Drop ML-internal columns not in DB schema
        ml_only = ["hour", "source_ip_encoded", "destination_ip_encoded", "protocol_encoded"]
        df = df.drop(columns=[c for c in ml_only if c in df.columns], errors="ignore")

        df = _sanitise_df(df)

        print(f"[pipeline-service] Writing {len(df)} alerts to DB...")
        print(f"[pipeline-service] Columns: {sorted(df.columns.tolist())}")

        # Clear-then-append preserves our DDL schema (NEVER use if_exists='replace')
        with engine.connect() as conn:
            conn.execute(text("DELETE FROM alerts"))
            conn.commit()

        df.to_sql("alerts", engine, if_exists="append", index=False, method="multi", chunksize=50)

        total_alerts_written = len(df)
        print(f"[✓] Pipeline complete — {total_alerts_written} alerts written.")

    except Exception as e:
        print(f"[ERROR] Pipeline failed: {e}")
        traceback.print_exc()
        total_alerts_written = 0

    finally:
        # Lock is released regardless of success or failure
        try:
            with engine.connect() as conn:
                db_set_pipeline_done(conn, last_run=now_iso(), total_alerts=total_alerts_written)
        except Exception as e2:
            print(f"[ERROR] Could not release pipeline lock: {e2}")
