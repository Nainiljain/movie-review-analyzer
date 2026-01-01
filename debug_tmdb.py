
from tmdb_utils import get_popular_movies, get_movie_details
import os

# Test fetching popular to get an ID
print("Fetching popular movies...")
popular = get_popular_movies()
if not popular:
    print("ERROR: Could not fetch popular movies.")
    exit(1)

first_movie = popular[0]
movie_id = first_movie.get('id')
print(f"Found movie: {first_movie.get('title')} (ID: {movie_id})")

# Test fetching details
print(f"Fetching details for ID {movie_id}...")
details = get_movie_details(movie_id)

if details:
    print("SUCCESS: Fetched details.")
    print(f"Title: {details.get('title')}")
    credits = details.get('credits')
    if credits:
        print(f"Cast count: {len(credits.get('cast', []))}")
        print(f"Crew count: {len(credits.get('crew', []))}")
    else:
        print("WARNING: No credits found in response.")
else:
    print("ERROR: get_movie_details returned None.")
