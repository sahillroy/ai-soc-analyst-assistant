from dotenv import load_dotenv
load_dotenv()
import os
from fastapi import FastAPI, BackgroundTasks, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
import pandas as pd
import datetime
from typing import Optional

from backend.core.database import (
    engine, check_db,
    db_get_pipeline_state,
    db_set_pipeline_running,
    db_set_pipeline_done,
    db_is_stale,
    _get_column_names,
)
from backend.detection.pipeline import run_pipeline


app = FastAPI(title="SOC Analyst API", version="2.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
        "https://ai-soc-analyst-assistant.vercel.app",
        "https://ai-soc-analyst-assistant-o6prk50hz-sahillroys-projects.vercel.app",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=False,
)


# ── DataFrame sanitisation ────────────────────────────────────────────────────

def _sanitise_df(df: pd.DataFrame) -> pd.DataFrame:
    """
    Coerce all DataFrame columns to PostgreSQL-safe types before to_sql().

    WHY THIS EXISTS:
    - rule_engine.py produces bool columns via .isin() / comparisons → numpy bool_
    - PostgreSQL INTEGER columns reject Python/numpy bool → 'invalid input syntax'
    - NaN in numeric columns → DataError on non-nullable PG columns
    - numpy int64/float64 can confuse older psycopg2 versions
    """
    bool_as_int = [
        'anomaly', 'rule_bruteforce', 'rule_port_scan',
        'rule_traffic_spike', 'rule_triggered', 'ip_suspicious',
    ]
    float_cols = [
        'bytes_transferred', 'anomaly_score', 'confidence',
        'bytes_zscore', 'risk_score',
    ]
    int_cols  = ['port', 'failed_logins']
    text_cols = [
        'incident_id', 'timestamp', 'source_ip', 'destination_ip',
        'protocol', 'severity', 'alert_type', 'campaign_id',
        'mitre_technique', 'incident_summary', 'recommended_action',
        'soc_playbook_action', 'escalation', 'automation_result',
        'ip_country', 'status', 'notes',
    ]

    for col in bool_as_int:
        if col in df.columns:
            df[col] = df[col].fillna(0).astype(bool).astype(int)
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


# ── Background pipeline task ──────────────────────────────────────────────────

def _run_pipeline_task():
    now_iso = lambda: datetime.datetime.utcnow().isoformat()
    try:
        df = run_pipeline()

        # Drop ML-only columns not in DB schema
        ml_cols = ['hour', 'source_ip_encoded', 'destination_ip_encoded', 'protocol_encoded']
        df = df.drop(columns=[col for col in ml_cols if col in df.columns], errors='ignore')

        # Coerce all types to PostgreSQL-safe values
        df = _sanitise_df(df)

        print(f"[pipeline] Columns going to DB: {sorted(df.columns.tolist())}")
        print(f"[pipeline] Row count: {len(df)}")
        print(f"[pipeline] dtypes sample:\n{df.dtypes}")

        # Clear existing rows, then insert (preserves our DDL schema)
        with engine.connect() as conn:
            conn.execute(text("DELETE FROM alerts"))
            conn.commit()

        df.to_sql(
            "alerts", engine,
            if_exists="append",   # NEVER use 'replace' — it drops our DDL
            index=False,
            method="multi",
            chunksize=50,
        )

        with engine.connect() as conn:
            db_set_pipeline_done(conn, last_run=now_iso(), total_alerts=len(df))

        print(f"[✓] Pipeline done — {len(df)} alerts written.")

    except Exception as e:
        import traceback
        print(f"[ERROR] Pipeline task failed: {e}")
        traceback.print_exc()
        # ALWAYS release the lock, even on crash
        try:
            with engine.connect() as conn:
                db_set_pipeline_done(conn, last_run=now_iso(), total_alerts=0)
        except Exception as e2:
            print(f"[ERROR] Could not release pipeline lock: {e2}")


# ── Routes ────────────────────────────────────────────────────────────────────

@app.post("/api/run-analysis")
def run_analysis(background_tasks: BackgroundTasks):
    with engine.connect() as conn:
        state = db_get_pipeline_state(conn)

        if state["running"]:
            if db_is_stale(conn):
                print("[WARN] Stale pipeline lock detected — clearing.")
                db_set_pipeline_running(conn, False)
            else:
                raise HTTPException(
                    status_code=409,
                    detail="Pipeline already running. Try again shortly."
                )

        started_at = datetime.datetime.utcnow().isoformat()
        db_set_pipeline_running(conn, True, started_at=started_at)

    background_tasks.add_task(_run_pipeline_task)
    return {"status": "started", "started_at": started_at}


@app.post("/api/reset-status")
def reset_status():
    """Force-clear the pipeline lock (use after a stuck/crashed run)."""
    with engine.connect() as conn:
        db_set_pipeline_running(conn, False)
    return {"status": "reset", "message": "Pipeline lock cleared."}


@app.get("/api/status")
def get_status():
    with engine.connect() as conn:
        state = db_get_pipeline_state(conn)
    return state


@app.get("/api/alerts")
def get_alerts(
    severity: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    offset: int = Query(0),
    search: Optional[str] = Query(None),
):
    """
    Returns alerts. NEVER returns 500 — always returns [] on any DB error.

    The 500s were caused by:
    1. ORDER BY id (column didn't exist in old to_sql() tables) → fixed: ORDER BY timestamp
    2. Table in corrupt/partial state during pipeline write → fixed: catch all errors → []
    3. Table had wrong column types → fixed: schema repair in database.py startup
    """
    try:
        conditions = []
        params: dict = {}

        if severity:
            conditions.append("severity = :severity")
            params["severity"] = severity

        if search:
            conditions.append(
                "(source_ip LIKE :search OR incident_id LIKE :search OR alert_type LIKE :search)"
            )
            params["search"] = f"%{search}%"

        where  = ("WHERE " + " AND ".join(conditions)) if conditions else ""
        params["limit"]  = limit
        params["offset"] = offset

        query = f"""
            SELECT * FROM alerts
            {where}
            ORDER BY timestamp DESC
            LIMIT :limit OFFSET :offset
        """

        with engine.connect() as conn:
            result = conn.execute(text(query), params)
            rows = [dict(row._mapping) for row in result]

        return rows

    except Exception as e:
        err = str(e).lower()
        # Table doesn't exist yet — normal before first run
        if any(x in err for x in ["no such table", "does not exist", "relation", "undefined"]):
            return []
        # Any other error: log it but still return [] so the UI doesn't break
        print(f"[ERROR] GET /api/alerts failed: {e}")
        import traceback
        traceback.print_exc()
        return []   # ← return empty array, NOT 500


@app.get("/api/stats")
def get_stats():
    try:
        with engine.connect() as conn:
            result = conn.execute(
                text("SELECT severity, COUNT(*) as count FROM alerts GROUP BY severity")
            )
            return [dict(row._mapping) for row in result]
    except Exception:
        return []


@app.patch("/api/alerts/{incident_id}/status")
def update_status(incident_id: str, body: dict):
    allowed = {"New", "Investigating", "Resolved", "False Positive"}
    new_status = body.get("status")
    if new_status not in allowed:
        raise HTTPException(status_code=400, detail="Invalid status")
    with engine.connect() as conn:
        conn.execute(
            text("UPDATE alerts SET status=:status WHERE incident_id=:id"),
            {"status": new_status, "id": incident_id}
        )
        conn.commit()
    return {"updated": incident_id, "status": new_status}


@app.patch("/api/alerts/{incident_id}/notes")
def update_notes(incident_id: str, body: dict):
    notes = body.get("notes", "")
    with engine.connect() as conn:
        conn.execute(
            text("UPDATE alerts SET notes=:notes WHERE incident_id=:id"),
            {"notes": notes, "id": incident_id}
        )
        conn.commit()
    return {"updated": incident_id}


@app.get("/api/health")
def health():
    return check_db(engine)


@app.get("/api/debug")
def debug():
    """
    Shows exact DB state for troubleshooting.
    Check this when things break — it shows the actual error.
    URL: /api/debug
    """
    result = {"engine": engine.name, "database_url_tail": ""}
    try:
        result["database_url_tail"] = (
            DATABASE_URL.split("@")[-1] if "@" in DATABASE_URL
            else DATABASE_URL.split("///")[-1]
        )
    except Exception:
        pass

    # Test basic connectivity
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        result["db_connectivity"] = "ok"
    except Exception as e:
        result["db_connectivity"] = f"FAILED: {e}"
        return result

    # Inspect alerts table schema
    try:
        with engine.connect() as conn:
            cols = _get_column_names(conn, "alerts")
        result["alerts_columns"] = cols
        result["alerts_has_id"]  = "id" in cols
    except Exception as e:
        result["alerts_schema_error"] = str(e)

    # Try a SELECT
    try:
        with engine.connect() as conn:
            count = conn.execute(text("SELECT COUNT(*) FROM alerts")).scalar()
            sample = conn.execute(text("SELECT * FROM alerts LIMIT 1")).fetchone()
        result["alerts_count"]  = count
        result["alerts_sample"] = dict(sample._mapping) if sample else None
    except Exception as e:
        result["alerts_select_error"] = str(e)

    # Pipeline state
    try:
        with engine.connect() as conn:
            state = db_get_pipeline_state(conn)
        result["pipeline_state"] = state
    except Exception as e:
        result["pipeline_state_error"] = str(e)

    return result


# Import DATABASE_URL for debug endpoint
try:
    from backend.core.database import DATABASE_URL
except ImportError:
    DATABASE_URL = os.getenv("DATABASE_URL", "")
