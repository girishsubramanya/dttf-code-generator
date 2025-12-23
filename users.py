import sqlite3
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
import os

# Use a 'data' directory for persistence
DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
DB_NAME = os.path.join(DATA_DIR, "users.db")

def ensure_data_dir():
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)

def get_db_connection():
    ensure_data_dir()
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    # For development simplicity, if the schema changes, we might want to reset
    # But for now, we'll just try to create.
    # If we need to migrate, we can handle it, but dropping is easier for this task.
    # To ensure the new schema is applied, we will rely on the user deleting the db file
    # or we can force it if we detect it's missing columns, but that's complex.
    # Let's assume the calling script handles the reset if needed.
    conn = get_db_connection()
    conn.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            is_admin BOOLEAN NOT NULL DEFAULT 0,
            is_approved BOOLEAN NOT NULL DEFAULT 0
        )
    ''')
    conn.commit()
    conn.close()

class User(UserMixin):
    def __init__(self, id, username, password, is_admin=False, is_approved=False):
        self.id = id
        self.username = username
        self.password = password
        self.is_admin = bool(is_admin)
        self.is_approved = bool(is_approved)

    @staticmethod
    def get(user_id):
        conn = get_db_connection()
        user = conn.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
        conn.close()
        if not user:
            return None
        return User(user['id'], user['username'], user['password'], user['is_admin'], user['is_approved'])

    @staticmethod
    def get_by_username(username):
        conn = get_db_connection()
        user = conn.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
        conn.close()
        if not user:
            return None
        return User(user['id'], user['username'], user['password'], user['is_admin'], user['is_approved'])

def add_user(username, password, is_admin=False, is_approved=False):
    hashed_password = generate_password_hash(password)
    try:
        conn = get_db_connection()
        conn.execute('INSERT INTO users (username, password, is_admin, is_approved) VALUES (?, ?, ?, ?)',
                     (username, hashed_password, is_admin, is_approved))
        conn.commit()
        conn.close()
        return True
    except sqlite3.IntegrityError:
        return False

def verify_user(username, password):
    user = User.get_by_username(username)
    if user and check_password_hash(user.password, password):
        return user
    return None

def get_all_users():
    conn = get_db_connection()
    users_data = conn.execute('SELECT * FROM users').fetchall()
    conn.close()
    return [User(u['id'], u['username'], u['password'], u['is_admin'], u['is_approved']) for u in users_data]

def approve_user(user_id):
    conn = get_db_connection()
    conn.execute('UPDATE users SET is_approved = 1 WHERE id = ?', (user_id,))
    conn.commit()
    conn.close()

def delete_user(user_id):
    conn = get_db_connection()
    conn.execute('DELETE FROM users WHERE id = ?', (user_id,))
    conn.commit()
    conn.close()

def update_password(user_id, new_password):
    hashed_password = generate_password_hash(new_password)
    conn = get_db_connection()
    conn.execute('UPDATE users SET password = ? WHERE id = ?', (hashed_password, user_id))
    conn.commit()
    conn.close()

def seed_admin():
    """Seeds the admin user if it doesn't exist, using the provided hash."""
    conn = get_db_connection()
    user = conn.execute('SELECT * FROM users WHERE username = ?', ('admin',)).fetchone()

    # Provided hash
    admin_hash = 'scrypt:32768:8:1$AAAwmWVThLTOroyA$af3c1afc8fc82c1a9a10cd855b5e27a669d25dab805f271629564470ad729682dc12d2c7c101169600f19fe492a355d2e7870048968c6dc2a349075adabe602f'

    if not user:
        conn.execute('INSERT INTO users (username, password, is_admin, is_approved) VALUES (?, ?, ?, ?)',
                     ('admin', admin_hash, True, True))
        print("Admin user seeded.")
    else:
        # Update the existing admin's password to the required hash
        conn.execute('UPDATE users SET password = ?, is_admin = 1, is_approved = 1 WHERE username = ?',
                     (admin_hash, 'admin'))
        print("Admin user updated with provided hash.")

    conn.commit()
    conn.close()
