"""Classifier implementations and application-time classifier selection."""

from __future__ import annotations

import hashlib
import logging
import os
from pathlib import Path
from typing import Protocol, runtime_checkable

import numpy as np
from numpy.typing import NDArray
from PIL import Image

from rps.preprocess import IMAGE_HEIGHT, IMAGE_WIDTH, preprocess_image
from rps.types import CNN_CLASS_NAMES, STUB_HANDS, Hand

LOGGER = logging.getLogger(__name__)
DEFAULT_MODEL_PATH = Path(__file__).resolve().parent.parent / "models" / "rps_cnn.keras"


@runtime_checkable
class Classifier(Protocol):
    """Interface implemented by image classifiers."""

    name: str

    def classify(self, image: Image.Image) -> tuple[Hand, float]:
        """Return the predicted hand and confidence."""


class PredictiveModel(Protocol):
    """The small part of the Keras model API needed during inference."""

    def predict(
        self, inputs: NDArray[np.float32], *, verbose: int = 0
    ) -> NDArray[np.float32]: ...


class StubClassifier:
    """Deterministic classifier used when no trained CNN is available."""

    name = "stub"

    def classify(self, image: Image.Image) -> tuple[Hand, float]:
        rgb_image = image.convert("RGB")
        metadata = f"RGB:{rgb_image.width}x{rgb_image.height}:".encode("ascii")
        digest = hashlib.sha256(metadata + rgb_image.tobytes()).digest()
        hand = STUB_HANDS[digest[0] % len(STUB_HANDS)]
        confidence = 0.70 + (digest[1] / 255.0) * 0.29
        return hand, min(confidence, 0.99)


class CnnClassifier:
    """Keras CNN classifier loaded and warmed once during app startup."""

    name = "cnn"

    def __init__(self, model_path: Path = DEFAULT_MODEL_PATH) -> None:
        if not model_path.is_file():
            raise FileNotFoundError(f"CNN model not found: {model_path}")

        try:
            import tensorflow as tf
        except ImportError as exc:
            raise RuntimeError(
                "TensorFlow is required for CNN inference; run `uv sync --group ml`"
            ) from exc

        self._model: PredictiveModel = tf.keras.models.load_model(model_path)
        warmup_input = np.zeros(
            (1, IMAGE_HEIGHT, IMAGE_WIDTH, 3), dtype=np.float32
        )
        self._model.predict(warmup_input, verbose=0)
        LOGGER.info("Loaded and warmed CNN model from %s", model_path)

    def classify(self, image: Image.Image) -> tuple[Hand, float]:
        model_input = np.expand_dims(preprocess_image(image), axis=0)
        prediction = np.asarray(
            self._model.predict(model_input, verbose=0), dtype=np.float32
        )
        if prediction.shape != (1, len(CNN_CLASS_NAMES)):
            raise RuntimeError(
                "CNN returned an unexpected output shape: " f"{prediction.shape}"
            )

        probabilities = prediction[0]
        class_index = int(np.argmax(probabilities))
        confidence = float(probabilities[class_index])
        return CNN_CLASS_NAMES[class_index], confidence


def create_classifier(
    model_path: Path = DEFAULT_MODEL_PATH,
    classifier_setting: str | None = None,
) -> Classifier:
    """Select the configured classifier, falling back safely to the stub."""

    setting = (classifier_setting or os.getenv("RPS_CLASSIFIER", "auto")).lower()
    if setting == "stub":
        LOGGER.info("Using StubClassifier because RPS_CLASSIFIER=stub")
        return StubClassifier()

    if not model_path.is_file():
        LOGGER.info("CNN model is absent; using StubClassifier")
        return StubClassifier()

    try:
        return CnnClassifier(model_path)
    except (ImportError, OSError, RuntimeError, ValueError):
        LOGGER.exception("CNN initialization failed; using StubClassifier")
        return StubClassifier()
