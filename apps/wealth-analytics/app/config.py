from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    host: str = os.getenv("ANALYTICS_HOST", "0.0.0.0")
    port: int = int(os.getenv("ANALYTICS_PORT", "8001"))
    database_url: str = os.getenv("VANNA_DATABASE_URL", "")
    service_secret: str = os.getenv("VANNA_SERVICE_SECRET", "")
    # Vanna's Gemini adapter uses Google's API credential. Accept the
    # existing Node service name as a local-development alias so the same
    # server-side credential can be shared without putting it in Expo.
    google_api_key: str = os.getenv("GOOGLE_API_KEY", "") or os.getenv("GEMINI_API_KEY", "")
    gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    enable_agent: bool = os.getenv("VANNA_ENABLE_AGENT", "false").lower() == "true"
    max_rows: int = min(max(int(os.getenv("ANALYTICS_MAX_ROWS", "500")), 1), 500)
    statement_timeout_ms: int = min(max(int(os.getenv("ANALYTICS_STATEMENT_TIMEOUT_MS", "5000")), 250), 15000)

    @property
    def database_configured(self) -> bool:
        return bool(self.database_url)


settings = Settings()
