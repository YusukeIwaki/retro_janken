"""Classifier implementations and application-time classifier selection."""

from __future__ import annotations

import hashlib
import logging
import os
from collections.abc import Sequence
from pathlib import Path
from typing import Protocol, runtime_checkable

import numpy as np
from numpy.typing import NDArray
from PIL import Image

from rps.landmark_logic import Landmark, LandmarkLike, classify_from_landmarks
from rps.preprocess import IMAGE_HEIGHT, IMAGE_WIDTH, preprocess_image
from rps.types import CNN_CLASS_NAMES, STUB_HANDS, Hand

LOGGER = logging.getLogger(__name__)
DEFAULT_MODEL_PATH = Path(__file__).resolve().parent.parent / "models" / "rps_cnn.keras"
DEFAULT_LANDMARK_MODEL_PATH = (
    Path(__file__).resolve().parent.parent / "models" / "hand_landmarker.task"
)
LANDMARK_WARMUP_IMAGE_SIZE = (1, 1)


@runtime_checkable
class Classifier(Protocol):
    """Interface implemented by image classifiers."""

    name: str

    def classify(self, image: Image.Image) -> tuple[Hand | None, float]:
        """Return the predicted hand and confidence."""


class LandmarkDetector(Protocol):
    """Image-to-landmarks dependency used by ``LandmarkClassifier``."""

    def detect(self, image: Image.Image) -> Sequence[Landmark] | None:
        """Return one hand's normalized landmarks, or None when absent."""


class _HandLandmarkerResult(Protocol):
    hand_landmarks: Sequence[Sequence[LandmarkLike]]


class _MediaPipeHandLandmarker(Protocol):
    def detect(self, image: object) -> _HandLandmarkerResult: ...


class HandLandmarkDetector:
    """Lazy MediaPipe HandLandmarker wrapper configured for IMAGE mode."""

    def __init__(self, model_path: Path = DEFAULT_LANDMARK_MODEL_PATH) -> None:
        if not model_path.is_file():
            raise FileNotFoundError(f"Hand landmark model not found: {model_path}")
        self._model_path = model_path
        self._landmarker: _MediaPipeHandLandmarker | None = None

    def _get_landmarker(self) -> _MediaPipeHandLandmarker:
        if self._landmarker is None:
            # Import and task creation are intentionally delayed. Importing this
            # module therefore never requires a downloaded model file.
            import mediapipe as mp

            options = mp.tasks.vision.HandLandmarkerOptions(
                base_options=mp.tasks.BaseOptions(
                    model_asset_path=str(self._model_path),
                    delegate=mp.tasks.BaseOptions.Delegate.CPU,
                ),
                running_mode=mp.tasks.vision.RunningMode.IMAGE,
                num_hands=1,
            )
            self._landmarker = (
                mp.tasks.vision.HandLandmarker.create_from_options(options)
            )
            LOGGER.info("Loaded MediaPipe hand landmark model from %s", self._model_path)
        return self._landmarker

    def detect(self, image: Image.Image) -> Sequence[Landmark] | None:
        import mediapipe as mp

        rgb_data = np.ascontiguousarray(
            np.asarray(image.convert("RGB"), dtype=np.uint8)
        )
        media_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_data)
        result = self._get_landmarker().detect(media_image)
        if not result.hand_landmarks:
            return None

        return tuple(
            (float(point.x), float(point.y), float(point.z))
            for point in result.hand_landmarks[0]
        )


class LandmarkClassifier:
    """Classify a detected hand from MediaPipe's geometric landmarks."""

    name = "landmark"

    def __init__(
        self,
        detector: LandmarkDetector | None = None,
        model_path: Path = DEFAULT_LANDMARK_MODEL_PATH,
    ) -> None:
        self._detector = (
            detector if detector is not None else HandLandmarkDetector(model_path)
        )

    def classify(self, image: Image.Image) -> tuple[Hand | None, float]:
        landmarks = self._detector.detect(image)
        if landmarks is None or len(landmarks) == 0:
            return None, 0.0
        return classify_from_landmarks(landmarks)


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
    landmark_model_path: Path = DEFAULT_LANDMARK_MODEL_PATH,
    landmark_detector: LandmarkDetector | None = None,
) -> Classifier:
    """Select landmark, CNN, or stub in configured fallback order."""

    setting = (
        classifier_setting or os.getenv("RPS_CLASSIFIER", "auto")
    ).strip().lower()
    if setting not in {"auto", "landmark", "cnn", "stub"}:
        raise ValueError("RPS_CLASSIFIER must be one of: landmark, cnn, stub")
    if setting == "stub":
        LOGGER.info("Using StubClassifier because RPS_CLASSIFIER=stub")
        return StubClassifier()

    if setting in {"auto", "landmark"}:
        if landmark_detector is not None or landmark_model_path.is_file():
            try:
                landmark_classifier = LandmarkClassifier(
                    detector=landmark_detector,
                    model_path=landmark_model_path,
                )
                warmup_image = Image.new("RGB", LANDMARK_WARMUP_IMAGE_SIZE)
                landmark_classifier.classify(warmup_image)
                LOGGER.info("Warmed LandmarkClassifier with an empty image")
                return landmark_classifier
            except (ImportError, OSError, RuntimeError, ValueError):
                LOGGER.exception(
                    "Landmark initialization failed; trying the next classifier"
                )
        else:
            LOGGER.info("Hand landmark model is absent; trying the next classifier")

    if not model_path.is_file():
        LOGGER.info("CNN model is absent; using StubClassifier")
        return StubClassifier()

    try:
        return CnnClassifier(model_path)
    except (ImportError, OSError, RuntimeError, ValueError):
        LOGGER.exception("CNN initialization failed; using StubClassifier")
        return StubClassifier()
