# youtube_utils.py
import os
import requests
from dotenv import load_dotenv

load_dotenv()
YT_KEY = os.getenv("YOUTUBE_API_KEY")
YT_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search"


def search_youtube_trailer(query, max_results=1):
    """
    Returns a youtube video id (string) for the top matching query, or None.
    """
    if not YT_KEY:
        return None
    params = {
        "part": "snippet",
        "q": query,
        "key": YT_KEY,
        "maxResults": max_results,
        "type": "video",
    }
    r = requests.get(YT_SEARCH_URL, params=params, timeout=8)
    r.raise_for_status()
    data = r.json()
    items = data.get("items", [])
    if not items:
        return None
    return items[0]["id"]["videoId"]
