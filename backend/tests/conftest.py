from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from rps.classifiers import StubClassifier
from rps.main import create_app


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(create_app(classifier=StubClassifier())) as test_client:
        yield test_client
