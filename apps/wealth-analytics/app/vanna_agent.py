from __future__ import annotations

"""Optional Vanna 2 agent wiring.

The deterministic analytics gateway is the production path for facts. This module
keeps Vanna 2 available for future narrative/tool orchestration without putting
an unrestricted database runner on the public API. The Vanna agent is only
enabled when VANNA_ENABLE_AGENT=true and should be paired with the scoped runner
used by the internal service.
"""

from typing import Any

from .config import settings
from .database import run_scoped_sql
from .secure_sql import validate_read_only_sql


def build_vanna_agent() -> Any | None:
    if not settings.enable_agent or not settings.database_configured:
        return None
    try:
        from vanna import Agent
        from vanna.core.registry import ToolRegistry
        from vanna.core.user import RequestContext, User, UserResolver
        from vanna.integrations.google import GeminiLlmService
        from vanna.integrations.local.agent_memory import DemoAgentMemory
        from vanna.integrations.postgres import PostgresRunner
        import pandas as pd
        from vanna.tools import RunSqlTool, VisualizeDataTool
    except ImportError:
        return None

    class InternalUserResolver(UserResolver):
        async def resolve_user(self, request_context: RequestContext) -> User:
            user_id = request_context.get_header("x-vanna-user-id")
            if not user_id:
                raise PermissionError("A Node-resolved user context is required.")
            return User(id=user_id, email=f"{user_id}@internal.idbi", group_memberships=["wealth_user"])

    class ScopedPostgresRunner(PostgresRunner):
        """Vanna-compatible runner that keeps the app user scope below the model."""

        async def run_sql(self, args: Any, context: Any) -> Any:
            user_id = getattr(getattr(context, "user", None), "id", None)
            if not user_id:
                raise PermissionError("A resolved internal user is required for analytics SQL.")
            statement = validate_read_only_sql(args.sql)
            return pd.DataFrame(run_scoped_sql(user_id, statement))

    # Vanna 2's Agent/ToolRegistry/UserResolver composition is intentionally
    # isolated here. The Node gateway remains the only public caller, while the
    # runner enforces app.user_id and read-only SQL below the model.
    try:
        llm = GeminiLlmService(model=settings.gemini_model, api_key=settings.google_api_key)
        runner = ScopedPostgresRunner(connection_string=settings.database_url)
    except (ImportError, ValueError):
        return None
    tools = ToolRegistry()
    tools.register_local_tool(RunSqlTool(sql_runner=runner), access_groups=["wealth_user"])
    tools.register_local_tool(VisualizeDataTool(), access_groups=["wealth_user"])
    return Agent(
        llm_service=llm,
        tool_registry=tools,
        user_resolver=InternalUserResolver(),
        agent_memory=DemoAgentMemory(max_items=1000),
    )
