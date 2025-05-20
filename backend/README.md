# Backend Setup

This is the backend service for the E-Compare application, built with FastAPI.

## Prerequisites

- Python 3.8 or higher
- pip (Python package installer)

## Setup Instructions

1. Create a virtual environment (recommended):
```bash
# Windows
python -m venv venv
.\venv\Scripts\activate

# Linux/Mac
python3 -m venv venv
source venv/bin/activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

## Running the Application

To start the backend server:
```bash
python main.py
```

The server will start at `http://localhost:8000`

## API Endpoints

- `GET /search?query={search_term}` - Search for products
- `POST /crawl-tiki` - Crawl Tiki product data (placeholder endpoint)

## Development

The backend uses FastAPI and includes CORS middleware configured to work with the React frontend running on `http://localhost:3000`. 