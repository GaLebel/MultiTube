import sys
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Add the parent directory to the Python path to allow importing from 'scripts'
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from scripts.fetch_cctv import fetch_youtube_live_feeds

app = FastAPI()

# Configure CORS
origins = [
    "http://localhost:3000",  # Allow React dev server
    "http://localhost:5000",  # Allow local access
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/search")
def search_videos(query: str, limit: int = 10):
    """
    Searches for YouTube videos based on a query and returns a list of URLs.
    """
    urls = fetch_youtube_live_feeds(query, limit)
    return {"urls": urls}