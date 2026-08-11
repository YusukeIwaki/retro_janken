import numpy as np
from PIL import Image

from rps.preprocess import IMAGE_HEIGHT, IMAGE_WIDTH, preprocess_image


def test_preprocess_resizes_normalizes_and_returns_float32() -> None:
    image = Image.new("RGB", (11, 7), color=(255, 0, 127))

    result = preprocess_image(image)

    assert result.shape == (IMAGE_HEIGHT, IMAGE_WIDTH, 3)
    assert result.dtype == np.float32
    np.testing.assert_allclose(result[0, 0], [1.0, -1.0, -1.0 / 255.0])
    assert float(result.min()) >= -1.0
    assert float(result.max()) <= 1.0


def test_preprocess_converts_non_rgb_images() -> None:
    image = Image.new("L", (224, 224), color=255)

    result = preprocess_image(image)

    np.testing.assert_array_equal(result[0, 0], [1.0, 1.0, 1.0])
