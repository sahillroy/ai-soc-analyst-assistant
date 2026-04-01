from sqlalchemy import create_engine, text
import os

# ── Engine ────────────────────────────────────────────────────────────────────
# Reads DATABASE_URL from .env if set, otherwise falls back to local SQLite.
# To switch to PostgreSQL later: set DATABASE_URL=postgresql://user:pass@host/db
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///soc.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
    # check_same_thread=False is SQLite-only — lets FastAPI background threads write safely
)


# ── Schema setup ──────────────────────────────────────────────────────────────
def create_tables(engine):
    """
    Creates the alerts table if it doesn't exist.
    Safe to call on every startup — does nothing if already present.
    """
    primary_key_def = "id SERIAL PRIMARY KEY" if engine.name == "postgresql" else "id INTEGER PRIMARY KEY AUTOINCREMENT"
    
    with engine.connect() as conn:
        conn.execute(text(f"""
            CREATE TABLE IF NOT EXISTS alerts (
                {primary_key_def},
                incident_id      TEXT UNIQUE,
                timestamp        TEXT,
                source_ip        TEXT,
                destination_ip   TEXT,
                port             INTEGER,
                protocol         TEXT,
                bytes_transferred REAL,
                failed_logins    INTEGER,
                anomaly          INTEGER,
                anomaly_score    REAL,
                confidence       REAL,
                rule_bruteforce  INTEGER,
                rule_port_scan   INTEGER,
                rule_traffic_spike INTEGER,
                rule_triggered   INTEGER,
                bytes_zscore     REAL,
                risk_score       REAL,
                severity         TEXT,
                alert_type       TEXT,
                campaign_id      TEXT,
                mitre_technique  TEXT,
                incident_summary TEXT,
                recommended_action TEXT,
                soc_playbook_action TEXT,
                escalation       TEXT,
                automation_result TEXT,
                ip_country       TEXT,
                ip_suspicious    INTEGER,
                status           TEXT DEFAULT 'New',
                notes            TEXT DEFAULT ''
            )
        """))
        conn.commit()
    print("[db] Table 'alerts' ready.")


# ── Indexes ───────────────────────────────────────────────────────────────────
def create_indexes(engine):
    """
    Speeds up the most common dashboard queries:
    - filter by severity
    - filter/search by source_ip
    - sort by timestamp
    - group by campaign_id
    Safe to call repeatedly — IF NOT EXISTS prevents duplicates.
    """
    indexes = [
        "CREATE INDEX IF NOT EXISTS idx_severity    ON alerts(severity)",
        "CREATE INDEX IF NOT EXISTS idx_source_ip   ON alerts(source_ip)",
        "CREATE INDEX IF NOT EXISTS idx_timestamp   ON alerts(timestamp)",
        "CREATE INDEX IF NOT EXISTS idx_campaign    ON alerts(campaign_id)",
        "CREATE INDEX IF NOT EXISTS idx_alert_type  ON alerts(alert_type)",
        "CREATE INDEX IF NOT EXISTS idx_status      ON alerts(status)",
    ]
    with engine.connect() as conn:
        for idx in indexes:
            conn.execute(text(idx))
        conn.commit()
    print("[db] Indexes ready.")


# ── Column migrations ─────────────────────────────────────────────────────────
def run_migrations(engine):
    """
    Adds any columns that were introduced after the table was first created.
    ALTER TABLE is skipped silently if the column already exists.
    Add new migrations here as your schema grows.
    """
    migrations = [
        "ALTER TABLE alerts ADD COLUMN notes TEXT DEFAULT ''",
        "ALTER TABLE alerts ADD COLUMN ip_country TEXT DEFAULT 'Unknown'",
        "ALTER TABLE alerts ADD COLUMN ip_suspicious INTEGER DEFAULT 0",
        "ALTER TABLE alerts ADD COLUMN risk_score REAL DEFAULT 0",
        "ALTER TABLE alerts ADD COLUMN campaign_id TEXT DEFAULT 'standalone'",
    ]
    with engine.connect() as conn:
        for sql in migrations:
            try:
                conn.execute(text(sql))
                conn.commit()
            except Exception:
                pass  # column already exists — skip silently


# ── Health check ──────────────────────────────────────────────────────────────
def check_db(engine):
    """
    Returns a dict with row counts and table info.
    Called by GET /api/health in main.py.
    """
    try:
        with engine.connect() as conn:
            total  = conn.execute(text("SELECT COUNT(*) FROM alerts")).scalar()
            high   = conn.execute(text("SELECT COUNT(*) FROM alerts WHERE severity='High'")).scalar()
            crit   = conn.execute(text("SELECT COUNT(*) FROM alerts WHERE severity='Critical'")).scalar()
            latest = conn.execute(text("SELECT MAX(timestamp) FROM alerts")).scalar()
        return {
            "status":        "ok",
            "total_alerts":  total,
            "high":          high,
            "critical":      crit,
            "latest_alert":  latest,
            "database":      DATABASE_URL.split("///")[-1],  # just the filename
        }
    except Exception as e:
        return {"status": "error", "detail": str(e)}


# ── Initialise on import ──────────────────────────────────────────────────────
# Runs automatically when FastAPI starts — safe to call multiple times.
create_tables(engine)
create_indexes(engine)
run_migrations(engine)
