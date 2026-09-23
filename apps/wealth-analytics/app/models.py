from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class UserContext(BaseModel):
    internalUserId: str = Field(min_length=1, max_length=160)
    groups: list[str] = Field(default_factory=lambda: ["wealth_user"])
    mode: Literal["demo", "live"] = "demo"


class QueryContext(BaseModel):
    source: str = "wealth-coach"
    previous: dict[str, Any] | None = None
    scope: dict[str, Any] | None = None


class AnalyticsQuery(BaseModel):
    question: str = Field(min_length=1, max_length=1000)
    conversationId: str | None = Field(default=None, max_length=160)
    requestId: str | None = Field(default=None, max_length=160)
    userContext: UserContext
    context: QueryContext = Field(default_factory=QueryContext)


class MetricComparison(BaseModel):
    value: float | None = None
    direction: Literal["up", "down", "flat"] | None = None
    label: str | None = None


class Metric(BaseModel):
    id: str
    label: str
    value: float | str
    format: Literal["currency", "percentage", "number", "text"]
    comparison: MetricComparison | None = None


class ChartPoint(BaseModel):
    label: str
    value: float
    secondaryValue: float | None = None


class Chart(BaseModel):
    type: Literal["donut", "bar", "horizontal_bar", "line", "stacked_bar", "progress"]
    title: str
    data: list[ChartPoint]


class Evidence(BaseModel):
    type: str
    metric: str | None = None
    transactionCount: int | None = None
    total: float | None = None
    period: str | None = None
    transactionIds: list[str] = Field(default_factory=list)


class Period(BaseModel):
    label: str
    start: str
    end: str


class Answer(BaseModel):
    title: str
    summary: str
    detail: str


class WealthAnalyticsResponse(BaseModel):
    requestId: str
    conversationId: str | None = None
    intent: str
    answer: Answer
    period: Period
    metrics: list[Metric] = Field(default_factory=list)
    charts: list[Chart] = Field(default_factory=list)
    table: dict[str, Any] | None = None
    insights: list[str] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)
    evidence: list[Evidence] = Field(default_factory=list)
    followUps: list[str] = Field(default_factory=list)
    dataFreshness: dict[str, str | None] = Field(default_factory=dict)
    context: dict[str, Any] = Field(default_factory=dict)
