# server.py
from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3

app = Flask(__name__)
CORS(app)  # allow React frontend to connect

def get_db_connection():
    conn = sqlite3.connect('users.db')
    conn.row_factory = sqlite3.Row
    return conn

# Initialize DB with the SECURE password_hash column
with get_db_connection() as conn:
    conn.execute('''CREATE TABLE IF NOT EXISTS users (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        username TEXT UNIQUE NOT NULL,
                        email TEXT UNIQUE NOT NULL,
                        password TEXT NOT NULL
                    )''')
    
@app.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    username = data.get("username")
    password = data.get("password")
    
    if not username or not password:
        return jsonify({"success": False, "error": "Username and password required"}), 400

    conn = get_db_connection()
    # 1. Fetch user by username ONLY
    user_row = conn.execute(
        "SELECT * FROM users WHERE username = ?", (username,)
    ).fetchone()
    conn.close()

    # 2. Check if user exists AND if password matches
    if user_row and user_row['password'] == password:
        # Convert row object to a dictionary, but DO NOT send the hash back
        user_dict = {
            "id": user_row["id"],
            "username": user_row["username"],
            "email": user_row["email"]
        }
        return jsonify({"success": True, "user": user_dict}), 200
    else:
        return jsonify({"success": False, "error": "Invalid credentials"}), 401
    
@app.route('/create-account', methods=['POST'])
def create_account():
    data = request.get_json()
    
    if not data or 'username' not in data or 'email' not in data or 'password' not in data:
        return jsonify({'error': 'Missing data. Please send username, email, and password.'}), 400

    username = data['username']
    email = data['email']
    password = data['password']

    conn = None # Initialize conn outside try block
    try:
        conn = get_db_connection()
        
        # 2. Check if username exists
        user = conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
        if user:
            return jsonify({'error': 'This username is already taken.'}), 409
        
        # 3. Check if email exists
        email_check = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
        if email_check:
            return jsonify({'error': 'This email is already in use.'}), 409

        # 4. Insert the new user with the HASHED password
        conn.execute(
            "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
            (username, email, password)
        )
        conn.commit()
        
        return jsonify({'success': True, 'message': 'Account created successfully!'}), 201
    
    except sqlite3.IntegrityError:
        # This is a fallback in case the checks above fail (race condition)
        return jsonify({'error': 'Username or email already exists'}), 409
    except Exception as e:
        return jsonify({'error': f'An unexpected error occurred: {str(e)}'}), 500
    finally:
        if conn:
            conn.close()

@app.route("/users", methods=["GET"])
def get_users():
    conn = get_db_connection()
    # DO NOT send the password_hash to the client
    users = conn.execute("SELECT id, username, email FROM users").fetchall()
    conn.close()
    return jsonify([dict(u) for u in users])

if __name__ == "__main__":
    # app.run(debug=True)
    # Use port 5000 to match your React app's API_URL
    app.run(debug=True, port=5000)