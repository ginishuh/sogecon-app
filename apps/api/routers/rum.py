from __future__ import annotations

import logging
from typing import Literal

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from ..logging_utils import log_json

router = APIRouter(prefix="/rum", tags=["rum"])


class WebVitalEvent(BaseModel):
    name: Literal["LCP", "INP", "CLS", "FCP", "TTFB"] = Field(
        description="Metric name"
    )
    id: str = Field(description="Unique ID per metric instance")
    value: float = Field(description="Metric value")
    delta: float | None = Field(default=None, description="Change since last report")
    rating: Literal["good", "needs-improvement", "poor"] | None = Field(
        default=None, description="Metric rating"
    )
    path: str | None = Field(default=None, description="Page path")
    navType: Literal[
        "navigate",
        "reload",
        "back-forward",
        "back-forward-cache",
        "prerender",
        "restore",
    ] | None = Field(default=None, description="Navigation type")
    device: str | None = Field(default=None, description="mobile|desktop (heuristic)")
    commit: str | None = Field(default=None, description="Client commit sha")
    ts: int | None = Field(default=None, description="Client timestamp (ms)")


@router.post("/vitals")
async def ingest_vitals(ev: WebVitalEvent, request: Request) -> dict[str, str]:
    """Ingest Web Vitals from client (no PII, sampling handled client-side).

    For now we log as structured events; storage/aggregation can be added later.
    """
    request_id = getattr(request.state, "request_id", None)
    logger = logging.getLogger("apps.api.rum")
    log_json(logger, 20, "web_vital", request_id=request_id, **ev.model_dump())
    return {"ok": "1"}
