from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, BackgroundTasks, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
import pandas as pd
from typing import Optional

from backend.core.database import engine, check_db
from backend.detection.pipeline import run_pipeline


app = FastAPI(title="SOC Analyst API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://ai-soc-analyst-assistant.vercel.app",
        "https://ai-soc-analyst-assistant-o6prk50hz-sahillroys-projects.vercel.app",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


pipeline_status = {"running": False, "last_run": None, "total_alerts": 0}


def _run_pipeline_task():
    pipeline_status["running"] = True
    try:
        df = run_pipeline()
        
        # In PostgreSQL, `to_sql(replace)` drops custom table definitions (e.g. SERIAL PRIMARY KEY)
        # So we clear the table first, then append the new AI analysis
        with engine.connect() as conn:
            conn.execute(text("DELETE FROM alerts"))
            conn.commit()
            
        df.to_sql("alerts", engine, if_exists="append", index=False)
        pipeline_status["total_alerts"] = len(df)
        pipeline_status["last_run"] = pd.Timestamp.now().isoformat()
        print(f"[✓] Pipeline done. {len(df)} alerts written to DB.")
    except Exception as e:
        print(f"[ERROR] Pipeline failed: {e}")
        import traceback
        traceback.print_exc()
    finally:
        pipeline_status["running"] = False


@app.post("/api/run-analysis")
def run_analysis(background_tasks: BackgroundTasks):
    if pipeline_status["running"]:
        raise HTTPException(status_code=409, detail="Pipeline already running")
    background_tasks.add_task(_run_pipeline_task)
    return {"status": "started", "message": "Pipeline running in background"}


@app.get("/api/status")
def get_status():
    return pipeline_status


@app.get("/api/alerts")
def get_alerts(
    severity: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    offset: int = Query(0),
    search: Optional[str] = Query(None),
):
    try:
        # Parameterized query — safe from SQL injection
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

        where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
        params["limit"]  = limit
        params["offset"] = offset

        query = f"SELECT * FROM alerts {where} ORDER BY id DESC LIMIT :limit OFFSET :offset"

        with engine.connect() as conn:
            result = conn.execute(text(query), params)
            rows = [dict(row._mapping) for row in result]

        return rows

    except Exception as e:
        # No analysis run yet — table doesn't exist
        if "no such table" in str(e).lower():
            return []
        raise HTTPException(status_code=500, detail=str(e))


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
            text("UPDATE alerts SET status = :status WHERE incident_id = :id"),
            {"status": new_status, "id": incident_id}
        )
        conn.commit()

    return {"updated": incident_id, "status": new_status}


@app.patch("/api/alerts/{incident_id}/notes")
def update_notes(incident_id: str, body: dict):
    notes = body.get("notes", "")
    with engine.connect() as conn:
        conn.execute(
            text("UPDATE alerts SET notes = :notes WHERE incident_id = :id"),
            {"notes": notes, "id": incident_id}
        )
        conn.commit()
    return {"updated": incident_id}


@app.get("/api/health")
def health():
    # Returns live DB stats — useful for debugging
    return check_db(engine)
