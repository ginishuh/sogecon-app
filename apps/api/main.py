import logging
import time
import uuid
from collections.abc import Awaitable, Callable
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sentry_sdk import get_current_scope
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.sessions import SessionMiddleware
from starlette.responses import JSONResponse, Response
from starlette.types import ASGIApp

from .config import get_settings
from .errors import ApiError
from .logging_utils import emit_error_event, log_json, reset_request_id, set_request_id
from .observability import init_sentry
from .ratelimit import create_limiter
from .routers import (
    auth,
    events,
    members,
    notifications,
    posts,
    profile,
    rsvps,
    rum,
    support,
)

settings = get_settings()
init_sentry(settings)

app = FastAPI(title="Alumni API", version="0.1.0")

request_logger = logging.getLogger("apps.api.request")
error_logger = logging.getLogger("apps.api.error")

HTTP_STATUS_SERVER_ERROR = 500

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Session cookies (for admin auth). Dev uses HTTP; prod should set https-only.
cookie_secure = settings.app_env == "prod"
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.jwt_secret,
    same_site="lax",
    https_only=cookie_secure,
)

media_root = Path(settings.media_root)
media_root.mkdir(parents=True, exist_ok=True)
app.mount(
    settings.media_url_base,
    StaticFiles(directory=str(media_root)),
    name="media",
)

class RequestContextMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        request_id = request.headers.get("x-request-id") or uuid.uuid4().hex
        request.state.request_id = request_id
        token = set_request_id(request_id)
        start = time.perf_counter()
        scope = get_current_scope()
        scope.set_tag("request_id", request_id)
        scope.set_tag("http.method", request.method)
        scope.set_tag("http.path", request.url.path)
        try:
            response = await call_next(request)
            duration_ms = (time.perf_counter() - start) * 1000
            response.headers.setdefault("X-Request-Id", request_id)
            log_json(
                request_logger,
                logging.INFO,
                "request_complete",
                method=request.method,
                path=request.url.path,
                http_status=response.status_code,
                duration_ms=round(duration_ms, 2),
            )
            return response
        finally:
            scope.remove_tag("request_id")
            scope.remove_tag("http.method")
            scope.remove_tag("http.path")
            reset_request_id(token)


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


app.add_middleware(RequestContextMiddleware)
app.add_middleware(SecurityHeadersMiddleware)

# Rate limiting (per-IP; default from settings)
limiter = create_limiter(settings)
app.state.limiter = limiter
def _rl_handler(request: Request, exc: Exception) -> Response:
    if isinstance(exc, RateLimitExceeded):
        response = _rate_limit_exceeded_handler(request, exc)
        request_id = getattr(request.state, "request_id", None)
        if request_id:
            response.headers.setdefault("X-Request-Id", request_id)
        log_json(
            error_logger,
            logging.WARNING,
            "rate_limit_exceeded",
            code="rate_limit_exceeded",
            http_status=response.status_code,
            method=request.method,
            path=request.url.path,
            detail=str(exc),
            request_id=request_id,
        )
        return response
    request_id = getattr(request.state, "request_id", None)
    status = HTTP_STATUS_SERVER_ERROR
    body = {"detail": "Unhandled error", "code": "internal_error"}
    if request_id:
        body["request_id"] = request_id
    log_json(
        error_logger,
        logging.ERROR,
        "unhandled_exception",
        code="internal_error",
        http_status=status,
        method=request.method,
        path=request.url.path,
        error=str(exc),
        request_id=request_id,
    )
    emit_error_event(
        {
            "code": "internal_error",
            "status": status,
            "path": request.url.path,
            "method": request.method,
            "request_id": request_id,
            "error": str(exc),
            "level": "error",
        }
    )
    response = JSONResponse(body, status_code=status)
    if request_id:
        response.headers.setdefault("X-Request-Id", request_id)
    return response


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
async def _handle_api_error(request: Request, exc: ApiError) -> JSONResponse:
    status = _status_for(exc)
    request_id = getattr(request.state, "request_id", None)
    body = {
        "type": "about:blank",  # RFC7807 최소 구현
        "title": "",
        "status": status,
        "detail": str(exc) or exc.code,
        "code": exc.code,
    }
    if request_id:
        body["request_id"] = request_id
    level = (
        logging.ERROR
        if status >= HTTP_STATUS_SERVER_ERROR
        else logging.WARNING
    )
    log_json(
        error_logger,
        level,
        "api_error",
        code=exc.code,
        http_status=status,
        method=request.method,
        path=request.url.path,
        detail=body["detail"],
        request_id=request_id,
    )
    if status >= HTTP_STATUS_SERVER_ERROR:
        emit_error_event(
            {
                "code": exc.code,
                "status": status,
                "path": request.url.path,
                "method": request.method,
                "request_id": request_id,
                "detail": body["detail"],
                "level": "error",
            }
        )
    response = JSONResponse(body, status_code=status)
    if request_id:
        response.headers.setdefault("X-Request-Id", request_id)
    return response

# Keep a reference for static analyzers (decorator registers this handler)
_ = _handle_api_error


app.include_router(members.router)
app.include_router(posts.router)
app.include_router(events.router)
app.include_router(rsvps.router)
app.include_router(auth.router)
app.include_router(notifications.router)
app.include_router(support.router)
app.include_router(profile.router)
app.include_router(rum.router)
