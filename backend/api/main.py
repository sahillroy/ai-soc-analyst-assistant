"""
backend/api/main.py — FastAPI Application Entry Point

Responsibilities (and ONLY these):
  - Load environment variables
  - Create the FastAPI app
  - Configure CORS
  - Register route modules
  - Startup initialisation (DB schema, health)

All business logic lives in:
  backend/api/routes/   — HTTP handlers
  backend/services/     — background task logic
  backend/detection/    — ML & rule engine
  backend/enrichment/   — LLM, MITRE, IP reputation
"""

from dotenv import load_dotenv
load_dotenv()

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from backend.core.database import engine, check_db, _get_column_names
from backend.models.user import init_users_table

# ── Route modules ─────────────────────────────────────────────────────────────
from backend.api.routes.auth     import router as auth_router
from backend.api.routes.alerts   import router as alerts_router
from backend.api.routes.analysis import router as analysis_router
from backend.api.routes.ingestion import router as ingestion_router
from backend.api.routes.reports  import router as reports_router

# ── App factory ───────────────────────────────────────────────────────────────

app = FastAPI(title="SOC AI Analyst API", version="3.0.0")

# Initialize users table separately to keep it isolated from core database.py
init_users_table(engine)

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

# ── Mount all routers under /api prefix ───────────────────────────────────────
app.include_router(auth_router,     prefix="/api/auth")
app.include_router(alerts_router,   prefix="/api")
app.include_router(analysis_router, prefix="/api")
app.include_router(ingestion_router, prefix="/api")
app.include_router(reports_router,  prefix="/api")


# ── System endpoints (health, debug) ──────────────────────────────────────────

@app.get("/api/health")
def health():
    return check_db(engine)


@app.get("/api/debug")
def debug():
    """DB diagnostics — use when troubleshooting deployment issues."""
    try:
        from backend.core.database import DATABASE_URL
    except ImportError:
        DATABASE_URL = os.getenv("DATABASE_URL", "")

    result = {"engine": engine.name, "database_url_tail": ""}
    try:
        result["database_url_tail"] = (
            DATABASE_URL.split("@")[-1] if "@" in DATABASE_URL
            else DATABASE_URL.split("///")[-1]
        )
    except Exception:
        pass

    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        result["db_connectivity"] = "ok"
    except Exception as e:
        result["db_connectivity"] = f"FAILED: {e}"
        return result

    try:
        with engine.connect() as conn:
            cols = _get_column_names(conn, "alerts")
        result["alerts_columns"] = cols
        result["alerts_has_id"]  = "id" in cols
    except Exception as e:
        result["alerts_schema_error"] = str(e)

    try:
        with engine.connect() as conn:
            count  = conn.execute(text("SELECT COUNT(*) FROM alerts")).scalar()
            sample = conn.execute(text("SELECT * FROM alerts LIMIT 1")).fetchone()
        result["alerts_count"]  = count
        result["alerts_sample"] = dict(sample._mapping) if sample else None
    except Exception as e:
        result["alerts_select_error"] = str(e)

    try:
        from backend.core.database import db_get_pipeline_state
        with engine.connect() as conn:
            result["pipeline_state"] = db_get_pipeline_state(conn)
    except Exception as e:
        result["pipeline_state_error"] = str(e)

    return result
