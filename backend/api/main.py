from dotenv import load_dotenv
load_dotenv()
import os
from fastapi import FastAPI, BackgroundTasks, HTTPException, Query, UploadFile, File, Body
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

def _run_pipeline_task(config: dict = None):
    """
    config keys (all optional, fall back to defaults if None):
      bruteforce_threshold, port_scan_threshold, traffic_spike_z_score,
      ml_contamination, critical_assets (comma-separated string)
    """
    now_iso = lambda: datetime.datetime.utcnow().isoformat()
    cfg = config or {}
    print(f"[pipeline] Running with config: {cfg}")
    try:
        df = run_pipeline(config=cfg)

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

        total_alerts_written = len(df)
        print(f"[✓] Pipeline done — {total_alerts_written} alerts written.")

    except Exception as e:
        import traceback
        print(f"[ERROR] Pipeline task failed: {e}")
        traceback.print_exc()
        total_alerts_written = 0

    finally:
        # ALWAYS release the lock, even on crash or unhandled interrupt
        try:
            with engine.connect() as conn:
                db_set_pipeline_done(conn, last_run=now_iso(), total_alerts=total_alerts_written)
        except Exception as e2:
            print(f"[ERROR] Could not release pipeline lock: {e2}")


# ── Routes ────────────────────────────────────────────────────────────────────

@app.post("/api/run-analysis")
def run_analysis(
    background_tasks: BackgroundTasks,
    payload: dict = Body(default={}),
    bruteforce_threshold: int        = Query(5),
    port_scan_threshold: int         = Query(5),
    traffic_spike_z_score: float     = Query(3.0),
    contamination: float             = Query(0.05),
    ml_contamination: float          = Query(0.05),
    critical_assets: str             = Query("10.0.0.5"),
):
    final_contamination = contamination if contamination != 0.05 else ml_contamination
    config = {
        "bruteforce_threshold":   bruteforce_threshold,
        "port_scan_threshold":    port_scan_threshold,
        "traffic_spike_z_score":  traffic_spike_z_score,
        "ml_contamination":       final_contamination,
        "critical_assets":        critical_assets,
    }
    print(f"[API] /api/run-analysis called with config: {config}")

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

    background_tasks.add_task(_run_pipeline_task, config)
    return {"status": "started", "started_at": started_at, "config": config}


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


# ── Incident Report Endpoints ──────────────────────────────────────────────────

@app.get("/api/report/{incident_id}")
def get_incident_report(incident_id: str):
    """Returns a structured AI-generated JSON report for one incident."""
    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT * FROM alerts WHERE incident_id = :id"),
            {"id": incident_id}
        ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Incident not found")

    data = dict(row._mapping)
    return {
        "incident_id":    data.get("incident_id"),
        "summary":        data.get("incident_summary"),
        "recommendation": data.get("recommended_action"),
        "severity":       data.get("severity"),
        "risk_score":     data.get("risk_score"),
        "alert_type":     data.get("alert_type"),
        "source_ip":      data.get("source_ip"),
        "destination_ip": data.get("destination_ip"),
        "timestamp":      str(data.get("timestamp", "")),
        "mitre":          data.get("mitre_technique"),
        "soc_playbook":   data.get("soc_playbook_action"),
        "automation":     data.get("automation_result"),
        "escalation":     data.get("escalation"),
        "campaign_id":    data.get("campaign_id"),
        "notes":          data.get("notes", ""),
    }


@app.get("/api/report/export/csv")
def export_full_report_csv():
    """Returns a rich CSV report of all alerts with all AI-generated fields."""
    from fastapi.responses import Response

    try:
        with engine.connect() as conn:
            rows = conn.execute(text("SELECT * FROM alerts ORDER BY id DESC")).fetchall()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    if not rows:
        raise HTTPException(status_code=404, detail="No alerts found. Run Analysis first.")

    columns = [
        "incident_id", "timestamp", "source_ip", "destination_ip", "port", "protocol",
        "alert_type", "severity", "risk_score", "confidence", "campaign_id",
        "escalation", "status",
        "incident_summary", "recommended_action", "soc_playbook_action",
        "automation_result", "mitre_technique", "notes",
    ]

    def escape(val):
        s = str(val) if val is not None else ""
        return '"' + s.replace('"', '""') + '"'

    header = ",".join(columns)
    lines  = [header]
    for row in rows:
        d = dict(row._mapping)
        lines.append(",".join(escape(d.get(c, "")) for c in columns))

    csv_text = "\n".join(lines)

    return Response(
        content=csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=soc-ai-incident-report.csv"}
    )


# ── File Upload & Sample Data ─────────────────────────────────────────────────

@app.post("/api/upload-logs")
async def upload_logs(file: UploadFile = File(...)):
    """
    Accept a CSV log file upload. Saves to data/uploaded_logs.csv.
    Returns detected columns and row count.
    Auto-detects and validates required columns.
    """
    import shutil, os

    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are supported.")

    # Absolute path — Render workers may have different CWDs
    _root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    os.makedirs(os.path.join(_root, "data"), exist_ok=True)
    dest = os.path.join(_root, "data", "uploaded_logs.csv")

    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)

    try:
        df = pd.read_csv(dest)
    except Exception as e:
        os.remove(dest)
        raise HTTPException(status_code=400, detail=f"Could not parse CSV: {e}")

    # Try column mapping to check compatibility
    try:
        from backend.detection.column_mapper import map_columns
        mapped_df, mapping_report = map_columns(df.copy())
        columns_detected = list(df.columns)
        columns_mapped   = mapping_report
    except Exception:
        mapped_df        = df
        columns_detected = list(df.columns)
        columns_mapped   = {}

    # Validate minimum required columns after mapping
    required = {"source_ip", "destination_ip", "timestamp", "port", "bytes_transferred"}
    mapped_cols = set(mapped_df.columns)
    missing = required - mapped_cols

    if missing:
        os.remove(dest)
        raise HTTPException(
            status_code=400,
            detail=f"Missing required columns: {sorted(missing)}. "
                   f"Detected columns: {columns_detected}"
        )

    # VERY IMPORTANT: Save the mapped dataframe so the pipeline can actually use it
    try:
        mapped_df.to_csv(dest, index=False)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save mapped CSV: {e}")

    return {
        "success":          True,
        "rows":             len(df),
        "columns_detected": columns_detected,
        "columns_mapped":   columns_mapped,
        "message":          f"Uploaded {len(df)} rows successfully.",
    }


@app.get("/api/sample-data")
def load_sample_data():
    """
    Loads demo data for the pipeline.

    Strategy (in order):
    1. Try to copy data/logs.csv if it exists in the repo
    2. If not found (e.g. not committed to git, or path mismatch),
       GENERATE synthetic log data on the fly — no file dependency.

    This makes the endpoint work on any deployment regardless of
    whether logs.csv was committed and where the CWD is.
    """
    import os, shutil

    _root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    os.makedirs(os.path.join(_root, "data"), exist_ok=True)
    dst = os.path.join(_root, "data", "uploaded_logs.csv")

    # ── Try reading from committed logs.csv first ─────────────────────────
    # Check multiple candidate locations to be resilient to project structure
    candidates = [
        os.path.join(_root, "data", "logs.csv"),
        os.path.join(_root, "..", "data", "logs.csv"),
        os.path.join(os.getcwd(), "data", "logs.csv"),
        "data/logs.csv",
    ]
    src = next((p for p in candidates if os.path.exists(p)), None)

    if src:
        shutil.copy(src, dst)
        try:
            row_count = len(pd.read_csv(dst))
        except Exception:
            row_count = 550
        return {
            "success": True,
            "rows":    row_count,
            "source":  "file",
            "message": f"Demo data loaded ({row_count} rows)",
        }

    # ── Generate synthetic demo data on the fly ───────────────────────────
    # Runs when logs.csv isn't in the repo or isn't reachable.
    # Produces realistic network log data with embedded attack patterns.
    import random
    from datetime import datetime, timedelta

    random.seed(42)
    base_time    = datetime(2024, 1, 15, 8, 0, 0)
    internal_ips = [
        "10.0.0.1","10.0.0.2","10.0.0.3","10.0.0.4","10.0.0.5",
        "192.168.1.1","192.168.1.10","192.168.1.100","192.168.1.250",
    ]
    external_ips = [
        "203.0.113.5","198.51.100.23","185.220.101.47",
        "45.33.32.156","91.108.4.0","172.217.16.46","104.21.0.1",
    ]
    dest_ips = ["10.0.0.5","10.0.0.2","10.0.0.3","10.0.0.1"]

    rows = []
    for i in range(550):
        t          = base_time + timedelta(minutes=random.randint(0, 480))
        is_attack  = random.random() < 0.22
        attack_type = random.choice(["bruteforce","portscan","exfil","anomaly"])

        if is_attack:
            src_ip = random.choice(external_ips + ["192.168.1.250"])
            dst_ip = random.choice(dest_ips)
            if attack_type == "bruteforce":
                port, bytes_t, failed, proto = 22, random.randint(500,2000), random.randint(8,25), "TCP"
            elif attack_type == "portscan":
                port, bytes_t, failed, proto = random.randint(1,65535), random.randint(100,500), 0, "TCP"
            elif attack_type == "exfil":
                port, bytes_t, failed, proto = random.choice([80,443,8080]), random.randint(50000,500000), 0, random.choice(["TCP","UDP"])
            else:
                port, bytes_t, failed, proto = random.randint(1024,9999), random.randint(1000,10000), random.randint(0,3), random.choice(["TCP","UDP"])
        else:
            src_ip  = random.choice(internal_ips)
            dst_ip  = random.choice(dest_ips)
            port    = random.choice([80, 443, 22, 3306, 5432, 8080])
            bytes_t = random.randint(200, 8000)
            failed  = random.randint(0, 1)
            proto   = random.choice(["TCP", "UDP"])

        rows.append({
            "timestamp":         t.strftime("%Y-%m-%d %H:%M:%S"),
            "source_ip":         src_ip,
            "destination_ip":    dst_ip,
            "port":              port,
            "protocol":          proto,
            "bytes_transferred": bytes_t,
            "failed_logins":     failed,
        })

    demo_df = pd.DataFrame(rows)
    demo_df.to_csv(dst, index=False)

    return {
        "success": True,
        "rows":    len(demo_df),
        "source":  "generated",
        "message": f"Demo data generated ({len(demo_df)} rows with realistic attack patterns)",
    }
