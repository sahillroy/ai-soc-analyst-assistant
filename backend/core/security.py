import os
import bcrypt
import jwt
from datetime import datetime, timedelta

# In a realistic environment, you would use a secure, randomly generated string loaded from env.
SECRET_KEY = os.getenv("JWT_SECRET", "super-secret-soc-key-2026")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain password against a bcrypt hash."""
    return bcrypt.checkpw(
        plain_password.encode('utf-8'),
        hashed_password.encode('utf-8')
    )

def get_password_hash(password: str) -> str:
    """Returns a bcrypt hash for the given password string."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def create_access_token(data: dict) -> str:
    """Creates a short-lived JSON Web Token."""
    to_encode = data.copy()
    expire_offset = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    expire = datetime.utcnow() + expire_offset
    
    # Store standard expiration claim
    to_encode.update({"exp": expire})
    
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> dict:
    """Decodes and validates a JSON Web Token."""
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
