import os
import requests
from dotenv import load_dotenv

load_dotenv()
TMDB_API_KEY = os.getenv("TMDB_API_KEY")

def get_recommendations_by_id(movie_id):
    """
    Fetch similar movies using TMDB API.
    """
    if not movie_id:
        return []
        
    url = f"https://api.themoviedb.org/3/movie/{movie_id}/recommendations"
    params = {
        "api_key": TMDB_API_KEY,
        "language": "en-US",
        "page": 1
    }
    
    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        results = response.json().get("results", [])
        return results
    except Exception as e:
        print(f"Error fetching recommendations: {e}")
        return []
