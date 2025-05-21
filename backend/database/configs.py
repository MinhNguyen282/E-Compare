import pymysql
import os
from dotenv import load_dotenv

try:
    load_dotenv()
except Exception as e:
    print(f"Warning: Could not load .env file: {e}")

timeout = 10

connection = pymysql.connect(
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

def create_user_table():
    try:
        with connection.cursor() as cursor:
            create_table_query = """
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(255) NOT NULL UNIQUE,
                username VARCHAR(255) NOT NULL UNIQUE,
                hashed_password VARCHAR(255) NOT NULL,
                full_name VARCHAR(255),
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_email (email),
                INDEX idx_username (username)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            """
            cursor.execute("DROP TABLE IF EXISTS users")
            cursor.execute(create_table_query)
            connection.commit()
            print("User table created successfully or already exists!")
    except Exception as e:
        print(f"Error creating table: {str(e)}")
    finally:
        connection.close()

if __name__ == "__main__":
    create_user_table() 