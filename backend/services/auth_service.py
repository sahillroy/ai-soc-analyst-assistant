from sqlalchemy import text
from backend.core.database import engine
from backend.core.security import get_password_hash, verify_password, create_access_token
from backend.models.user import UserCreate, UserLogin, UserResponse

class AuthException(Exception):
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code

def create_user(user_data: UserCreate) -> UserResponse:
    with engine.connect() as conn:
        # Check if email exists
        existing = conn.execute(
            text("SELECT id FROM users WHERE email = :email"),
            {"email": user_data.email}
        ).fetchone()
        
        if existing:
            raise AuthException("Email already registered", status_code=400)
        
        # Hash password and insert
        hashed_pw = get_password_hash(user_data.password)
        
        # We use standard RETURNING for PG, but for sqlite we might need to query it back or use scope_identity
        is_pg = engine.name == "postgresql"
        if is_pg:
            row = conn.execute(
                text("INSERT INTO users (email, password_hash) VALUES (:email, :hash) RETURNING id, email, created_at"),
                {"email": user_data.email, "hash": hashed_pw}
            ).fetchone()
        else:
            conn.execute(
                text("INSERT INTO users (email, password_hash) VALUES (:email, :hash)"),
                {"email": user_data.email, "hash": hashed_pw}
            )
            # SQLite specific way to get last insert row
            row = conn.execute(
                text("SELECT id, email, created_at FROM users WHERE email = :email"),
                {"email": user_data.email}
            ).fetchone()
            
        conn.commit()
        return UserResponse(id=row[0], email=row[1], created_at=str(row[2]))

def authenticate_user(user_data: UserLogin) -> str:
    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT id, email, password_hash FROM users WHERE email = :email"),
            {"email": user_data.email}
        ).fetchone()
        
        if not row:
            raise AuthException("Invalid credentials", status_code=401)
            
        user_id, email, password_hash = row
        
        if not verify_password(user_data.password, password_hash):
            raise AuthException("Invalid credentials", status_code=401)
            
        # Success - generate token
        token_data = {"sub": email, "user_id": user_id}
        token = create_access_token(token_data)
        
        return token
