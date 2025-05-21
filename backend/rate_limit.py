from datetime import datetime, timedelta
import pymysql
from fastapi import HTTPException
import os
from dotenv import load_dotenv

load_dotenv()

# Database connection
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

# Create rate limit table if it doesn't exist
def init_rate_limit_table():
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS rate_limits (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    identifier VARCHAR(255) NOT NULL,
                    is_guest BOOLEAN NOT NULL,
                    count INT DEFAULT 0,
                    last_reset DATETIME NOT NULL,
                    UNIQUE KEY unique_identifier (identifier)
                )
            """)
        conn.commit()
    finally:
        conn.close()

# Initialize the table when the module is imported
init_rate_limit_table()

def check_rate_limit(identifier: str, is_guest: bool = True):
    """
    Check if the user/guest has exceeded their rate limit
    identifier: IP address for guests, user_id for authenticated users
    is_guest: True for guests, False for authenticated users
    Returns: tuple of (is_allowed, remaining_attempts, max_attempts)
    """
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # Get current usage
            cursor.execute("""
                SELECT * FROM rate_limits 
                WHERE identifier = %s AND is_guest = %s
            """, (identifier, is_guest))
            record = cursor.fetchone()

            now = datetime.now()
            max_requests = 5 if is_guest else 10  # 5 for guests, 10 for users

            if not record:
                # First time user, create record
                cursor.execute("""
                    INSERT INTO rate_limits (identifier, is_guest, count, last_reset)
                    VALUES (%s, %s, 1, %s)
                """, (identifier, is_guest, now))
                conn.commit()
                return True, max_requests - 1, max_requests

            # Check if we need to reset the counter (new day)
            if now.date() > record['last_reset'].date():
                cursor.execute("""
                    UPDATE rate_limits 
                    SET count = 1, last_reset = %s
                    WHERE identifier = %s AND is_guest = %s
                """, (now, identifier, is_guest))
                conn.commit()
                return True, max_requests - 1, max_requests

            # Check if limit is exceeded
            if record['count'] >= max_requests:
                raise HTTPException(
                    status_code=429,
                    detail=f"Rate limit exceeded. {'Guests' if is_guest else 'Users'} are limited to {max_requests} requests per day."
                )

            # Increment counter
            cursor.execute("""
                UPDATE rate_limits 
                SET count = count + 1
                WHERE identifier = %s AND is_guest = %s
            """, (identifier, is_guest))
            conn.commit()
            return True, max_requests - (record['count'] + 1), max_requests

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in rate limiting: {str(e)}")
        raise HTTPException(status_code=500, detail="Error checking rate limit")
    finally:
        conn.close() 