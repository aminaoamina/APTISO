import os

# Test settings: set before the app is imported. No real database or Redis is contacted by these tests.
os.environ["AI_SERVICE_TOKEN"] = "test-service-token-that-is-long-enough-123"
os.environ["AI_DB_PASSWORD"] = "test-db-password"
os.environ["AI_DB_PORT"] = "1"
os.environ["AI_DB_HOST"] = "127.0.0.1"
os.environ["REDIS_URL"] = "redis://127.0.0.1:1"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

TOKEN = os.environ["AI_SERVICE_TOKEN"]


@pytest.fixture
def client():
    from app.main import app

    with TestClient(app) as c:
        yield c
