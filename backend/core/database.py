from sqlalchemy import create_engine
from sqlalchemy import text

engine = create_engine("sqlite:///soc.db")  # start simple

def add_notes_column(engine):
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE alerts ADD COLUMN notes TEXT DEFAULT ''"))
            conn.commit()
        except Exception:
            pass  # column already exists

add_notes_column(engine)