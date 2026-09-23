from __future__ import annotations

import re


class QueryRejected(ValueError):
    """Raised when generated SQL is not a single read-only statement."""


_DANGEROUS = re.compile(
    r"\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|call|merge|vacuum|refresh|comment)\b",
    re.IGNORECASE,
)


def validate_read_only_sql(statement: str) -> str:
    sql = statement.strip()
    if not sql or len(sql) > 24_000:
        raise QueryRejected("Query is empty or too large.")
    if "--" in sql or "/*" in sql or "*/" in sql:
        raise QueryRejected("SQL comments are not allowed.")
    without_trailing_semicolon = sql[:-1].rstrip() if sql.endswith(";") else sql
    if ";" in without_trailing_semicolon:
        raise QueryRejected("Multiple SQL statements are not allowed.")
    if not re.match(r"^(select|with)\b", without_trailing_semicolon, re.IGNORECASE):
        raise QueryRejected("Only SELECT or WITH ... SELECT queries are allowed.")
    if _DANGEROUS.search(without_trailing_semicolon):
        raise QueryRejected("The query contains a write or administrative operation.")
    return without_trailing_semicolon
