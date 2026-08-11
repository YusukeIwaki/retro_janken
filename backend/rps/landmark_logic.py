"""Pure hand-gesture classification from MediaPipe hand landmarks."""

from __future__ import annotations

from collections.abc import Sequence
from math import dist, isfinite
from statistics import median
from typing import Protocol, TypeAlias

from rps.types import Hand

LANDMARK_COUNT = 21


class LandmarkLike(Protocol):
    """Coordinate attributes exposed by a MediaPipe normalized landmark."""

    x: float
    y: float
    z: float


Landmark: TypeAlias = tuple[float, float, float]
LandmarkInput: TypeAlias = LandmarkLike | Sequence[float]

# Thumb uses its IP joint; the other fingers use their PIP joints. Comparing
# radial distance from the wrist makes the test independent of image rotation
# and whether the detected hand is left or right.
_FINGER_JOINTS: tuple[tuple[int, int], ...] = (
    (3, 4),
    (6, 8),
    (10, 12),
    (14, 16),
    (18, 20),
)
_PALM_MCP_INDICES = (5, 9, 13, 17)
_EXTENSION_MARGIN = 0.12
_SCISSORS_PATTERN = (False, True, True, False, False)


def _coordinates(point: LandmarkInput) -> Landmark:
    if isinstance(point, Sequence):
        if len(point) < 2:
            raise ValueError("Each landmark must contain at least x and y")
        x = float(point[0])
        y = float(point[1])
        z = float(point[2]) if len(point) >= 3 else 0.0
    else:
        x = float(point.x)
        y = float(point.y)
        z = float(point.z)

    if not all(isfinite(value) for value in (x, y, z)):
        raise ValueError("Landmark coordinates must be finite")
    return x, y, z


def _closest_hand(extension_pattern: tuple[bool, ...]) -> Hand:
    """Choose the valid gesture family requiring the fewest finger changes."""

    extended_count = sum(extension_pattern)
    distances: dict[Hand, int] = {
        # Rock accepts either a fully closed hand or one stray extended finger.
        "rock": max(extended_count - 1, 0),
        "scissors": sum(
            actual != expected
            for actual, expected in zip(
                extension_pattern, _SCISSORS_PATTERN, strict=True
            )
        ),
        # Any four fingers are sufficient for paper.
        "paper": max(4 - extended_count, 0),
    }
    # Scissors is the most specific pattern, so it wins a distance tie; paper
    # then wins over the broad 0-or-1-finger rock family.
    preference: tuple[Hand, ...] = ("scissors", "paper", "rock")
    return min(preference, key=lambda hand: distances[hand])


def classify_from_landmarks(
    landmarks: Sequence[LandmarkInput] | None,
) -> tuple[Hand | None, float]:
    """Classify 21 normalized hand landmarks without image orientation assumptions.

    A finger is extended when its tip is farther from the wrist than its second
    joint by a palm-relative margin. Empty input represents no detected hand;
    malformed non-empty input is rejected because it indicates a detector bug.
    """

    if landmarks is None or len(landmarks) == 0:
        return None, 0.0
    if len(landmarks) != LANDMARK_COUNT:
        raise ValueError(f"Expected {LANDMARK_COUNT} landmarks, got {len(landmarks)}")

    points = tuple(_coordinates(point) for point in landmarks)
    wrist = points[0]
    palm_scale = median(dist(wrist, points[index]) for index in _PALM_MCP_INDICES)
    if palm_scale <= 1e-8:
        return None, 0.0

    extension_signals = tuple(
        (dist(wrist, points[tip]) - dist(wrist, points[joint])) / palm_scale
        for joint, tip in _FINGER_JOINTS
    )
    extension_pattern = tuple(
        signal > _EXTENSION_MARGIN for signal in extension_signals
    )
    extended_count = sum(extension_pattern)

    if extended_count <= 1:
        hand: Hand = "rock"
        is_exact_gesture = True
    elif extension_pattern == _SCISSORS_PATTERN:
        hand = "scissors"
        is_exact_gesture = True
    elif extended_count >= 4:
        hand = "paper"
        is_exact_gesture = True
    else:
        hand = _closest_hand(extension_pattern)
        is_exact_gesture = False

    clarity = sum(
        min(abs(signal - _EXTENSION_MARGIN) / 0.45, 1.0)
        for signal in extension_signals
    ) / len(extension_signals)
    if is_exact_gesture:
        return hand, 0.72 + (0.23 * clarity)

    # An invalid combination can still guide the existing low-confidence retry
    # flow, but must never cross its 0.6 acceptance threshold.
    return hand, 0.40 + (0.15 * clarity)
