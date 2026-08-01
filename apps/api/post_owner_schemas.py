from __future__ import annotations

from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .media_utils import normalize_media_path, normalize_media_paths


class PostOwnerUpdate(BaseModel):
    """일반 회원이 자기 board 게시글을 수정할 때 사용하는 계약."""

    title: Annotated[str, Field(default=None)]
    content: Annotated[str, Field(default=None)]
    cover_image: str | None = None
    images: list[str] | None = None

    model_config = ConfigDict(extra="forbid")

    @field_validator("cover_image", mode="before")
    @classmethod
    def _normalize_cover_image(cls, value: str | None) -> str | None:
        return normalize_media_path(value)

    @field_validator("images", mode="before")
    @classmethod
    def _normalize_images(cls, value: list[str] | None) -> list[str] | None:
        return normalize_media_paths(value)
