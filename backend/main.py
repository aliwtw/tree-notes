"""
to run:
docker compose down -v (wipes database)
docker compose up -d --build
docker compose run --rm backend alembic -c backend/alembic.ini upgrade head
curl.exe http://localhost:8000/health        (backend direct)
curl.exe http://localhost:8080/api/health    (through the nginx proxy)
http://localhost:8000/docs
verify with:
docker compose run --rm backend alembic -c backend/alembic.ini current

alembic needs -c because the code lives at /app/backend while `docker compose
run` starts in /app, so alembic.ini is not in the working directory.
"""

import os
import sys
import logging
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from backend.routers import ai_adapter, auth, groups, notes, profile

from backend.ai.config import warm_ollama

app = FastAPI(
        title = "Treenotes API",
        version = "0.1.0",
        description = "backend api test"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins = [
        "http://localhost:8080", "http://127.0.0.1:8080",
        "http://localhost:5173", "http://127.0.0.1:5173",
    ],
    allow_credentials = True,
    allow_methods = ["*"],
    allow_headers = ["*"],
)

DEV_SESSION_SECRET = "dev-only-insecure-session-secret"
SESSION_SECRET = os.getenv("SESSION_SECRET", DEV_SESSION_SECRET)
if SESSION_SECRET == DEV_SESSION_SECRET:
    logging.getLogger("uvicorn.error").warning(
        "SESSION_SECRET is unset; falling back to the insecure development "
        "default. Set a real secret before deploying."
    )

app.add_middleware(
    SessionMiddleware,
    secret_key = SESSION_SECRET,
    session_cookie = "treenotes_session",
    # The frontend reaches the API same-origin through nginx, so lax is
    # sufficient and avoids the SameSite=None; Secure requirement that
    # cross-origin credentialed requests would impose over plain http.
    same_site = "lax",
    https_only = False,
)

@app.get("/health", tags=["meta"])
def health() -> dict:
    return {"status": "ok"}

# Same payload as /health, but reachable through the nginx proxy, which only
# forwards paths under /api. Use this to smoke test the browser-to-backend path.
@app.get("/api/health", tags=["meta"])
def api_health() -> dict:
    return {"status": "ok"}

@app.on_event("startup") # warm load the Ollama model on startup
def on_startup():
    if os.getenv("AI_WARMUP", "true").lower() != "true":
        return
    try:
        warm_ollama()
    except Exception as exc:
        # An unreachable or still-loading Ollama must not stop the API from
        # serving: every other route would go down with it.
        logging.getLogger("uvicorn.error").warning("Ollama warm-up skipped: %s", exc)

# Mounted under /api because the frontend issues same-origin relative calls to
# /api/*, which nginx forwards here with the prefix intact.
app.include_router(auth.router, prefix="/api", tags=["auth"])
app.include_router(profile.router, prefix="/api", tags=["profile"])
app.include_router(ai_adapter.router, prefix="/api", tags=["ai-adapter"])
app.include_router(notes.router, prefix="/api/notes", tags=["notes"])
app.include_router(groups.router, prefix="/api/groups", tags=["groups"])
