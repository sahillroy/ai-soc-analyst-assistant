"""
routes/reports.py — Incident reporting & export endpoints

Handles:
  GET /api/report/{incident_id}  — single incident JSON report
  GET /api/report/export/xlsx    — full Excel export
  GET /api/report/export/csv     — full CSV export
"""
import io
import json

import pandas as pd
from fastapi import APIRouter, HTTPException
import os
from fastapi.responses import Response, StreamingResponse, FileResponse
from backend.api.export_utils import export_csv, export_excel
import pandas as pd
from sqlalchemy import text

from backend.core.database import engine

router = APIRouter()


@router.get("/report/export/csv")
def export_csv_report():
    import os
    import pandas as pd
    from backend.api.export_utils import export_csv
    from fastapi.responses import FileResponse
    from fastapi import HTTPException
    
    os.makedirs("outputs", exist_ok=True)
    try:
        from backend.core.database import engine
        from sqlalchemy import text
        with engine.connect() as conn:
            rows = conn.execute(text("SELECT * FROM alerts ORDER BY risk_score DESC")).fetchall()
        
        if not rows:
            raise HTTPException(status_code=404, detail="No alerts found. Run Analysis first.")
            
        columns = [col for col in rows[0]._mapping.keys()]
        df = pd.DataFrame([dict(r._mapping) for r in rows], columns=columns)
        
        filepath = export_csv(df, output_dir="outputs")
        filepath = os.path.abspath(filepath)
        return FileResponse(
            path=filepath,
            filename="soc_alerts_export.csv",
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=soc_alerts_export.csv"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/report/export/xlsx")
def export_report_xlsx():
    import os
    import pandas as pd
    from backend.api.export_utils import export_excel
    from fastapi.responses import FileResponse
    from fastapi import HTTPException
    
    os.makedirs("outputs", exist_ok=True)
    try:
        from backend.core.database import engine
        from sqlalchemy import text
        with engine.connect() as conn:
            rows = conn.execute(text("SELECT * FROM alerts ORDER BY risk_score DESC")).fetchall()
            
        if not rows:
            raise HTTPException(status_code=404, detail="No alerts found. Run Analysis first.")
            
        data_dicts = [dict(r._mapping) for r in rows]
        df = pd.DataFrame(data_dicts)
        
        filepath = export_excel(df, output_dir="outputs")
        filepath = os.path.abspath(filepath)
        return FileResponse(
            path=filepath,
            filename="soc_alerts_export.xlsx",
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/report/{incident_id}")
def get_incident_report(incident_id: str):
    """Returns a structured AI-generated JSON report for one incident."""
    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT * FROM alerts WHERE incident_id = :id"),
            {"id": incident_id},
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
