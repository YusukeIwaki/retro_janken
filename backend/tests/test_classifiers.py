from collections.abc import Sequence
from pathlib import Path

from PIL import Image

from rps.classifiers import LandmarkClassifier, StubClassifier, create_classifier
from rps.landmark_logic import Landmark, classify_from_landmarks


class FakeDetector:
    def __init__(self, landmarks: Sequence[Landmark] | None) -> None:
        self.landmarks = landmarks
        self.detected_images: list[Image.Image] = []

    def detect(self, image: Image.Image) -> Sequence[Landmark] | None:
        self.detected_images.append(image)
        return self.landmarks


def scissors_landmarks() -> list[Landmark]:
    landmarks: list[Landmark] = [(0.0, 0.0, 0.0)] * 21
    for index in (5, 9, 13, 17):
        landmarks[index] = (0.0, -1.0, 0.0)
    for joint, tip, extended in (
        (3, 4, False),
        (6, 8, True),
        (10, 12, True),
        (14, 16, False),
        (18, 20, False),
    ):
        landmarks[joint] = (0.0, -1.5, 0.0)
        landmarks[tip] = (0.0, -2.2 if extended else -0.5, 0.0)
    return landmarks


def test_landmark_classifier_returns_none_when_detector_finds_no_hand() -> None:
    detector = FakeDetector(None)
    classifier = LandmarkClassifier(detector=detector)
    image = Image.new("RGB", (8, 8))
    assert detector.detected_images == []

    result = classifier.classify(image)

    assert result == (None, 0.0)
    assert detector.detected_images == [image]


def test_landmark_classifier_delegates_detected_points_to_landmark_logic() -> None:
    landmarks = scissors_landmarks()
    detector = FakeDetector(landmarks)
    classifier = LandmarkClassifier(detector=detector)

    result = classifier.classify(Image.new("RGB", (8, 8)))

    assert result == classify_from_landmarks(landmarks)
    assert result[0] == "scissors"


def test_create_classifier_warms_landmarks_with_injected_detector(
    tmp_path: Path,
) -> None:
    detector = FakeDetector(None)

    classifier = create_classifier(
        model_path=tmp_path / "missing.keras",
        landmark_model_path=tmp_path / "missing.task",
        landmark_detector=detector,
    )

    assert isinstance(classifier, LandmarkClassifier)
    assert len(detector.detected_images) == 1
    assert detector.detected_images[0].mode == "RGB"
    assert detector.detected_images[0].size == (1, 1)


def test_create_classifier_falls_back_to_stub_without_models(tmp_path: Path) -> None:
    classifier = create_classifier(
        model_path=tmp_path / "missing.keras",
        landmark_model_path=tmp_path / "missing.task",
    )

    assert isinstance(classifier, StubClassifier)


def test_explicit_stub_does_not_require_models(tmp_path: Path) -> None:
    classifier = create_classifier(
        model_path=tmp_path / "missing.keras",
        landmark_model_path=tmp_path / "missing.task",
        classifier_setting="stub",
    )

    assert isinstance(classifier, StubClassifier)
