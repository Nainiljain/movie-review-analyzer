import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "reviews.db")

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

print("Creating watchlist table...")
cursor.execute('''
    CREATE TABLE IF NOT EXISTS watchlist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        movie_id INTEGER UNIQUE,
        title TEXT,
        poster_path TEXT,
        release_date TEXT,
        vote_average REAL
    )
''')
conn.commit()
conn.close()
print("Done. Watchlist table created.")
