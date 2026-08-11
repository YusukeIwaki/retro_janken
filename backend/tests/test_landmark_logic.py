from collections.abc import Callable, Sequence

import pytest

from rps.landmark_logic import Landmark, classify_from_landmarks
from rps.types import Hand

FingerPattern = tuple[bool, bool, bool, bool, bool]


def synthetic_landmarks(pattern: FingerPattern) -> list[Landmark]:
    """Build a hand whose radial tip/joint distances encode ``pattern``."""

    landmarks: list[Landmark] = [(0.0, 0.0, 0.0)] * 21
    landmarks[0] = (0.0, 0.0, 0.0)

    # Thumb: CMC, MCP, IP, tip.
    landmarks[1] = (0.25, -0.25, 0.0)
    landmarks[2] = (0.45, -0.35, 0.0)
    landmarks[3] = (0.70, -0.40, 0.0)
    landmarks[4] = (
        (1.10 if pattern[0] else 0.35),
        (-0.45 if pattern[0] else -0.25),
        0.0,
    )

    finger_data = (
        (5, 0.32, 1.00, pattern[1]),
        (9, 0.10, 1.08, pattern[2]),
        (13, -0.16, 1.03, pattern[3]),
        (17, -0.38, 0.92, pattern[4]),
    )
    for mcp_index, x, mcp_radius, extended in finger_data:
        landmarks[mcp_index] = (x, -mcp_radius, 0.0)
        landmarks[mcp_index + 1] = (x, -(mcp_radius + 0.48), 0.0)
        landmarks[mcp_index + 2] = (x, -(mcp_radius + 0.72), 0.0)
        landmarks[mcp_index + 3] = (
            (x if extended else x * 0.7),
            (-(mcp_radius + 1.00) if extended else -(mcp_radius - 0.12)),
            0.0,
        )
    return landmarks


@pytest.mark.parametrize(
    "pattern",
    [
        (False, False, False, False, False),
        (True, False, False, False, False),
    ],
)
def test_classifies_zero_or_one_extended_finger_as_rock(
    pattern: FingerPattern,
) -> None:
    hand, confidence = classify_from_landmarks(synthetic_landmarks(pattern))

    assert hand == "rock"
    assert confidence >= 0.6


def test_classifies_index_and_middle_fingers_as_scissors() -> None:
    hand, confidence = classify_from_landmarks(
        synthetic_landmarks((False, True, True, False, False))
    )

    assert hand == "scissors"
    assert confidence >= 0.6


@pytest.mark.parametrize(
    "pattern",
    [
        (False, True, True, True, True),
        (True, True, True, True, True),
    ],
)
def test_classifies_four_or_more_extended_fingers_as_paper(
    pattern: FingerPattern,
) -> None:
    hand, confidence = classify_from_landmarks(synthetic_landmarks(pattern))

    assert hand == "paper"
    assert confidence >= 0.6


@pytest.mark.parametrize(
    ("pattern", "nearest_hand"),
    [
        ((True, True, False, True, False), "paper"),
        ((True, True, False, False, False), "rock"),
    ],
)
def test_invalid_finger_combinations_return_nearest_hand_at_low_confidence(
    pattern: FingerPattern, nearest_hand: Hand
) -> None:
    hand, confidence = classify_from_landmarks(synthetic_landmarks(pattern))

    assert hand == nearest_hand
    assert 0.0 < confidence < 0.6


@pytest.mark.parametrize(
    ("pattern", "expected"),
    [
        ((False, False, False, False, False), "rock"),
        ((False, True, True, False, False), "scissors"),
        ((True, True, True, True, True), "paper"),
    ],
)
@pytest.mark.parametrize(
    "transform",
    [
        lambda point: (-point[0], point[1], point[2]),
        lambda point: (-point[0], -point[1], point[2]),
    ],
    ids=["mirrored", "upside-down"],
)
def test_classification_is_invariant_to_hand_side_and_orientation(
    pattern: FingerPattern,
    expected: Hand,
    transform: Callable[[Landmark], Landmark],
) -> None:
    transformed = [transform(point) for point in synthetic_landmarks(pattern)]

    hand, confidence = classify_from_landmarks(transformed)

    assert hand == expected
    assert confidence >= 0.6


def test_empty_landmarks_mean_no_hand() -> None:
    assert classify_from_landmarks([]) == (None, 0.0)


def test_rejects_incomplete_landmarks() -> None:
    incomplete: Sequence[Landmark] = [(0.0, 0.0, 0.0)] * 20

    with pytest.raises(ValueError, match="Expected 21 landmarks"):
        classify_from_landmarks(incomplete)
