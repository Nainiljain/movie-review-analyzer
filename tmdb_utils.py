# tmdb_utils.py
import os
import requests
from dotenv import load_dotenv

load_dotenv()
TMDB_API_KEY = os.getenv("TMDB_API_KEY")
TMDB_BASE = "https://api.themoviedb.org/3"


def _get(path, params=None):
    p = {"api_key": TMDB_API_KEY}
    if params:
        p.update(params)
    r = requests.get(f"{TMDB_BASE}{path}", params=p, timeout=10)
    r.raise_for_status()
    return r.json()


def get_tmdb_genres():
    try:
        data = _get("/genre/movie/list", {"language": "en-US"})
        return data.get("genres", [])
    except Exception:
        return []


def get_popular_movies(page=1):
    try:
        data = _get("/movie/popular", {"language": "en-US", "page": page})
        return data.get("results", [])
    except Exception:
        return []


def search_movies(query, page=1):
    if not query:
        return get_popular_movies(page)
    try:
        data = _get("/search/movie", {"query": query, "language": "en-US", "page": page, "include_adult": False})
        return data.get("results", [])
    except Exception:
        return []
def get_movie_trailer(movie_id):
    url = f"https://api.themoviedb.org/3/movie/{movie_id}/videos?api_key={TMDB_API_KEY}&language=en-US"
    res = requests.get(url).json()
    for video in res.get("results", []):
        if video["type"] == "Trailer" and video["site"] == "YouTube":
            return video["key"]
    return None


def get_movie_details(movie_id):
    """
    Fetch full movie details including credits (cast/crew)
    """
    print(f"DEBUG: get_movie_details called for ID: {movie_id}")
    try:
        # append_to_response allows fetching credits in the same call
        url = f"/movie/{movie_id}"
        print(f"DEBUG: Requesting {url}")
        data = _get(url, {"language": "en-US", "append_to_response": "credits,videos,watch/providers,reviews"})
        print(f"DEBUG: Successfully fetched details for {data.get('title', 'Unknown')}")
        return data
    except Exception as e:
        print(f"DEBUG: Error fetching details: {e}")
        return None


def get_person_details(person_id):
    try:
        # Fetch person details
        return _get(f"/person/{person_id}", {"language": "en-US"})
    except Exception:
        return None

def get_person_movie_credits(person_id):
    try:
        # Fetch person movie credits
        return _get(f"/person/{person_id}/movie_credits", {"language": "en-US"})
    except Exception:
        return None