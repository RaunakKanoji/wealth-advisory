from __future__ import annotations

import logging
import secrets
import uuid
from typing import Any

from fastapi import FastAPI, Header, HTTPException

from .analytics import answer_query
from .config import settings
from .database import DatabaseUnavailable, health_check
from .models import AnalyticsQuery, WealthAnalyticsResponse
from .vanna_agent import build_vanna_agent

logging.basicConfig(level=logging.INFO, format="[WEALTH-ANALYTICS] %(message)s")
logger = logging.getLogger("wealth-analytics")
vanna_agent = build_vanna_agent()

app = FastAPI(
    title="IDBI Wealth Analytics",
    version="0.1.0",
    docs_url=None,
    redoc_url=None,
)


def require_internal_secret(value: str | None) -> None:
    if not settings.service_secret or not value or not secrets.compare_digest(value, settings.service_secret):
        raise HTTPException(status_code=401, detail={"code": "UNAUTHORIZED", "message": "Internal analytics authentication is required."})


@app.get("/health")
def health() -> dict[str, Any]:
    database = health_check()
    return {
        "status": "ok" if database["reachable"] else "degraded",
        "service": "idbi-wealth-analytics",
        "database": database,
        "vannaAgent": {"configured": settings.enable_agent, "available": vanna_agent is not None},
        "readOnly": True,
    }


@app.get("/internal/health/database")
def database_health(x_vanna_service_secret: str | None = Header(default=None)) -> dict[str, Any]:
    require_internal_secret(x_vanna_service_secret)
    database = health_check()
    return {"status": "ok" if database["reachable"] else "error", **database}


@app.post("/internal/query", response_model=WealthAnalyticsResponse)
def query(
    request: AnalyticsQuery,
    x_vanna_service_secret: str | None = Header(default=None),
) -> WealthAnalyticsResponse:
    require_internal_secret(x_vanna_service_secret)
    request_id = request.requestId or f"vanna_{uuid.uuid4().hex}"
    request.requestId = request_id
    try:
        response = answer_query(request)
        logger.info("analytics_query request_id=%s intent=%s user_scoped=true", request_id, response.intent)
        return response
    except DatabaseUnavailable as error:
        logger.warning("analytics_query_failed request_id=%s code=DATABASE_UNAVAILABLE", request_id)
        raise HTTPException(status_code=503, detail={"code": "DATABASE_UNAVAILABLE", "message": str(error), "requestId": request_id}) from error
    except ValueError as error:
        logger.info("analytics_query_rejected request_id=%s code=QUERY_REJECTED", request_id)
        raise HTTPException(status_code=422, detail={"code": "QUERY_REJECTED", "message": str(error), "requestId": request_id}) from error
    except Exception as error:
        logger.exception("analytics_query_failed request_id=%s code=UNKNOWN_ERROR", request_id)
        raise HTTPException(status_code=500, detail={"code": "UNKNOWN_ERROR", "message": "The financial analysis could not be completed.", "requestId": request_id}) from error
