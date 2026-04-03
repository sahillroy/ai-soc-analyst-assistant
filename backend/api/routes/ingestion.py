"""
routes/ingestion.py — Log file ingestion endpoints

Handles:
  POST /api/upload-logs   — accept CSV file upload
  GET  /api/sample-data   — load demo data (file or synthetic)
"""
import os
import shutil
import random
from datetime import datetime, timedelta

import pandas as pd
from fastapi import APIRouter, HTTPException, UploadFile, File

from backend.detection.column_mapper import map_columns

router = APIRouter()

# Project root = two levels up from backend/api/routes/
_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))


def _data_dir() -> str:
    """Return absolute path to the data directory, creating it if needed."""
    d = os.path.join(_ROOT, "data")
    os.makedirs(d, exist_ok=True)
    return d


@router.post("/upload-logs")
async def upload_logs(file: UploadFile = File(...)):
    """
    Accept a CSV log file upload. Validates columns, maps aliases,
    and saves the normalised file so the pipeline can use it directly.
    """
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are supported.")

    dest = os.path.join(_data_dir(), "uploaded_logs.csv")

    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)

    try:
        df = pd.read_csv(dest)
    except Exception as e:
        os.remove(dest)
        raise HTTPException(status_code=400, detail=f"Could not parse CSV: {e}")

    columns_detected = list(df.columns)

    try:
        mapped_df, mapping_report = map_columns(df.copy())
    except Exception:
        mapped_df, mapping_report = df, {}

    required = {"source_ip", "destination_ip", "timestamp", "port", "bytes_transferred"}
    missing = required - set(mapped_df.columns)
    if missing:
        os.remove(dest)
        raise HTTPException(
            status_code=400,
            detail=f"Missing required columns: {sorted(missing)}. Detected: {columns_detected}",
        )

    try:
        mapped_df.to_csv(dest, index=False)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save mapped CSV: {e}")

    return {
        "success":          True,
        "rows":             len(df),
        "columns_detected": columns_detected,
        "columns_mapped":   mapping_report,
        "message":          f"Uploaded {len(df)} rows successfully.",
    }


@router.get("/sample-data")
def load_sample_data():
    """
    Loads demo data for the pipeline.

    Strategy:
    1. Copy data/logs.csv if it exists (multiple candidate paths).
    2. Otherwise generate 550 synthetic rows with realistic attack patterns.
    """
    dst = os.path.join(_data_dir(), "uploaded_logs.csv")

    candidates = [
        os.path.join(_ROOT, "data", "logs.csv"),
        os.path.join(_ROOT, "..", "data", "logs.csv"),
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
        return {"success": True, "rows": row_count, "source": "file",
                "message": f"Demo data loaded ({row_count} rows)"}

    # ── Synthetic generation ──────────────────────────────────────────────────
    random.seed(42)
    base_time    = datetime(2024, 1, 15, 8, 0, 0)
    internal_ips = ["10.0.0.1","10.0.0.2","10.0.0.3","10.0.0.4","10.0.0.5",
                    "192.168.1.1","192.168.1.10","192.168.1.100","192.168.1.250"]
    external_ips = ["203.0.113.5","198.51.100.23","185.220.101.47",
                    "45.33.32.156","91.108.4.0","172.217.16.46","104.21.0.1"]
    dest_ips     = ["10.0.0.5","10.0.0.2","10.0.0.3","10.0.0.1"]

    rows = []
    for _ in range(550):
        t          = base_time + timedelta(minutes=random.randint(0, 480))
        is_attack  = random.random() < 0.22
        atype      = random.choice(["bruteforce", "portscan", "exfil", "anomaly"])

        if is_attack:
            src_ip = random.choice(external_ips + ["192.168.1.250"])
            dst_ip = random.choice(dest_ips)
            if atype == "bruteforce":
                port, byt, fail, proto = 22, random.randint(500,2000), random.randint(8,25), "TCP"
            elif atype == "portscan":
                port, byt, fail, proto = random.randint(1,65535), random.randint(100,500), 0, "TCP"
            elif atype == "exfil":
                port, byt, fail, proto = random.choice([80,443,8080]), random.randint(50000,500000), 0, random.choice(["TCP","UDP"])
            else:
                port, byt, fail, proto = random.randint(1024,9999), random.randint(1000,10000), random.randint(0,3), random.choice(["TCP","UDP"])
        else:
            src_ip = random.choice(internal_ips)
            dst_ip = random.choice(dest_ips)
            port   = random.choice([80, 443, 22, 3306, 5432, 8080])
            byt    = random.randint(200, 8000)
            fail   = random.randint(0, 1)
            proto  = random.choice(["TCP", "UDP"])

        rows.append({
            "timestamp": t.strftime("%Y-%m-%d %H:%M:%S"),
            "source_ip": src_ip, "destination_ip": dst_ip,
            "port": port, "protocol": proto,
            "bytes_transferred": byt, "failed_logins": fail,
        })

    demo_df = pd.DataFrame(rows)
    demo_df.to_csv(dst, index=False)
    return {"success": True, "rows": len(demo_df), "source": "generated",
            "message": f"Demo data generated ({len(demo_df)} rows with realistic attack patterns)"}
