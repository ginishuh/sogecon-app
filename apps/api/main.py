from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .routers import events, members, posts, rsvps

settings = get_settings()

app = FastAPI(title="Alumni API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/healthz")
def healthcheck() -> dict[str, bool]:
    return {"ok": True}


app.include_router(members.router)
app.include_router(posts.router)
app.include_router(events.router)
app.include_router(rsvps.router)
