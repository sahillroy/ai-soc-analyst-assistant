from dotenv import load_dotenv
load_dotenv()
from fastapi import FastAPI, BackgroundTasks, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi import HTTPException
from sqlalchemy import text
import pandas as pd
from typing import Optional
from backend.core.database import engine
from backend.detection.pipeline import run_pipeline


app = FastAPI(title="SOC Analyst API", version="2.0.0")

# CORS — required so your React frontend can call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "https://your-vercel-app.vercel.app"],
    allow_methods=["*"],
    allow_headers=["*"],
)

pipeline_status = {"running": False, "last_run": None, "total_alerts": 0}

def _run_pipeline_task():
    pipeline_status["running"] = True
    try:
        df = run_pipeline()
        # "append" keeps old alerts; use "replace" only if you want fresh-only
        df.to_sql("alerts", engine, if_exists="replace", index=False)
        pipeline_status["total_alerts"] = len(df)
        pipeline_status["last_run"] = pd.Timestamp.now().isoformat()
    except Exception as e:
        print(f"[ERROR] Pipeline failed: {e}")
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
        query = "SELECT * FROM alerts"
        conditions = []
        if severity:
            conditions.append(f"severity = '{severity}'")
        if search:
            conditions.append(f"source_ip LIKE '%{search}%' OR incident_id LIKE '%{search}%'")
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
        query += f" ORDER BY rowid DESC LIMIT {limit} OFFSET {offset}"

        df = pd.read_sql(query, engine)
        return df.to_dict(orient="records")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/stats")
def get_stats():
    try:
        df = pd.read_sql("SELECT severity, COUNT(*) as count FROM alerts GROUP BY severity", engine)
        return df.to_dict(orient="records")
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