from __future__ import annotations

from collections.abc import Sequence
from contextlib import contextmanager
from typing import Any, Iterator

import psycopg
from psycopg.rows import dict_row

from .config import settings
from .secure_sql import validate_read_only_sql


class DatabaseUnavailable(RuntimeError):
    pass


@contextmanager
def scoped_connection(user_id: str) -> Iterator[psycopg.Connection[Any]]:
    if not settings.database_url:
        raise DatabaseUnavailable("VANNA_DATABASE_URL is not configured.")
    try:
        with psycopg.connect(settings.database_url, row_factory=dict_row) as connection:
            connection.execute("SELECT set_config('app.user_id', %s, true)", (user_id,))
            connection.execute("SELECT set_config('statement_timeout', %s, true)", (f"{settings.statement_timeout_ms}ms",))
            yield connection
            connection.commit()
    except psycopg.Error as error:
        raise DatabaseUnavailable("The analytics database is temporarily unavailable.") from error


def run_scoped_sql(user_id: str, statement: str, params: Sequence[Any] = ()) -> list[dict[str, Any]]:
    sql = validate_read_only_sql(statement)
    with scoped_connection(user_id) as connection:
        with connection.cursor() as cursor:
            cursor.execute(sql, params)
            rows = cursor.fetchmany(settings.max_rows + 1)
            if len(rows) > settings.max_rows:
                rows = rows[: settings.max_rows]
            return [dict(row) for row in rows]


def health_check() -> dict[str, Any]:
    if not settings.database_url:
        return {"configured": False, "reachable": False, "readOnly": True}
    try:
        with psycopg.connect(settings.database_url, row_factory=dict_row) as connection:
            row = connection.execute("SELECT 1 AS ok").fetchone()
            return {"configured": True, "reachable": row and row["ok"] == 1, "readOnly": True}
    except psycopg.Error:
        return {"configured": True, "reachable": False, "readOnly": True}
