# db_init.py
import sqlite3

DB = "reviews.db"

schema = """
CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    movie_title TEXT NOT NULL,
    review_text TEXT NOT NULL,
    sentiment_label TEXT,
    sentiment_score REAL,
    date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    word_count INTEGER DEFAULT 0
);
"""

conn = sqlite3.connect(DB)
cur = conn.cursor()
cur.executescript(schema)
conn.commit()
conn.close()
print("Initialized reviews.db")
