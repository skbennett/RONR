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

# Initialize DB
with get_db_connection() as conn:
    conn.execute('''CREATE TABLE IF NOT EXISTS users (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        username TEXT UNIQUE,
                        email TEXT UNIQUE,
                        password TEXT
                    )''')
    
@app.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    username = data.get("username")
    password = data.get("password")
    
    conn = get_db_connection()
    user = conn.execute(
        "SELECT id, username, email FROM users WHERE username = ? AND password = ?",
        (username, password)
    ).fetchone()
    conn.close()
    
    if user:
        return jsonify({"success": True, "user": dict(user)}), 200
    else:
        return jsonify({"success": False, "error": "Invalid credentials"}), 401

@app.route("/register", methods=["POST"])
def register():
    data = request.get_json()
    username = data["username"]
    email = data["email"]
    password = data["password"]  # (in production, hash it!)
    try:
        conn = get_db_connection()
        conn.execute("INSERT INTO users (username, email, password) VALUES (?, ?, ?)", (username, email, password))
        conn.commit()
        return jsonify({"message": "User registered"}), 201
    except sqlite3.IntegrityError:
        return jsonify({"error": "Email already exists"}), 400
    finally:
        conn.close()

@app.route("/users", methods=["GET"])
def get_users():
    conn = get_db_connection()
    users = conn.execute("SELECT id, username, email, password FROM users").fetchall()
    conn.close()
    return jsonify([dict(u) for u in users])

if __name__ == "__main__":
    app.run(debug=True)
