# app.py
import os
from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from dotenv import load_dotenv
import sqlite3
from werkzeug.security import generate_password_hash, check_password_hash
from tmdb_utils import search_movies, get_popular_movies, get_tmdb_genres, get_movie_trailer, get_movie_details
from youtube_utils import search_youtube_trailer
from nlp_utils import analyze_sentiment
from recommender_utils import get_recommendations_by_id

load_dotenv()  # load .env

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "reviews.db")

app = Flask(__name__, static_folder="static", template_folder="templates")
app.secret_key = "super_secret_key_change_this_in_prod"
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


def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            movie_title TEXT,
            review_text TEXT,
            sentiment_label TEXT,
            sentiment_score REAL,
            word_count INTEGER,
            date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS watchlist (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            movie_id INTEGER,
            title TEXT,
            poster_path TEXT,
            release_date TEXT,
            vote_average REAL,
            FOREIGN KEY(user_id) REFERENCES users(id),
            UNIQUE(user_id, movie_id)
        )
    ''')
    conn.commit()
    conn.close()
    print("Database initialized (Users & Watchlist).")


@app.route("/")
def index():
    slides = []
    try:
        # Fetch popular movies to use as background slides
        movies = get_popular_movies()
        # Use high-res images (original) for background
        slides = [f"https://image.tmdb.org/t/p/original{m['poster_path']}" for m in movies if m.get('poster_path')]
        # Limit to top 5-10 to save bandwidth
        slides = slides[:10]
    except Exception as e:
        print(f"Error fetching slides: {e}")
    
    return render_template("landing.html", slides=slides)


@app.route("/browse")
def browse():
    genres = get_tmdb_genres()
    return render_template("movies.html", genres=genres, show_filters=True)


@app.route("/search")
def search_page():
    genres = get_tmdb_genres()
    return render_template("movies.html", genres=genres, show_filters=False)


# Endpoint used to search TMDb (regular search bar)
@app.route("/search_tmdb")
def route_search_tmdb():
    q = request.args.get("q", "")
    page = request.args.get("page", 1, type=int)
    if not q:
        movies = get_popular_movies(page=page)
    else:
        movies = search_movies(q, page=page)
    # Trailers are now fetched only on Details page for performance
    return jsonify(movies)


# Filter TMDb results (genre/year/rating)
@app.route("/filter_movies")
def route_filter_movies():
    # Accept either: use a currently loaded list from the client (client can supply) OR fetch top/popular
    # For simplicity: fetch popular (or use search query param to run custom search)
    search_q = request.args.get("q", "")
    page = request.args.get("page", 1, type=int)
    genre = request.args.get("genre", "")
    year = request.args.get("year", "")
    min_rating = request.args.get("rating", "")

    movies = search_movies(search_q, page=page) if search_q else get_popular_movies(page=page)

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
                m['youtube_id'] = get_movie_trailer(m.get('id'))
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


@app.route("/recommendations/<int:movie_id>")
def route_recommendations(movie_id):
    movies = get_recommendations_by_id(movie_id)
    return jsonify(movies)


@app.route("/movie/<int:movie_id>")
def route_movie_details(movie_id):
    movie = get_movie_details(movie_id)
    if not movie:
        return "Movie not found", 404
        
    # Get local reviews for this movie
    # We match by title roughly, but optimally we'd store TMDB ID. 
    # For now, searching by exact title match in DB
    reviews = []
    try:
        rows = run_query("SELECT id, movie_title, review_text, sentiment_label, sentiment_score, date_created, word_count FROM reviews WHERE movie_title = ? ORDER BY date_created DESC", (movie.get('title'),), fetch=True)
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
    except Exception as e:
        print(f"Error fetching reviews: {e}")

    # Attach trailer (check embedded videos first)
    movie['youtube_id'] = None
    if 'videos' in movie and 'results' in movie['videos']:
        for video in movie['videos']['results']:
            if video.get("type") == "Trailer" and video.get("site") == "YouTube":
                movie['youtube_id'] = video.get("key")
                break
    
    movie['watch_link'] = None
    if 'watch/providers' in movie and 'results' in movie['watch/providers']:
        # prioritize US, or use whatever is available
        providers = movie['watch/providers']['results']
        if 'US' in providers:
            movie['watch_link'] = providers['US'].get('link')
        elif providers:
            # Fallback to first available country
            first_key = next(iter(providers))
            movie['watch_link'] = providers[first_key].get('link')
            
    # Universal Fallback: If no official link found, use Google Search "Watch <Title> Online"
    if not movie['watch_link']:
        encoded_title = movie.get('title', '').replace(' ', '+')
        movie['watch_link'] = f"https://www.google.com/search?q=watch+{encoded_title}+online"

    # AUTO-IMPORT REVIEWS: If no local reviews exist, import from TMDB
    if not reviews and 'reviews' in movie and 'results' in movie['reviews']:
        print(f"DEBUG: Importing reviews for {movie.get('title')}")
        tmdb_reviews = movie['reviews']['results'][:5] # Limit to top 5 to save time
        for tmdb_r in tmdb_reviews:
            if not tmdb_r.get('content'): continue
            
            text = tmdb_r.get('content')
            # Analyze
            sentiment = analyze_sentiment(text)
            label = sentiment['label']
            score = sentiment['score']
            word_count = len(text.split())
            
            # Insert into DB
            try:
                run_query(
                    "INSERT INTO reviews (movie_title, review_text, sentiment_label, sentiment_score, word_count) VALUES (?, ?, ?, ?, ?)",
                    (movie.get('title'), text, label, score, word_count)
                )
            except Exception as e:
                print(f"DEBUG: Error importing review: {e}")
        
        # Re-fetch reviews so they appear immediately
        rows = run_query("SELECT id, movie_title, review_text, sentiment_label, sentiment_score, date_created, word_count FROM reviews WHERE movie_title = ? ORDER BY date_created DESC", (movie.get('title'),), fetch=True)
        reviews = [] # Reset and fill
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

    # Fallback to separate call if not found (optional, but good for robustness)
    if not movie['youtube_id']:
        try:
            # Fallback 1: Try TMDB specific video endpoint again (unlikely to have diff results but safe)
            movie['youtube_id'] = get_movie_trailer(movie_id)
            
            # Fallback 2: If still None, search YouTube by title
            if not movie['youtube_id']:
                print(f"DEBUG: No official trailer found for {movie.get('title')}, searching YouTube...")
                movie['youtube_id'] = search_youtube_trailer(f"{movie.get('title')} trailer")
        except Exception as e:
            print(f"DEBUG: Error searching trailer: {e}")
            pass

    return render_template("movie_details.html", movie=movie, reviews=reviews)


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


# Analytics Endpoints
@app.route("/api/stats")
def route_api_stats():
    # Allow filtering by movie title for Details page analysis
    title_filter = request.args.get("movie_title")
    
    query = "SELECT sentiment_label, COUNT(*) FROM reviews"
    params = []
    if title_filter:
        query += " WHERE movie_title = ?"
        params.append(title_filter)
    query += " GROUP BY sentiment_label"
    
    rows = run_query(query, params, fetch=True)
    stats = {"positive": 0, "neutral": 0, "negative": 0}
    for r in rows:
        label = r[0]
        count = r[1]
        if label in stats:
            stats[label] = count
    return jsonify(stats)


@app.route("/api/wordcloud")
def route_api_wordcloud():
    try:
        from wordcloud import WordCloud
        import io
        from flask import send_file
        
        title_filter = request.args.get("movie_title")
        query = "SELECT review_text FROM reviews"
        params = []
        if title_filter:
            query += " WHERE movie_title = ?"
            params.append(title_filter)
            
        # Get text
        rows = run_query(query, params, fetch=True)
        text = " ".join([r[0] for r in rows])
        
        if not text:
            # Create a simple placeholder image if no text
            from PIL import Image, ImageDraw
            img = Image.new('RGB', (400, 200), color=(240, 240, 240))
            d = ImageDraw.Draw(img)
            d.text((10, 90), "No reviews yet.", fill=(0, 0, 0))
            img_io = io.BytesIO()
            img.save(img_io, 'PNG')
            img_io.seek(0)
            return send_file(img_io, mimetype='image/png')

        # Generate word cloud
        # Use a transparent background or white
        wc = WordCloud(width=800, height=400, background_color='white').generate(text)
        
        # Save to buffer
        img_io = io.BytesIO()
        wc.to_image().save(img_io, 'PNG')
        img_io.seek(0)
        
        return send_file(img_io, mimetype='image/png')
    except ImportError:
        return jsonify({"error": "WordCloud library not installed"}), 500
    except Exception as e:
        print(f"WordCloud Error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/delete_review/<int:review_id>", methods=["DELETE"])
def route_delete_review(review_id):
    try:
        run_query("DELETE FROM reviews WHERE id = ?", (review_id,))
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/export_csv")
def route_export_csv():
    import csv
    import io
    from flask import Response
    
    # Fetch all reviews
    rows = run_query("SELECT id, movie_title, review_text, sentiment_label, sentiment_score, date_created, word_count FROM reviews", fetch=True)
    
    # Create CSV in memory
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Movie Title", "Review Text", "Sentiment Label", "Sentiment Score", "Date Created", "Word Count"])
    writer.writerows(rows)
    
    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment;filename=reviews_export.csv"}
    )


# WATCHLIST ROUTES
@app.route("/watchlist")
def route_watchlist_page():
    return render_template("watchlist.html")

@app.route("/compare")
def route_compare_page():
    return render_template("compare.html")

@app.route("/api/watchlist")
def route_api_watchlist():
    if 'user_id' not in session:
        return jsonify([]) # Return empty list if not logged in
        
    user_id = session['user_id']
    rows = run_query("SELECT movie_id, title, poster_path, release_date, vote_average FROM watchlist WHERE user_id = ? ORDER BY id DESC", (user_id,), fetch=True)
    movies = []
    for r in rows:
        movies.append({
            "id": r[0],
            "title": r[1],
            "poster_path": r[2],
            "release_date": r[3],
            "vote_average": r[4]
        })
    return jsonify(movies)

@app.route("/api/watchlist/add", methods=["POST"])
def route_watchlist_add():
    if 'user_id' not in session:
        return jsonify({"success": False, "error": "Please login first"})

    data = request.json
    user_id = session['user_id']
    try:
        run_query(
            "INSERT INTO watchlist (user_id, movie_id, title, poster_path, release_date, vote_average) VALUES (?, ?, ?, ?, ?, ?)",
            (user_id, data['id'], data['title'], data['poster_path'], data['release_date'], data['vote_average'])
        )
        return jsonify({"success": True})
    except Exception as e:
        # Ignore duplicate errors (movie already in watchlist)
        if "UNIQUE constraint failed" in str(e):
             return jsonify({"success": True}) 
        return jsonify({"success": False, "error": str(e)})

@app.route("/api/watchlist/remove/<int:movie_id>", methods=["DELETE"])
def route_watchlist_remove(movie_id):
    if 'user_id' not in session:
        return jsonify({"success": False, "error": "Login required"})
        
    user_id = session['user_id']
    try:
        run_query("DELETE FROM watchlist WHERE user_id = ? AND movie_id = ?", (user_id, movie_id))
        return jsonify({"success": True})
    except Exception:
        return jsonify({"success": False})

@app.route("/api/watchlist/check/<int:movie_id>")
def route_watchlist_check(movie_id):
    if 'user_id' not in session:
        return jsonify({"in_watchlist": False})
        
    user_id = session['user_id']
    rows = run_query("SELECT 1 FROM watchlist WHERE user_id = ? AND movie_id = ?", (user_id, movie_id), fetch=True)
    return jsonify({"in_watchlist": bool(rows)})

# AUTH ROUTES
@app.route("/register", methods=["GET", "POST"])
def route_register():
    if request.method == "POST":
        username = request.form.get("username")
        password = request.form.get("password")
        
        if not username or not password:
            return render_template("register.html", error="Please fill all fields")
            
        hashed_pw = generate_password_hash(password)
        
        try:
            conn = sqlite3.connect(DB_PATH)
            cur = conn.cursor()
            cur.execute("INSERT INTO users (username, password) VALUES (?, ?)", (username, hashed_pw))
            conn.commit()
            conn.close()
            return redirect(url_for("route_login"))
        except sqlite3.IntegrityError:
            return render_template("register.html", error="Username already exists")
            
    return render_template("register.html")

@app.route("/login", methods=["GET", "POST"])
def route_login():
    if request.method == "POST":
        username = request.form.get("username")
        password = request.form.get("password")
        
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        cur.execute("SELECT id, password FROM users WHERE username = ?", (username,))
        user = cur.fetchone()
        conn.close()
        
        if user and check_password_hash(user[1], password):
            session['user_id'] = user[0]
            session['username'] = username
            return redirect(url_for("browse"))
        else:
            return render_template("login.html", error="Invalid credentials")
            
    return render_template("login.html")

@app.route("/logout")
def route_logout():
    session.clear()
    return redirect(url_for("index"))


if __name__ == "__main__":
    init_db()  # Initialize tables
    # Basic check: ensure DB exists / simple message
    print("Starting Movie Review Analyzer (with filters).")
    app.run(debug=True, port=5000)

