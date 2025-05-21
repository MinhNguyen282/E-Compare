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
from .utils import create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES

load_dotenv()

router = APIRouter()

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT settings
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key")
ALGORITHM = "HS256"

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/token")

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
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception

    try:
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT * FROM users WHERE username = %s",
                (token_data.username,)
            )
            user = cursor.fetchone()
            if user is None:
                raise credentials_exception
            return user
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def get_db_connection():
    return pymysql.connect(
        charset="utf8mb4",
        connect_timeout=10,
        cursorclass=pymysql.cursors.DictCursor,
        db="defaultdb",
        host=os.getenv("DB_HOST"),
        password=os.getenv("DB_PASSWORD"),
        read_timeout=10,
        port=13777,
        user="avnadmin",
        write_timeout=10,
    )

# Routes
@router.post("/signup")
async def signup(user: UserCreate):
    try:
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
            hashed_password = get_password_hash(user.password)
            
            # Create new user
            cursor.execute(
                """
                INSERT INTO users (email, username, hashed_password, full_name)
                VALUES (%s, %s, %s, %s)
                """,
                (user.email, user.username, hashed_password, user.full_name)
            )
            connection.commit()
            
            return {"message": "User created successfully"}
    except Exception as e:
        print(f"Signup error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="An error occurred during signup"
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
    except Exception as e:
        print(f"Login error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="An error occurred during login"
        )

@router.get("/me")
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT id, username, email, full_name, is_active, created_at, updated_at FROM users WHERE id = %s",
                (current_user['id'],)
            )
            user = cursor.fetchone()
            if not user:
                raise HTTPException(
                    status_code=404,
                    detail="User not found"
                )
            return user
    except Exception as e:
        print(f"Get user info error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="An error occurred while fetching user information"
        ) 