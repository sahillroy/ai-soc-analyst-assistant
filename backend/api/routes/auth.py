from fastapi import APIRouter, HTTPException
from backend.models.user import UserCreate, UserLogin, UserResponse, Token
from backend.services.auth_service import create_user, authenticate_user, AuthException

router = APIRouter(tags=["auth"])

@router.post("/signup", response_model=UserResponse)
def signup(user_data: UserCreate):
    try:
        user = create_user(user_data)
        return user
    except AuthException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

@router.post("/login", response_model=Token)
def login(user_data: UserLogin):
    try:
        token = authenticate_user(user_data)
        return {"access_token": token, "token_type": "bearer"}
    except AuthException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")
