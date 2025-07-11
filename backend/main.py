from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from openai import OpenAI
import requests
import os
from dotenv import load_dotenv
from auth.routes import router as auth_router
import openai
from rate_limit import check_rate_limit
from auth.utils import get_current_user
from typing import Optional

# Load environment variables from .env file
try:
    load_dotenv()
except Exception as e:
    print(f"Warning: Could not load .env file: {e}")

app = FastAPI()

# Get allowed origins from environment variable or use default
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

# Enable CORS to allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Initialize OpenAI client
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    raise ValueError("OPENAI_API_KEY not found in environment variables")

client = OpenAI(api_key=api_key)

# Include auth routes
app.include_router(auth_router, prefix="/auth", tags=["auth"])

@app.middleware("http")
async def add_cors_headers(request, call_next):
    response = await call_next(request)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return response

# Pydantic model for crawler input
class CrawlerInput(BaseModel):
    url: str  # Example: Tiki product URL

# Pydantic model for comparison request
class ComparisonRequest(BaseModel):
    prompt: str

# Search endpoint to fetch data from Tiki API
@app.get("/search")
async def search_products(query: str):
    if not query:
        raise HTTPException(status_code=400, detail="Query parameter is required")

    try:
        # Call Tiki API
        tiki_api_url = f"https://tiki.vn/api/v2/products?limit=100&include=advertisement&aggregations=2&q={query}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
        }
        response = requests.get(tiki_api_url, headers=headers)
        response.raise_for_status()  # Raise exception for bad status codes

        data = response.json()
        products = data.get("data", [])

        # Extract required fields
        result = [
            {
                "id": product.get("id"),
                "name": product.get("name"),
                "url_path": f"https://tiki.vn/{product.get('url_path')}",
                "brand_name": product.get("brand_name"),
                "price": product.get("price"),
                "original_price": product.get("original_price"),
                "review_count": product.get("review_count"),
                "thumbnail_url": product.get("thumbnail_url")
            }
            for product in products
        ]

        return result

    except requests.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Error fetching data from Tiki: {str(e)}")
    
@app.get("/product/{product_id}")
async def get_product_details(product_id: int):
    try:
        tiki_api_url = f"https://tiki.vn/api/v2/products/{product_id}?platform=web&spid={product_id}&version=3"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
        }
        response = requests.get(tiki_api_url, headers=headers)
        response.raise_for_status()

        data = response.json()

        # Extract required fields
        result = {
            "name": data.get("name"),
            "price": data.get("price"),
            "description": data.get("description"),
            "specifications": data.get("specifications", [])
        }

        return result

    except requests.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Error fetching product details from Tiki: {str(e)}")
    except KeyError as e:
        raise HTTPException(status_code=500, detail=f"Missing expected data in Tiki response: {str(e)}")

@app.get("/product/{product_id}/reviews")
async def get_product_reviews(product_id: int, page: int = 1):
    try:
        # Call Tiki API for reviews
        tiki_api_url = f"https://tiki.vn/api/v2/reviews?limit=5&page={page}&product_id={product_id}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
        }
        response = requests.get(tiki_api_url, headers=headers)
        response.raise_for_status()

        data = response.json()

        # Extract required fields
        result = {
            "stars": data.get("stars", {}),
            "rating_average": data.get("rating_average", 0),
            "reviews_count": data.get("reviews_count", 0),
            "reviews": data.get("data", []),
            "paging": data.get("paging", {})
        }

        return result

    except requests.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Error fetching reviews from Tiki: {str(e)}")
    except KeyError as e:
        raise HTTPException(status_code=500, detail=f"Missing expected data in Tiki reviews response: {str(e)}")

@app.post("/compare")
async def compare_products(
    request: ComparisonRequest,
    req: Request,
    current_user: Optional[dict] = Depends(get_current_user)
):
    try:
        # Get client IP address
        client_ip = req.client.host
        
        # Check rate limit based on authentication status
        is_guest = current_user is None
        identifier = client_ip if is_guest else str(current_user['id'])
        is_allowed, remaining_attempts, max_attempts = check_rate_limit(identifier, is_guest)
        
        if not is_allowed:
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded. Please try again later. Remaining attempts: {remaining_attempts}"
            )
        
        print(f"Received comparison request with prompt length: {len(request.prompt)}")
        
        # Call OpenAI API
        response = client.responses.create(
            model="gpt-4o-mini",
            input=[
                {
                    "role": "system",
                    "content": "You are a helpful product comparison assistant. Analyze the products and provide a detailed comparison, highlighting the pros and cons of each product and making a recommendation based on overall value for money."
                },
                {
                    "role": "user",
                    "content": request.prompt
                }
            ]
        )
        
        if not response.choices or not response.choices[0].message.content:
            raise Exception("Invalid response from OpenAI API")
        
        comparison_text = response.choices[0].message.content
        
        return {
            "comparison": comparison_text,
            "rate_limit": {
                "remaining_attempts": remaining_attempts,
                "max_attempts": max_attempts,
                "is_guest": is_guest
            }
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"Unexpected error in compare endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error getting comparison: {str(e)}")

# Note: For Render, use the following start command:
# uvicorn backend.main:app --host 0.0.0.0 --port $PORT