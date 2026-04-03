"""
routes/alerts.py — Alert CRUD endpoints

Handles:
  GET  /api/alerts        — list/filter alerts
  GET  /api/stats         — severity counts
  PATCH /api/alerts/{id}/status  — update triage status
  PATCH /api/alerts/{id}/notes   — update analyst notes
"""
from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import text
from typing import Optional

from backend.core.database import engine

router = APIRouter()


@router.get("/alerts")
def get_alerts(
    severity: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    offset: int = Query(0),
    search: Optional[str] = Query(None),
):
    """
    Returns alerts. Never returns 500 — always returns [] on any DB error.
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

        where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
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
        if any(x in err for x in ["no such table", "does not exist", "relation", "undefined"]):
            return []
        print(f"[ERROR] GET /api/alerts failed: {e}")
        import traceback; traceback.print_exc()
        return []


@router.get("/stats")
def get_stats():
    try:
        with engine.connect() as conn:
            result = conn.execute(
                text("SELECT severity, COUNT(*) as count FROM alerts GROUP BY severity")
            )
            return [dict(row._mapping) for row in result]
    except Exception:
        return []


@router.patch("/alerts/{incident_id}/status")
def update_status(incident_id: str, body: dict):
    allowed = {"New", "Investigating", "Resolved", "False Positive"}
    new_status = body.get("status")
    if new_status not in allowed:
        raise HTTPException(status_code=400, detail="Invalid status")
    with engine.connect() as conn:
        conn.execute(
            text("UPDATE alerts SET status=:status WHERE incident_id=:id"),
            {"status": new_status, "id": incident_id},
        )
        conn.commit()
    return {"updated": incident_id, "status": new_status}


@router.patch("/alerts/{incident_id}/notes")
def update_notes(incident_id: str, body: dict):
    notes = body.get("notes", "")
    with engine.connect() as conn:
        conn.execute(
            text("UPDATE alerts SET notes=:notes WHERE incident_id=:id"),
            {"notes": notes, "id": incident_id},
        )
        conn.commit()
    return {"updated": incident_id}
