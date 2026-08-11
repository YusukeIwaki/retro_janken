"""Pydantic response models for the HTTP API."""

from typing import Annotated, Literal

from pydantic import BaseModel, Field

from rps.types import Hand


class ClassifyResponse(BaseModel):
    hand: Hand | None
    confidence: Annotated[float, Field(ge=0.0, le=1.0)]
    latency_ms: Annotated[float, Field(ge=0.0)]


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    classifier: Literal["landmark", "cnn", "stub"]
