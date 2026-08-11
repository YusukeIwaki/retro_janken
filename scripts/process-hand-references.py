#!/usr/bin/env python3
"""Keep cropped cabinet references and clean LED-dot trace samples locally.

The source photos are deliberately low resolution, so threshold extraction also
captures the painted red/yellow panel. The clean samples therefore use manually
traced paths from the supplied photos. Generated files are reference material
only and belong in the Git-ignored ``frontend/.local`` directory.
"""

from __future__ import annotations

import argparse
import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Final, Literal, cast

from PIL import Image, ImageDraw, ImageOps

Hand = Literal["rock", "scissors", "paper"]
Point = tuple[float, float]
PathTrace = tuple[Point, ...]

HANDS: Final[tuple[Hand, ...]] = ("rock", "scissors", "paper")
REFERENCE_CROPS: Final[dict[Hand, tuple[float, float, float, float]]] = {
    "rock": (0.38, 0.33, 0.73, 0.72),
    "scissors": (0.29, 0.36, 0.70, 0.91),
    "paper": (0.18, 0.13, 0.85, 0.91),
}

# Coordinates are in the same 24x24 space used by HandSprite.tsx. They are
# intentionally explicit: these are trace samples, not runtime assets.
REFERENCE_PATHS: Final[dict[Hand, tuple[PathTrace, ...]]] = {
    "rock": (
        (
            (8, 20.5), (6.5, 19), (5, 18), (6, 15.8), (2.5, 14.8), (1, 12),
            (1.8, 9.2), (4.2, 7.8), (4.2, 5.2), (6.2, 3.8), (8.5, 5),
            (11, 3.8), (13.8, 4.2), (15.8, 5.8), (18.5, 5.8), (20.2, 7.8),
            (22.2, 9), (23, 11.8), (22, 14.2), (19.8, 16), (17.8, 18),
            (17, 20.2), (16, 20.8), (15, 20.3), (14, 21.2), (13, 20.5),
            (12, 21.3), (11, 20.5), (10, 21.2), (9, 20.3), (8, 20.5),
        ),
        ((8.8, 8.2), (9.2, 11), (9.8, 13.5)),
        ((13.8, 8.2), (13.5, 11), (13.5, 13.5)),
        ((6, 15.5), (7.2, 18), (17, 18), (18.2, 16)),
    ),
    "scissors": (
        (
            (9.1, 22.6), (7.2, 20.8), (5.1, 19.1), (3.6, 16.4), (2.9, 13.6),
            (3.8, 10.6), (4.5, 8.9), (4.4, 5.1), (5.3, 1.3), (6.1, 0.7),
            (7, 1.9), (7.8, 4.9), (9.2, 7.4), (9.9, 8), (10.7, 7.4),
            (11.7, 4.4), (12.3, 1.4), (13.5, 0.7), (14.3, 1.9), (14, 5.4),
            (13.9, 8.4), (16, 7.2), (17.5, 7.7), (17.6, 9.6), (20, 10.6),
            (21.4, 12.4), (21.4, 14.8), (20.4, 17.5), (18.4, 19.6),
            (15.7, 21), (15.4, 22), (9.1, 22.6),
        ),
        ((9.3, 11.3), (9.5, 14), (9.6, 16.6)),
        ((12.6, 11), (12.8, 14), (12.6, 16.3)),
        ((9.1, 21), (15.7, 21)),
    ),
    "paper": (
        (
            (8, 20), (6.5, 19.5), (5, 18.5), (3.5, 18), (3.5, 17), (2, 16.5),
            (2.5, 15.5), (1, 15), (1, 13.5), (2, 12.5), (3.5, 12.5), (5.5, 13.5),
            (5, 10), (4.5, 6), (5, 3.5), (6, 2.2), (7.2, 2.5), (8, 4), (8, 8),
            (9, 3), (9.6, 1), (10.8, 0.7), (12, 1.7), (11.7, 7.5),
            (13, 4), (14, 2.5), (15.2, 2.8), (16, 4.5), (15.2, 9),
            (17, 6), (18.2, 4.8), (19.4, 5.3), (20, 7), (18.5, 12),
            (20, 10.5), (22, 9.5), (23, 10.5), (22.5, 13.5), (21, 16),
            (19, 18), (17, 19.5), (16, 20.5), (16.5, 21.5), (15.5, 21.3),
            (15, 22.3), (14, 21.6), (13, 22.5), (12, 21.7), (11, 22.5),
            (10, 21.5), (8.8, 22), (8, 20),
        ),
        ((9, 10), (9.2, 13), (9, 16)),
        ((13, 10), (12.8, 13), (13, 16)),
    ),
}


@dataclass(frozen=True)
class ProcessedSample:
    hand: Hand
    source_name: str
    source_size: tuple[int, int]
    crop_box: tuple[int, int, int, int]
    cells: tuple[tuple[int, int], ...]
    reference_crop: Image.Image
    preview: Image.Image


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--input",
        action="append",
        required=True,
        metavar="HAND=PATH",
        help="Reference image. Supply rock, scissors, and paper once each.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("frontend/.local/hand-reference-samples"),
        help="Git-ignored local output directory.",
    )
    parser.add_argument("--grid", type=int, default=24, help="Output grid size.")
    return parser.parse_args()


def parse_inputs(values: list[str]) -> dict[Hand, Path]:
    result: dict[Hand, Path] = {}
    for value in values:
        hand_text, separator, path_text = value.partition("=")
        if separator == "" or hand_text not in HANDS:
            raise ValueError(f"Expected HAND=PATH, got: {value}")
        result[cast(Hand, hand_text)] = Path(path_text).expanduser().resolve()
    missing = [hand for hand in HANDS if hand not in result]
    if missing:
        raise ValueError(f"Missing input images: {', '.join(missing)}")
    return result


def normalized_crop(
    size: tuple[int, int], bounds: tuple[float, float, float, float]
) -> tuple[int, int, int, int]:
    width, height = size
    left, top, right, bottom = bounds
    return (
        round(width * left),
        round(height * top),
        round(width * right),
        round(height * bottom),
    )


def rasterize_paths(paths: tuple[PathTrace, ...], grid_size: int) -> tuple[tuple[int, int], ...]:
    active: set[tuple[int, int]] = set()
    coordinate_scale = (grid_size - 1) / 23
    for path in paths:
        for segment_index, (start_x, start_y) in enumerate(path[:-1]):
            end_x, end_y = path[segment_index + 1]
            distance = math.hypot(end_x - start_x, end_y - start_y)
            steps = max(1, math.ceil(distance * 4))
            for step in range(steps + 1):
                progress = step / steps
                x = round((start_x + (end_x - start_x) * progress) * coordinate_scale)
                y = round((start_y + (end_y - start_y) * progress) * coordinate_scale)
                active.add((min(grid_size - 1, x), min(grid_size - 1, y)))
    return tuple(sorted(active, key=lambda point: (point[1], point[0])))


def render_preview(cells: tuple[tuple[int, int], ...], grid_size: int) -> Image.Image:
    cell_size = 12
    margin = 18
    side = grid_size * cell_size + margin * 2
    image = Image.new("RGB", (side, side), (37, 3, 2))
    draw = ImageDraw.Draw(image)
    for x, y in cells:
        center_x = margin + x * cell_size + cell_size // 2
        center_y = margin + y * cell_size + cell_size // 2
        draw.ellipse(
            (center_x - 5, center_y - 5, center_x + 5, center_y + 5),
            fill=(227, 39, 28),
        )
        draw.ellipse(
            (center_x - 2, center_y - 2, center_x + 2, center_y + 2),
            fill=(255, 248, 196),
        )
    return image


def process(hand: Hand, path: Path, grid_size: int) -> ProcessedSample:
    with Image.open(path) as image:
        source_size = image.size
        crop_box = normalized_crop(source_size, REFERENCE_CROPS[hand])
        crop = image.convert("RGB").crop(crop_box)
        reference_crop = ImageOps.pad(
            crop, (360, 360), method=Image.Resampling.NEAREST, color=(37, 3, 2)
        )
    cells = rasterize_paths(REFERENCE_PATHS[hand], grid_size)
    return ProcessedSample(
        hand=hand,
        source_name=path.name,
        source_size=source_size,
        crop_box=crop_box,
        cells=cells,
        reference_crop=reference_crop,
        preview=render_preview(cells, grid_size),
    )


def matrix_text(cells: tuple[tuple[int, int], ...], grid_size: int) -> str:
    active = set(cells)
    return "\n".join(
        "".join("1" if (x, y) in active else "0" for x in range(grid_size))
        for y in range(grid_size)
    ) + "\n"


def write_outputs(
    samples: list[ProcessedSample], output_dir: Path, grid_size: int
) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    manifest: dict[str, object] = {
        "grid_size": grid_size,
        "method": "manual LED-path trace from cropped reference photos",
        "samples": {},
    }
    for sample in samples:
        sample.reference_crop.save(output_dir / f"{sample.hand}-reference-crop.png")
        sample.preview.save(output_dir / f"{sample.hand}.png")
        (output_dir / f"{sample.hand}.txt").write_text(
            matrix_text(sample.cells, grid_size), encoding="utf-8"
        )
        manifest_samples = manifest["samples"]
        assert isinstance(manifest_samples, dict)
        manifest_samples[sample.hand] = {
            "source_name": sample.source_name,
            "source_size": sample.source_size,
            "crop_box": sample.crop_box,
            "active_cells": sample.cells,
        }

    preview_width = samples[0].preview.width
    preview_height = samples[0].preview.height
    contact_sheet = Image.new(
        "RGB", (preview_width * len(samples), preview_height), (16, 2, 1)
    )
    for index, sample in enumerate(samples):
        contact_sheet.paste(sample.preview, (preview_width * index, 0))
    contact_sheet.save(output_dir / "contact-sheet.png")
    (output_dir / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def main() -> None:
    args = parse_args()
    if args.grid < 8:
        raise ValueError("--grid must be at least 8")
    inputs = parse_inputs(args.input)
    samples = [process(hand, inputs[hand], args.grid) for hand in HANDS]
    write_outputs(samples, args.output.resolve(), args.grid)
    print(args.output.resolve())


if __name__ == "__main__":
    main()
