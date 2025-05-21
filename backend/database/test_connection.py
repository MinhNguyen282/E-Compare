import os
from dotenv import load_dotenv
import pymysql

try:
    load_dotenv()
except Exception as e:
    print(f"Warning: Could not load .env file: {e}")

def test_connection():
    print("Database connection details:")
    print(f"Host: {os.getenv('DB_HOST')}")
    print(f"Port: {os.getenv('DB_PORT')}")
    print(f"User: {os.getenv('DB_USER')}")
    print(f"Password: {'*' * len(os.getenv('DB_PASSWORD', '')) if os.getenv('DB_PASSWORD') else 'Not set'}")
    
    try:
        connection = pymysql.connect(
            charset="utf8mb4",
            connect_timeout=10,
            cursorclass=pymysql.cursors.DictCursor,
            db="defaultdb",
            host=os.getenv("DB_HOST"),
            password=os.getenv("DB_PASSWORD"),
            read_timeout=10,
            port=int(os.getenv("DB_PORT")),
            user=os.getenv("DB_USER"),
            write_timeout=10,
        )
        print("\nConnection successful!")
        connection.close()
    except Exception as e:
        print(f"\nConnection failed: {str(e)}")

if __name__ == "__main__":
    test_connection() 