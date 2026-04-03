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
from fastapi.responses import Response, StreamingResponse
from sqlalchemy import text

from backend.core.database import engine

router = APIRouter()


@router.get("/report/export/xlsx")
def export_report_xlsx():
    """Download a styled Excel report of all alerts."""
    try:
        with engine.connect() as conn:
            rows = conn.execute(text("SELECT * FROM alerts ORDER BY risk_score DESC")).fetchall()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    if not rows:
        raise HTTPException(status_code=404, detail="No alerts found. Run Analysis first.")

    df = pd.DataFrame([dict(r._mapping) for r in rows])

    display_cols = [
        "incident_id", "timestamp", "source_ip", "destination_ip", "port", "protocol",
        "alert_type", "severity", "risk_score", "confidence", "campaign_id",
        "escalation", "status", "incident_summary", "recommended_action",
        "soc_playbook_action", "automation_result", "mitre_technique", "notes",
    ]
    df = df[[c for c in display_cols if c in df.columns]]

    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="SOC Incidents")
        wb = writer.book
        ws = writer.sheets["SOC Incidents"]

        # Severity colour-coding
        from openpyxl.styles import PatternFill, Font, Alignment
        SEVERITY_COLOURS = {
            "Critical": "FF4444", "High": "FF8C00",
            "Medium":   "FFD700", "Low":  "90EE90",
        }
        header_fill = PatternFill("solid", fgColor="1E3A5F")
        header_font = Font(bold=True, color="FFFFFF")
        for cell in ws[1]:
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal="center")

        sev_idx = display_cols.index("severity") + 1 if "severity" in display_cols else None
        for row in ws.iter_rows(min_row=2):
            if sev_idx:
                sev_val = row[sev_idx - 1].value
                colour = SEVERITY_COLOURS.get(str(sev_val), "FFFFFF")
                fill = PatternFill("solid", fgColor=colour)
                for cell in row:
                    cell.fill = fill

        for col in ws.columns:
            max_len = max((len(str(c.value or "")) for c in col), default=10)
            ws.column_dimensions[col[0].column_letter].width = min(max_len + 2, 50)

    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=soc-ai-incident-report.xlsx"},
    )


@router.get("/report/export/csv")
def export_report_csv():
    """Returns a rich CSV report of all alerts with all AI-generated fields."""
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
        "escalation", "status", "incident_summary", "recommended_action",
        "soc_playbook_action", "automation_result", "mitre_technique", "notes",
    ]

    def escape(val):
        s = str(val) if val is not None else ""
        return '"' + s.replace('"', '""') + '"'

    lines = [",".join(columns)]
    for row in rows:
        d = dict(row._mapping)
        lines.append(",".join(escape(d.get(c, "")) for c in columns))

    return Response(
        content="\n".join(lines),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=soc-ai-incident-report.csv"},
    )


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
