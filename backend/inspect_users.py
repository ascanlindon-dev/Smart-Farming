import sqlite3
import os
import sys

db_path = os.path.join(os.path.dirname(__file__), 'db.sqlite3')
if not os.path.exists(db_path):
    print('Database not found at', db_path)
    sys.exit(1)

conn = sqlite3.connect(db_path)
cur = conn.cursor()
try:
    # List tables in the database
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
    tables = [r[0] for r in cur.fetchall()]
    print('Tables found:', tables)
    # If auth_user exists, show its schema
    if 'auth_user' in tables:
        cur.execute("PRAGMA table_info(auth_user)")
        cols = cur.fetchall()
        print('\nauth_user schema:')
        for c in cols:
            print(f"  {c[1]} ({c[2]}) pk={c[5]}")

    cur.execute("SELECT id, username, email, is_staff, is_superuser, date_joined FROM auth_user")
    rows = cur.fetchall()
    if not rows:
        print('No users found in auth_user table.')
    else:
        print('Users:')
        for r in rows:
            print(f"id={r[0]} username={r[1]!r} email={r[2]!r} is_staff={r[3]} is_superuser={r[4]} date_joined={r[5]}")
except Exception as e:
    print('Error querying auth_user:', e)
finally:
    conn.close()
