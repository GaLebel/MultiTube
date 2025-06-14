# %%

import requests
from bs4 import BeautifulSoup
import re

def fetch_youtube_live_feeds(query, max_results=20):
    """
    Fetches YouTube live stream URLs for a specific query (e.g., 'Tel Aviv CCTV live').
    This uses YouTube search page scraping (no API key required).
    """
    search_url = f"https://www.youtube.com/results?search_query={query.replace(' ', '+')}&sp=EgJAAQ%253D%253D"  # 'Live' filter
    headers = {
        "User-Agent": "Mozilla/5.0"
    }
    response = requests.get(search_url, headers=headers)
    soup = BeautifulSoup(response.text, 'html.parser')

    # Find video URLs in the page source
    video_ids = set(re.findall(r'\"videoId\":\"([a-zA-Z0-9_-]{11})\"', response.text))
    live_urls = [f"https://www.youtube.com/watch?v={vid}" for vid in video_ids]

    # Optionally, filter only the first N results
    return live_urls[:max_results]

if __name__ == "__main__":
    query = "Tel Aviv CCTV live"
    live_feeds = fetch_youtube_live_feeds(query)
    for url in live_feeds:
        print(url)
