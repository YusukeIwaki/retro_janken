"""Download runtime model assets that are intentionally excluded from git."""

from __future__ import annotations

import shutil
from pathlib import Path
from tempfile import NamedTemporaryFile
from urllib.request import Request, urlopen

HAND_LANDMARKER_URL = (
    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/"
    "hand_landmarker/float16/latest/hand_landmarker.task"
)
BACKEND_DIR = Path(__file__).resolve().parent.parent
HAND_LANDMARKER_PATH = BACKEND_DIR / "models" / "hand_landmarker.task"


def download_hand_landmarker(destination: Path = HAND_LANDMARKER_PATH) -> Path:
    """Download the official MediaPipe hand landmarker model atomically."""

    destination.parent.mkdir(parents=True, exist_ok=True)
    request = Request(HAND_LANDMARKER_URL, headers={"User-Agent": "retro-janken/1"})
    temporary_path: Path | None = None
    try:
        with (
            urlopen(request) as response,
            NamedTemporaryFile(
                dir=destination.parent,
                prefix=f".{destination.name}.",
                delete=False,
            ) as temporary_file,
        ):
            temporary_path = Path(temporary_file.name)
            shutil.copyfileobj(response, temporary_file)
        temporary_path.replace(destination)
    finally:
        if temporary_path is not None and temporary_path.exists():
            temporary_path.unlink()

    return destination


def main() -> None:
    destination = download_hand_landmarker()
    print(f"Downloaded MediaPipe hand landmark model to {destination}")


if __name__ == "__main__":
    main()
