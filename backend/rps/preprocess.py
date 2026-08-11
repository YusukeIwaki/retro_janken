"""Image preprocessing shared by CNN training and inference."""

import numpy as np
from numpy.typing import NDArray
from PIL import Image, ImageOps

IMAGE_HEIGHT = 224
IMAGE_WIDTH = 224
IMAGE_SIZE = (IMAGE_WIDTH, IMAGE_HEIGHT)


def preprocess_image(image: Image.Image) -> NDArray[np.float32]:
    """Convert an image to a 224x224 RGB MobileNetV2 input in [-1, 1]."""

    oriented = ImageOps.exif_transpose(image)
    rgb_image = oriented.convert("RGB")
    resized = rgb_image.resize(IMAGE_SIZE, Image.Resampling.BILINEAR)
    pixels = np.asarray(resized, dtype=np.float32)
    normalized = (pixels / np.float32(127.5)) - np.float32(1.0)
    return np.ascontiguousarray(normalized, dtype=np.float32)
