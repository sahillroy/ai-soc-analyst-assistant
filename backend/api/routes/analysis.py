"""
routes/analysis.py — Pipeline control endpoints

Handles:
  POST /api/run-analysis  — trigger detection pipeline (background task)
  POST /api/reset-status  — force-clear stale pipeline lock
  GET  /api/status        — current pipeline state
"""
import datetime
from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, Body
from pydantic import BaseModel
from typing import Optional, List

from backend.core.database import engine, db_get_pipeline_state, db_set_pipeline_running, db_is_stale
from backend.services.pipeline_service import run_pipeline_background

router = APIRouter()

@router.get("/run-analysis")
def run_analysis(
    background_tasks: BackgroundTasks,
    bruteforce_threshold: int    = Query(10),
    port_scan_threshold: int     = Query(20),
    traffic_spike_z_score: float = Query(3.0),
    contamination: float         = Query(0.05),
    ml_contamination: float      = Query(0.1),
    critical_assets: str         = Query("10.0.0.5"),
):
    final_contamination = contamination if contamination != 0.05 else ml_contamination

    config = {
        "bruteforce_threshold":  bruteforce_threshold,
        "port_scan_threshold":   port_scan_threshold,
        "traffic_spike_z_score": traffic_spike_z_score,
        "ml_contamination":      final_contamination,
        "critical_assets":       critical_assets,
    }
    print(f"[API] /api/run-analysis called via GET with config: {config.keys()}")

    with engine.connect() as conn:
        state = db_get_pipeline_state(conn)
        if state["running"]:
            if db_is_stale(conn):
                db_set_pipeline_running(conn, False)
            else:
                raise HTTPException(status_code=409, detail="Pipeline running")
        
        started_at = datetime.datetime.utcnow().isoformat()
        db_set_pipeline_running(conn, True, started_at=started_at)

    background_tasks.add_task(run_pipeline_background, config)
    return {"status": "started", "started_at": started_at, "config": config}


from pydantic import BaseModel
from typing import Optional, List, Any

class LogPayload(BaseModel):
    logs: Optional[List[Any]] = None

@router.post("/run-analysis")
async def run_analysis_with_logs(
    body: LogPayload,
    background_tasks: BackgroundTasks,
    bruteforce_threshold: int = Query(10),
    port_scan_threshold: int = Query(20),
    traffic_spike_z_score: float = Query(3.0),
    ml_contamination: float = Query(0.1),
):
    logs = body.logs or []
    print(f"[Sentinel] Received logs for analysis: {len(logs)} rows")
    settings = {
        "bruteforce_threshold": bruteforce_threshold,
        "port_scan_threshold": port_scan_threshold,
        "traffic_spike_z_score": traffic_spike_z_score,
        "ml_contamination": ml_contamination,
    }
    
    with engine.connect() as conn:
        state = db_get_pipeline_state(conn)
        if state["running"]:
            if db_is_stale(conn):
                db_set_pipeline_running(conn, False)
            else:
                raise HTTPException(status_code=409, detail="Pipeline running")
        db_set_pipeline_running(conn, True, started_at=datetime.datetime.utcnow().isoformat())

    if logs:
        from backend.services.pipeline_service import run_pipeline_on_logs
        background_tasks.add_task(run_pipeline_on_logs, logs, settings)
    else:
        background_tasks.add_task(run_pipeline_background, settings)
    return {"status": "started", "log_count": len(logs)}




@router.post("/reset-status")
def reset_status():
    """Force-clear the pipeline lock (use after a stuck/crashed run)."""
    with engine.connect() as conn:
        db_set_pipeline_running(conn, False)
    return {"status": "reset", "message": "Pipeline lock cleared."}


@router.get("/status")
def get_status():
    with engine.connect() as conn:
        state = db_get_pipeline_state(conn)
    return state
