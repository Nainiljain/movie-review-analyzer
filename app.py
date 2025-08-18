# app.py
import os
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv
import sqlite3
from tmdb_utils import search_movies, get_popular_movies, get_tmdb_genres
from youtube_utils import search_youtube_trailer
from nlp_utils import analyze_sentiment

load_dotenv()  # load .env

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "reviews.db")

app = Flask(__name__, static_folder="static", template_folder="templates")
app.config['JSON_SORT_KEYS'] = False


def run_query(sql, params=(), fetch=False, many=False):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    if many:
        cur.executemany(sql, params)
    else:
        cur.execute(sql, params)
    rv = None
    if fetch:
        rv = cur.fetchall()
    conn.commit()
    conn.close()
    return rv


@app.route("/")
def index():
    # Provide genres for the genre filter dropdown
    genres = get_tmdb_genres()
    return render_template("index.html", genres=genres)


# Endpoint used to search TMDb (regular search bar)
@app.route("/search_tmdb")
def route_search_tmdb():
    q = request.args.get("q", "")
    if not q:
        movies = get_popular_movies()
    else:
        movies = search_movies(q)
    # Attach a small trailer id if found (non-blocking)
    for m in movies:
        try:
            trailer = search_youtube_trailer(f"{m.get('title','') or m.get('name','')} trailer")
            m['youtube_id'] = trailer
        except Exception:
            m['youtube_id'] = None
    return jsonify(movies)


# Filter TMDb results (genre/year/rating)
@app.route("/filter_movies")
def route_filter_movies():
    # Accept either: use a currently loaded list from the client (client can supply) OR fetch top/popular
    # For simplicity: fetch popular (or use search query param to run custom search)
    search_q = request.args.get("q", "")  # optional: if user filtered from a search
    genre = request.args.get("genre", "")
    year = request.args.get("year", "")
    min_rating = request.args.get("rating", "")

    movies = search_movies(search_q) if search_q else get_popular_movies()

    filtered = []
    for m in movies:
        # genre filter: TMDb returns genre_ids list
        if genre:
            try:
                if int(genre) not in m.get("genre_ids", []):
                    continue
            except ValueError:
                continue
        # year filter
        if year:
            rd = m.get("release_date") or m.get("first_air_date") or ""
            if not rd or str(year) != rd[:4]:
                continue
        # rating filter
        if min_rating:
            try:
                if float(m.get("vote_average", 0)) < float(min_rating):
                    continue
            except ValueError:
                continue
        filtered.append(m)

    # attempt to attach youtube ids (best-effort)
    for m in filtered:
        if not m.get("youtube_id"):
            try:
                m['youtube_id'] = search_youtube_trailer(f"{m.get('title','') or m.get('name','')} trailer")
            except Exception:
                m['youtube_id'] = None

    return jsonify(filtered)


# Get review history (with optional filters)
@app.route("/filter_reviews")
def route_filter_reviews():
    sentiment = request.args.get("sentiment", "")  # positive/neutral/negative
    date_order = request.args.get("date_order", "desc")  # asc or desc
    min_wordcount = request.args.get("min_wordcount", "")
    params = []
    query = "SELECT id, movie_title, review_text, sentiment_label, sentiment_score, date_created, word_count FROM reviews"
    where_clauses = []
    if sentiment:
        where_clauses.append("sentiment_label = ?")
        params.append(sentiment)
    if min_wordcount:
        where_clauses.append("word_count >= ?")
        params.append(int(min_wordcount))
    if where_clauses:
        query += " WHERE " + " AND ".join(where_clauses)
    if date_order.lower() not in ("asc", "desc"):
        date_order = "desc"
    query += f" ORDER BY date_created {date_order.upper()}"
    rows = run_query(query, params, fetch=True)
    reviews = []
    for r in rows:
        reviews.append({
            "id": r[0],
            "movie_title": r[1],
            "review_text": r[2],
            "sentiment_label": r[3],
            "sentiment_score": r[4],
            "date_created": r[5],
            "word_count": r[6]
        })
    return jsonify(reviews)


# Add a review (sentiment analyzed server-side, persisted)
@app.route("/add_review", methods=["POST"])
def route_add_review():
    data = request.json or {}
    movie_title = data.get("movie_title", "Unknown")
    review_text = data.get("review_text", "")
    if not review_text:
        return jsonify({"error": "No review text"}), 400

    sentiment = analyze_sentiment(review_text)
    sentiment_label = sentiment["label"]
    sentiment_score = sentiment["score"]
    word_count = sentiment["word_count"]

    run_query(
        "INSERT INTO reviews (movie_title, review_text, sentiment_label, sentiment_score, word_count) VALUES (?, ?, ?, ?, ?)",
        (movie_title, review_text, sentiment_label, sentiment_score, word_count)
    )

    return jsonify({
        "movie_title": movie_title,
        "review_text": review_text,
        "sentiment_label": sentiment_label,
        "sentiment_score": sentiment_score,
        "word_count": word_count
    })


if __name__ == "__main__":
    # Basic check: ensure DB exists / simple message
    print("Starting Movie Review Analyzer (with filters).")
    app.run(debug=True, port=5000)

