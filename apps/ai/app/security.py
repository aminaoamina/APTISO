import secrets

from fastapi import Depends, Header, HTTPException, status

from app.config import Settings, get_settings


def require_service_token(
    x_service_token: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
) -> None:
    """Only the backend may call the service: it sends the shared token in X-Service-Token."""
    expected = settings.ai_service_token.get_secret_value().encode()
    if not x_service_token or not secrets.compare_digest(x_service_token.encode(), expected):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid service token")
