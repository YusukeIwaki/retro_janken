"""Train and save the MobileNetV2 rock-paper-scissors classifier."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import tensorflow as tf
import tensorflow_datasets as tfds
from PIL import Image

from rps.preprocess import IMAGE_HEIGHT, IMAGE_WIDTH, preprocess_image
from rps.types import CNN_CLASS_NAMES

BATCH_SIZE = 32
INITIAL_EPOCHS = 5
FINE_TUNE_EPOCHS = 5
FINE_TUNE_LAYERS = 30
AUTOTUNE = tf.data.AUTOTUNE
MODEL_PATH = Path(__file__).resolve().parent.parent / "models" / "rps_cnn.keras"


def _preprocess_numpy(image: np.ndarray) -> np.ndarray:
    """Bridge a TFDS uint8 tensor to the preprocessing shared with inference."""

    return preprocess_image(Image.fromarray(image))


def preprocess_example(
    image: tf.Tensor, label: tf.Tensor
) -> tuple[tf.Tensor, tf.Tensor]:
    normalized = tf.numpy_function(_preprocess_numpy, [image], tf.float32)
    normalized.set_shape((IMAGE_HEIGHT, IMAGE_WIDTH, 3))
    return normalized, label


def prepare_dataset(
    dataset: tf.data.Dataset, *, training: bool
) -> tf.data.Dataset:
    prepared = dataset.map(preprocess_example, num_parallel_calls=AUTOTUNE)
    if training:
        prepared = prepared.shuffle(2_048, reshuffle_each_iteration=True)
    return prepared.batch(BATCH_SIZE).prefetch(AUTOTUNE)


def build_model() -> tuple[tf.keras.Model, tf.keras.Model]:
    augmentation = tf.keras.Sequential(
        [
            tf.keras.layers.RandomFlip("horizontal"),
            tf.keras.layers.RandomRotation(0.08, fill_mode="nearest"),
            tf.keras.layers.RandomZoom(0.12, fill_mode="nearest"),
            tf.keras.layers.RandomBrightness(0.15, value_range=(-1.0, 1.0)),
        ],
        name="augmentation",
    )
    base_model = tf.keras.applications.MobileNetV2(
        input_shape=(IMAGE_HEIGHT, IMAGE_WIDTH, 3),
        include_top=False,
        weights="imagenet",
    )
    base_model.trainable = False

    inputs = tf.keras.Input(shape=(IMAGE_HEIGHT, IMAGE_WIDTH, 3))
    features = augmentation(inputs)
    features = base_model(features, training=False)
    features = tf.keras.layers.GlobalAveragePooling2D()(features)
    features = tf.keras.layers.Dropout(0.25)(features)
    outputs = tf.keras.layers.Dense(
        len(CNN_CLASS_NAMES), activation="softmax"
    )(features)
    model = tf.keras.Model(inputs, outputs, name="rps_mobilenet_v2")
    return model, base_model


def compile_model(model: tf.keras.Model, learning_rate: float) -> None:
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=learning_rate),
        loss=tf.keras.losses.SparseCategoricalCrossentropy(),
        metrics=[tf.keras.metrics.SparseCategoricalAccuracy(name="accuracy")],
    )


def main() -> None:
    (training_raw, validation_raw), dataset_info = tfds.load(
        "rock_paper_scissors",
        split=["train", "test"],
        as_supervised=True,
        with_info=True,
    )
    dataset_class_names = tuple(dataset_info.features["label"].names)
    if dataset_class_names != CNN_CLASS_NAMES:
        raise RuntimeError(
            "Unexpected TFDS class order: "
            f"{dataset_class_names}; expected {CNN_CLASS_NAMES}"
        )

    training_data = prepare_dataset(training_raw, training=True)
    validation_data = prepare_dataset(validation_raw, training=False)
    model, base_model = build_model()

    compile_model(model, learning_rate=1e-3)
    model.fit(
        training_data,
        validation_data=validation_data,
        epochs=INITIAL_EPOCHS,
    )

    base_model.trainable = True
    for layer in base_model.layers[:-FINE_TUNE_LAYERS]:
        layer.trainable = False
    for layer in base_model.layers:
        if isinstance(layer, tf.keras.layers.BatchNormalization):
            layer.trainable = False

    compile_model(model, learning_rate=1e-5)
    model.fit(
        training_data,
        validation_data=validation_data,
        initial_epoch=INITIAL_EPOCHS,
        epochs=INITIAL_EPOCHS + FINE_TUNE_EPOCHS,
    )

    validation_loss, validation_accuracy = model.evaluate(
        validation_data, verbose=0
    )
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    model.save(MODEL_PATH)
    print(f"Validation loss: {validation_loss:.4f}")
    print(f"Validation accuracy: {validation_accuracy:.4f}")
    print(f"Saved model to: {MODEL_PATH}")


if __name__ == "__main__":
    main()
