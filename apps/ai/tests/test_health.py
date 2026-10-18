from tests.conftest import TOKEN


def test_live_needs_no_token_and_reveals_nothing(client):
    r = client.get("/v1/health/live")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_ready_requires_the_service_token(client):
    assert client.get("/v1/health/ready").status_code == 401
    assert client.get("/v1/health/ready", headers={"X-Service-Token": "wrong"}).status_code == 401


def test_ready_reports_unreachable_dependencies_as_503(client):
    r = client.get("/v1/health/ready", headers={"X-Service-Token": TOKEN})
    assert r.status_code == 503
    body = r.json()
    assert body["status"] == "degraded"
    assert body["checks"]["database"]["ok"] is False and body["checks"]["redis"]["ok"] is False
    # Only the error type is reported, never connection strings or messages.
    assert "test-db-password" not in r.text


def test_bodies_over_the_limit_are_refused(client):
    r = client.post("/v1/health/live", content=b"x" * 1_048_577, headers={"Content-Type": "application/json"})
    assert r.status_code == 413
