from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, Response
from starlette.types import ASGIApp

from .config import get_settings
from .errors import ApiError
from .ratelimit import create_limiter
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


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        response = await call_next(request)
        # Minimal, safe-by-default headers for APIs
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        response.headers.setdefault("Permissions-Policy", "interest-cohort=()")
        # Avoid caching sensitive API responses by default
        response.headers.setdefault("Cache-Control", "no-store")
        return response


app.add_middleware(SecurityHeadersMiddleware)

# Rate limiting (per-IP; default from settings)
limiter = create_limiter(settings)
app.state.limiter = limiter
def _rl_handler(request: Request, exc: Exception) -> Response:
    if isinstance(exc, RateLimitExceeded):
        # Delegate to SlowAPI's default handler
        return _rate_limit_exceeded_handler(request, exc)
    return JSONResponse({"detail": "Unhandled error"}, status_code=500)


app.add_exception_handler(Exception, _rl_handler)
app.add_middleware(SlowAPIMiddleware)


@app.get("/healthz")
def healthcheck() -> dict[str, bool]:
    return {"ok": True}


# Domain → HTTP 매핑 (전역 핸들러, Problem Details 형식 간소 버전)
def _status_for(exc: ApiError) -> int:
    if exc.status is not None:
        return exc.status
    # 기본 폴백(안 쓰이도록 status를 각 예외에 지정)
    return 400


@app.exception_handler(ApiError)
async def _handle_api_error(_request: Request, exc: ApiError) -> JSONResponse:
    status = _status_for(exc)
    body = {
        "type": "about:blank",  # RFC7807 최소 구현
        "title": "",
        "status": status,
        "detail": str(exc) or exc.code,
        "code": exc.code,
    }
    return JSONResponse(body, status_code=status)

# Keep a reference for static analyzers (decorator registers this handler)
_ = _handle_api_error


app.include_router(members.router)
app.include_router(posts.router)
app.include_router(events.router)
app.include_router(rsvps.router)
