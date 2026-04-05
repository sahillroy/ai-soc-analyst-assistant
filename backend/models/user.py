from pydantic import BaseModel, EmailStr
from typing import Optional
from sqlalchemy import text

# --- PYDANTIC SCHEMAS ---

class UserCreate(BaseModel):
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    email: EmailStr
    created_at: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

# --- DB INIT LOGIC ---

def init_users_table(engine):
    """
    Called on startup to ensure the users table exists.
    Isolated from database.py to avoid breaking core logic.
    """
    DDL_PG = """
    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """
    DDL_SQLITE = """
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """

    is_pg = engine.name == "postgresql"
    ddl = DDL_PG if is_pg else DDL_SQLITE

    with engine.connect() as conn:
        conn.execute(text(ddl))
        conn.commit()
    print("[db] Users table initialized successfully.")
