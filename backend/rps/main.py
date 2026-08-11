"""FastAPI application for rock-paper-scissors image classification."""

from __future__ import annotations

import time
from contextlib import asynccontextmanager
from io import BytesIO
from typing import AsyncIterator, cast

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, ImageOps, UnidentifiedImageError

from rps.classifiers import Classifier, create_classifier
from rps.schemas import ClassifyResponse, HealthResponse

ALLOWED_IMAGE_FORMATS = frozenset({"JPEG", "PNG"})


def decode_image(image_bytes: bytes) -> Image.Image:
    """Decode and fully materialize a JPEG or PNG upload."""

    if not image_bytes:
        raise ValueError("Image is empty")

    try:
        with Image.open(BytesIO(image_bytes)) as source:
            if source.format not in ALLOWED_IMAGE_FORMATS:
                raise ValueError("Image must be JPEG or PNG")
            source.load()
            return ImageOps.exif_transpose(source).convert("RGB")
    except (UnidentifiedImageError, OSError, SyntaxError) as exc:
        raise ValueError("Image could not be decoded as JPEG or PNG") from exc


def create_app(classifier: Classifier | None = None) -> FastAPI:
    """Create an application, optionally injecting a classifier for tests."""

    @asynccontextmanager
    async def lifespan(application: FastAPI) -> AsyncIterator[None]:
        application.state.classifier = classifier or create_classifier()
        yield

    application = FastAPI(title="retro_janken API", lifespan=lifespan)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173"],
        allow_credentials=True,
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )

    def active_classifier(request: Request) -> Classifier:
        return cast(Classifier, request.app.state.classifier)

    @application.post("/api/classify", response_model=ClassifyResponse)
    async def classify_image(
        request: Request, image: UploadFile = File(...)
    ) -> ClassifyResponse:
        image_bytes = await image.read()
        try:
            decoded_image = decode_image(image_bytes)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        started_at = time.perf_counter()
        hand, confidence = active_classifier(request).classify(decoded_image)
        latency_ms = (time.perf_counter() - started_at) * 1000.0
        return ClassifyResponse(
            hand=hand, confidence=confidence, latency_ms=latency_ms
        )

    @application.get("/api/health", response_model=HealthResponse)
    async def health(request: Request) -> HealthResponse:
        current_classifier = active_classifier(request)
        return HealthResponse(classifier=current_classifier.name)

    return application


app = create_app()
