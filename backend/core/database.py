from sqlalchemy import create_engine, text
import os

# ── Engine ────────────────────────────────────────────────────────────────────
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///soc.db")

# Render gives postgres:// but SQLAlchemy 1.4+ needs postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
    pool_pre_ping=True,
    pool_recycle=300,
)

IS_PG = None  # set after first connection


def _is_postgres():
    global IS_PG
    if IS_PG is None:
        IS_PG = engine.name == "postgresql"
    return IS_PG


# ── DDL strings ───────────────────────────────────────────────────────────────

ALERTS_DDL_PG = """
CREATE TABLE alerts (
    id                  SERIAL PRIMARY KEY,
    incident_id         TEXT,
    timestamp           TEXT,
    source_ip           TEXT,
    destination_ip      TEXT,
    port                INTEGER,
    protocol            TEXT,
    bytes_transferred   DOUBLE PRECISION,
    failed_logins       INTEGER,
    anomaly             INTEGER,
    anomaly_score       DOUBLE PRECISION,
    confidence          DOUBLE PRECISION,
    rule_bruteforce     INTEGER,
    rule_port_scan      INTEGER,
    rule_traffic_spike  INTEGER,
    rule_triggered      INTEGER,
    bytes_zscore        DOUBLE PRECISION,
    risk_score          DOUBLE PRECISION,
    severity            TEXT,
    alert_type          TEXT,
    campaign_id         TEXT,
    mitre_technique     TEXT,
    incident_summary    TEXT,
    recommended_action  TEXT,
    soc_playbook_action TEXT,
    escalation          TEXT,
    automation_result   TEXT,
    ip_country          TEXT,
    ip_suspicious       INTEGER,
    status              TEXT DEFAULT 'New',
    notes               TEXT DEFAULT ''
)
"""

ALERTS_DDL_SQLITE = """
CREATE TABLE alerts (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    incident_id         TEXT,
    timestamp           TEXT,
    source_ip           TEXT,
    destination_ip      TEXT,
    port                INTEGER,
    protocol            TEXT,
    bytes_transferred   REAL,
    failed_logins       INTEGER,
    anomaly             INTEGER,
    anomaly_score       REAL,
    confidence          REAL,
    rule_bruteforce     INTEGER,
    rule_port_scan      INTEGER,
    rule_traffic_spike  INTEGER,
    rule_triggered      INTEGER,
    bytes_zscore        REAL,
    risk_score          REAL,
    severity            TEXT,
    alert_type          TEXT,
    campaign_id         TEXT,
    mitre_technique     TEXT,
    incident_summary    TEXT,
    recommended_action  TEXT,
    soc_playbook_action TEXT,
    escalation          TEXT,
    automation_result   TEXT,
    ip_country          TEXT,
    ip_suspicious       INTEGER,
    status              TEXT DEFAULT 'New',
    notes               TEXT DEFAULT ''
)
"""

PIPELINE_STATE_DDL = """
CREATE TABLE IF NOT EXISTS pipeline_state (
    id           INTEGER PRIMARY KEY {autoincrement},
    running      INTEGER NOT NULL DEFAULT 0,
    last_run     TEXT,
    started_at   TEXT,
    total_alerts INTEGER DEFAULT 0
)
"""


# ── Schema introspection ──────────────────────────────────────────────────────

def _get_column_names(conn, table: str) -> list:
    """Returns list of column names for a table, or [] if table doesn't exist."""
    try:
        if _is_postgres():
            rows = conn.execute(text("""
                SELECT column_name FROM information_schema.columns
                WHERE table_name = :t AND table_schema = 'public'
                ORDER BY ordinal_position
            """), {"t": table}).fetchall()
        else:
            rows = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
            return [r[1] for r in rows]
        return [r[0] for r in rows]
    except Exception:
        return []


def _table_exists(conn, table: str) -> bool:
    return len(_get_column_names(conn, table)) > 0


# ── EXPECTED columns (what our DDL creates, minus 'id') ──────────────────────

EXPECTED_COLS = {
    'incident_id', 'timestamp', 'source_ip', 'destination_ip',
    'port', 'protocol', 'bytes_transferred', 'failed_logins',
    'anomaly', 'anomaly_score', 'confidence',
    'rule_bruteforce', 'rule_port_scan', 'rule_traffic_spike',
    'rule_triggered', 'bytes_zscore', 'risk_score',
    'severity', 'alert_type', 'campaign_id', 'mitre_technique',
    'incident_summary', 'recommended_action', 'soc_playbook_action',
    'escalation', 'automation_result', 'ip_country', 'ip_suspicious',
    'status', 'notes',
}


# ── Table creation + repair ───────────────────────────────────────────────────

def _ensure_alerts_table(conn):
    """
    Ensures the alerts table exists with the CORRECT schema.

    If the table was created by the old to_sql() code it will be missing
    'id' (SERIAL PRIMARY KEY) and have TEXT columns where we need INTEGER/REAL,
    causing 500s on every SELECT and INSERT.

    Strategy:
      1. If table doesn't exist → CREATE with our DDL (correct from the start)
      2. If table exists but missing 'id' → DROP + RECREATE (data was bad anyway)
      3. If table exists with 'id' → leave it alone (already correct)

    Note: We intentionally DROP rather than rename+copy because the old table
    had wrong column types (TEXT for INTEGER cols) so the data was unusable.
    """
    is_pg = _is_postgres()
    existing_cols = _get_column_names(conn, "alerts")

    if not existing_cols:
        # Table doesn't exist at all
        ddl = ALERTS_DDL_PG if is_pg else ALERTS_DDL_SQLITE
        conn.execute(text(ddl))
        conn.commit()
        print("[db] Created 'alerts' table with correct schema.")
        return "created"

    if "id" not in existing_cols:
        # Table exists but was created by old to_sql() — wrong schema
        print(f"[WARN] 'alerts' table has wrong schema (cols: {existing_cols[:8]}...)")
        print("[db] Dropping and recreating 'alerts' table...")
        conn.execute(text("DROP TABLE alerts"))
        ddl = ALERTS_DDL_PG if is_pg else ALERTS_DDL_SQLITE
        conn.execute(text(ddl))
        conn.commit()
        print("[db] 'alerts' table recreated with correct schema.")
        return "repaired"

    print(f"[db] 'alerts' table OK (has {len(existing_cols)} columns).")
    return "ok"


def _ensure_pipeline_state_table(conn):
    is_pg = _is_postgres()
    autoincrement = "GENERATED ALWAYS AS IDENTITY" if is_pg else "AUTOINCREMENT"

    # pipeline_state doesn't need SERIAL — just use plain INTEGER PK
    if is_pg:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS pipeline_state (
                id           INTEGER PRIMARY KEY,
                running      INTEGER NOT NULL DEFAULT 0,
                last_run     TEXT,
                started_at   TEXT,
                total_alerts INTEGER DEFAULT 0
            )
        """))
    else:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS pipeline_state (
                id           INTEGER PRIMARY KEY,
                running      INTEGER NOT NULL DEFAULT 0,
                last_run     TEXT,
                started_at   TEXT,
                total_alerts INTEGER DEFAULT 0
            )
        """))

    # Seed row 1 (safe to call multiple times)
    if is_pg:
        conn.execute(text(
            "INSERT INTO pipeline_state(id,running) VALUES(1,0) ON CONFLICT(id) DO NOTHING"
        ))
    else:
        conn.execute(text(
            "INSERT OR IGNORE INTO pipeline_state(id,running) VALUES(1,0)"
        ))
    conn.commit()


def create_tables(engine):
    with engine.connect() as conn:
        status = _ensure_alerts_table(conn)
        _ensure_pipeline_state_table(conn)
    return status


# ── Indexes ───────────────────────────────────────────────────────────────────

def create_indexes(engine):
    indexes = [
        "CREATE INDEX IF NOT EXISTS idx_severity   ON alerts(severity)",
        "CREATE INDEX IF NOT EXISTS idx_source_ip  ON alerts(source_ip)",
        "CREATE INDEX IF NOT EXISTS idx_timestamp  ON alerts(timestamp)",
        "CREATE INDEX IF NOT EXISTS idx_campaign   ON alerts(campaign_id)",
        "CREATE INDEX IF NOT EXISTS idx_alert_type ON alerts(alert_type)",
        "CREATE INDEX IF NOT EXISTS idx_status     ON alerts(status)",
    ]
    with engine.connect() as conn:
        for idx in indexes:
            try:
                conn.execute(text(idx))
            except Exception:
                pass
        try:
            conn.commit()
        except Exception:
            pass
    print("[db] Indexes ready.")


# ── Column migrations ─────────────────────────────────────────────────────────

def run_migrations(engine):
    """Adds any columns added after initial table creation."""
    migrations = [
        "ALTER TABLE alerts ADD COLUMN notes TEXT DEFAULT ''",
        "ALTER TABLE alerts ADD COLUMN ip_country TEXT DEFAULT 'Unknown'",
        "ALTER TABLE alerts ADD COLUMN ip_suspicious INTEGER DEFAULT 0",
        "ALTER TABLE alerts ADD COLUMN risk_score DOUBLE PRECISION DEFAULT 0",
        "ALTER TABLE alerts ADD COLUMN campaign_id TEXT DEFAULT 'standalone'",
        "ALTER TABLE alerts ADD COLUMN status TEXT DEFAULT 'New'",
    ]
    with engine.connect() as conn:
        for sql in migrations:
            try:
                conn.execute(text(sql))
                conn.commit()
            except Exception:
                pass  # column already exists


# ── Pipeline state helpers ────────────────────────────────────────────────────

def db_get_pipeline_state(conn):
    try:
        row = conn.execute(text(
            "SELECT running, last_run, started_at, total_alerts FROM pipeline_state WHERE id=1"
        )).fetchone()
        if row is None:
            return {"running": False, "last_run": None, "started_at": None, "total_alerts": 0}
        return {
            "running":      bool(row[0]),
            "last_run":     row[1],
            "started_at":   row[2],
            "total_alerts": row[3],
        }
    except Exception as e:
        print(f"[WARN] db_get_pipeline_state failed: {e}")
        return {"running": False, "last_run": None, "started_at": None, "total_alerts": 0}


def db_set_pipeline_running(conn, running: bool, started_at=None):
    conn.execute(text("""
        UPDATE pipeline_state
        SET running=:r, started_at=:s
        WHERE id=1
    """), {"r": int(running), "s": started_at})
    conn.commit()


def db_set_pipeline_done(conn, last_run: str, total_alerts: int):
    conn.execute(text("""
        UPDATE pipeline_state
        SET running=0, last_run=:lr, total_alerts=:ta
        WHERE id=1
    """), {"lr": last_run, "ta": total_alerts})
    conn.commit()


PIPELINE_TIMEOUT_SECONDS = 600


def db_is_stale(conn):
    import datetime
    try:
        row = conn.execute(text(
            "SELECT running, started_at FROM pipeline_state WHERE id=1"
        )).fetchone()
        if not row or not row[0]:
            return False
        if not row[1]:
            return True
        started = datetime.datetime.fromisoformat(row[1])
        age = (datetime.datetime.utcnow() - started).total_seconds()
        return age > PIPELINE_TIMEOUT_SECONDS
    except Exception:
        return True  # if we can't check, treat as stale


# ── Health / debug ────────────────────────────────────────────────────────────

def check_db(engine):
    try:
        with engine.connect() as conn:
            total  = conn.execute(text("SELECT COUNT(*) FROM alerts")).scalar()
            high   = conn.execute(text("SELECT COUNT(*) FROM alerts WHERE severity='High'")).scalar()
            crit   = conn.execute(text("SELECT COUNT(*) FROM alerts WHERE severity='Critical'")).scalar()
            latest = conn.execute(text("SELECT MAX(timestamp) FROM alerts")).scalar()
            state  = db_get_pipeline_state(conn)
            cols   = _get_column_names(conn, "alerts")
        return {
            "status":        "ok",
            "total_alerts":  total,
            "high":          high,
            "critical":      crit,
            "latest_alert":  latest,
            "pipeline":      state,
            "alerts_columns": cols,          # ← shows exactly what columns exist
            "schema_has_id": "id" in cols,   # ← quick schema health check
            "database":      DATABASE_URL.split("@")[-1] if "@" in DATABASE_URL
                             else DATABASE_URL.split("///")[-1],
        }
    except Exception as e:
        return {"status": "error", "detail": str(e)}


# ── Initialise on import ──────────────────────────────────────────────────────
_startup_status = create_tables(engine)
create_indexes(engine)
run_migrations(engine)
print(f"[db] Startup schema status: {_startup_status}")
