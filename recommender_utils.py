# recommender_utils.py
import requests
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from dotenv import load_dotenv
import os

load_dotenv()
TMDB_API_KEY = os.getenv("f6ae3b5f4c35807047efeed24faab003")

def fetch_similar_movies(title, max_results=5):
    # Step 1: Search for the movie
    search_url = f'https://api.themoviedb.org/3/search/movie?api_key={TMDB_API_KEY}&query={title}'
    response = requests.get(search_url)
    results = response.json().get("results", [])

    if not results:
        return []

    movie_id = results[0]['id']

    # Step 2: Fetch movie details and similar movies
    similar_url = f'https://api.themoviedb.org/3/movie/{movie_id}/recommendations?api_key={TMDB_API_KEY}'
    response = requests.get(similar_url)
    recs = response.json().get("results", [])

    return [{
        'title': movie['title'],
        'poster_path': movie['poster_path'],
        'overview': movie['overview']
    } for movie in recs[:max_results]]
