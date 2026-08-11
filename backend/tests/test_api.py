from io import BytesIO

from fastapi.testclient import TestClient
from PIL import Image

from rps.main import create_app


class NoHandClassifier:
    name = "landmark"

    def classify(self, image: Image.Image) -> tuple[None, float]:
        return None, 0.0


def png_bytes(color: tuple[int, int, int] = (20, 80, 140)) -> bytes:
    buffer = BytesIO()
    Image.new("RGB", (32, 24), color=color).save(buffer, format="PNG")
    return buffer.getvalue()


def test_classify_is_deterministic_with_stub(client: TestClient) -> None:
    image = png_bytes()
    first = client.post(
        "/api/classify", files={"image": ("hand.png", image, "image/png")}
    )
    second = client.post(
        "/api/classify", files={"image": ("hand.png", image, "image/png")}
    )

    assert first.status_code == 200
    assert second.status_code == 200
    first_body = first.json()
    second_body = second.json()
    assert first_body["hand"] in {"rock", "scissors", "paper"}
    assert first_body["hand"] == second_body["hand"]
    assert first_body["confidence"] == second_body["confidence"]
    assert 0.0 <= first_body["confidence"] <= 1.0
    assert first_body["latency_ms"] >= 0.0


def test_classify_rejects_an_invalid_image(client: TestClient) -> None:
    response = client.post(
        "/api/classify",
        files={"image": ("broken.jpg", b"not an image", "image/jpeg")},
    )

    assert response.status_code == 400
    assert "detail" in response.json()


def test_classify_returns_nullable_hand_when_no_hand_is_detected() -> None:
    with TestClient(create_app(classifier=NoHandClassifier())) as no_hand_client:
        response = no_hand_client.post(
            "/api/classify",
            files={"image": ("background.png", png_bytes(), "image/png")},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["hand"] is None
    assert body["confidence"] == 0.0
    assert body["latency_ms"] >= 0.0


def test_health_reports_landmark_classifier() -> None:
    with TestClient(create_app(classifier=NoHandClassifier())) as landmark_client:
        response = landmark_client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "classifier": "landmark"}


def test_health_reports_stub(client: TestClient) -> None:
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "classifier": "stub"}


def test_cors_allows_frontend_origin(client: TestClient) -> None:
    response = client.options(
        "/api/classify",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == (
        "http://localhost:5173"
    )
