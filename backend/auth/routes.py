from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import Optional
import os
from database.configs import connection
import pymysql
from dotenv import load_dotenv
from .utils import create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES, get_current_user

load_dotenv()

router = APIRouter()

# Password hashing
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__rounds=12
)

# JWT settings
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key")
ALGORITHM = "HS256"

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/token", auto_error=False)

# Models
class UserCreate(BaseModel):
    email: EmailStr
    username: str
    password: str
    full_name: Optional[str] = None

class UserResponse(BaseModel):
    id: int
    email: str
    username: str
    full_name: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

# Helper functions
def verify_password(plain_password, hashed_password):
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception as e:
        print(f"Password verification error: {str(e)}")
        return False

def get_password_hash(password):
    try:
        return pwd_context.hash(password)
    except Exception as e:
        print(f"Password hashing error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Error hashing password"
        )

# Routes
@router.post("/signup")
async def signup(user: UserCreate):
    try:
        print(f"Attempting to create user with email: {user.email} and username: {user.username}")
        
        # Validate input
        if not user.email or not user.username or not user.password:
            raise HTTPException(
                status_code=400,
                detail="Email, username, and password are required"
            )
        
        with connection.cursor() as cursor:
            # Check if username already exists
            cursor.execute(
                "SELECT * FROM users WHERE username = %s",
                (user.username,)
            )
            if cursor.fetchone():
                raise HTTPException(
                    status_code=400,
                    detail="Username already registered"
                )
            
            # Check if email already exists
            cursor.execute(
                "SELECT * FROM users WHERE email = %s",
                (user.email,)
            )
            if cursor.fetchone():
                raise HTTPException(
                    status_code=400,
                    detail="Email already registered"
                )
            
            # Hash the password
            try:
                hashed_password = get_password_hash(user.password)
            except Exception as e:
                print(f"Error hashing password: {str(e)}")
                raise HTTPException(
                    status_code=500,
                    detail="Error processing password"
                )
            
            # Create new user
            try:
                cursor.execute(
                    """
                    INSERT INTO users (email, username, hashed_password, full_name)
                    VALUES (%s, %s, %s, %s)
                    """,
                    (user.email, user.username, hashed_password, user.full_name)
                )
                connection.commit()
                print(f"Successfully created user: {user.username}")
                return {"message": "User created successfully"}
            except Exception as e:
                print(f"Database error during user creation: {str(e)}")
                connection.rollback()
                raise HTTPException(
                    status_code=500,
                    detail="Error creating user in database"
                )
    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"Unexpected error during signup: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred during signup"
        )

@router.post("/token")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT * FROM users WHERE username = %s",
                (form_data.username,)
            )
            user = cursor.fetchone()
            
            if not user:
                raise HTTPException(
                    status_code=401,
                    detail="Incorrect username or password",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            
            # Verify password
            if not verify_password(form_data.password, user['hashed_password']):
                raise HTTPException(
                    status_code=401,
                    detail="Incorrect username or password",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            
            access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
            access_token = create_access_token(
                data={"sub": str(user['id'])},
                expires_delta=access_token_expires
            )
            return {"access_token": access_token, "token_type": "bearer"}
    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"Login error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="An error occurred during login"
        )

@router.get("/me")
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    try:
        if not current_user:
            raise HTTPException(
                status_code=401,
                detail="Not authenticated"
            )

        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, username, email, full_name, is_active, created_at, updated_at 
                FROM users 
                WHERE id = %s
                """,
                (current_user['id'],)
            )
            user = cursor.fetchone()
            
            if not user:
                print(f"User not found in /me endpoint for id: {current_user['id']}")
                raise HTTPException(
                    status_code=404,
                    detail="User not found"
                )
            
            # Convert datetime objects to strings for JSON serialization
            try:
                if user.get('created_at'):
                    user['created_at'] = user['created_at'].isoformat()
                if user.get('updated_at'):
                    user['updated_at'] = user['updated_at'].isoformat()
            except Exception as e:
                print(f"Error converting datetime: {str(e)}")
                # If datetime conversion fails, remove the fields
                user.pop('created_at', None)
                user.pop('updated_at', None)
            
            # Ensure all fields are JSON serializable
            return {
                'id': int(user['id']),
                'username': str(user['username']),
                'email': str(user['email']),
                'full_name': str(user['full_name']) if user.get('full_name') else None,
                'is_active': bool(user['is_active']),
                'created_at': user.get('created_at'),
                'updated_at': user.get('updated_at')
            }
    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"Get user info error in /me endpoint: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="An error occurred while fetching user information"
        ) 