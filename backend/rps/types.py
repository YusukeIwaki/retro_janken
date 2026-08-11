"""Shared domain types for classifiers and API responses."""

from typing import Literal

Hand = Literal["rock", "scissors", "paper"]

CNN_CLASS_NAMES: tuple[Hand, ...] = ("rock", "paper", "scissors")
STUB_HANDS: tuple[Hand, ...] = ("rock", "scissors", "paper")
