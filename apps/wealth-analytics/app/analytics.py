from __future__ import annotations

import re
from calendar import monthrange
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from .database import run_scoped_sql
from .models import (
    Answer,
    AnalyticsQuery,
    Chart,
    ChartPoint,
    Evidence,
    Metric,
    MetricComparison,
    Period,
    WealthAnalyticsResponse,
)


@dataclass(frozen=True)
class PeriodWindow:
    label: str
    start: date
    end_exclusive: date
    end_display: date

    def model(self) -> Period:
        return Period(label=self.label, start=self.start.isoformat(), end=self.end_display.isoformat())


def _number(value: Any) -> float:
    if value is None:
        return 0.0
    if isinstance(value, Decimal):
        return float(value)
    return float(value)


def _date(value: Any) -> str:
    return value.isoformat() if hasattr(value, "isoformat") else str(value)


def _month_start(value: date) -> date:
    return value.replace(day=1)


def _add_months(value: date, months: int) -> date:
    index = value.year * 12 + value.month - 1 + months
    year, month_index = divmod(index, 12)
    month = month_index + 1
    return date(year, month, 1)


def resolve_period(question: str, previous: dict[str, Any] | None = None) -> PeriodWindow:
    today = date.today()
    current_start = _month_start(today)
    if re.search(r"\b(last 6 months|six months)\b", question.lower()):
        start = _add_months(current_start, -5)
        return PeriodWindow(f"{start.strftime('%b %Y')}–{today.strftime('%b %Y')}", start, today + timedelta(days=1), today)
    if re.search(r"\b(last 3 months|three months)\b", question.lower()):
        start = _add_months(current_start, -2)
        return PeriodWindow(f"{start.strftime('%b %Y')}–{today.strftime('%b %Y')}", start, today + timedelta(days=1), today)
    if re.search(r"\b(last month|previous month)\b", question.lower()):
        previous_start = _add_months(current_start, -1)
        return PeriodWindow(previous_start.strftime("%B %Y"), previous_start, current_start, current_start - timedelta(days=1))
    return PeriodWindow(today.strftime("%B %Y"), current_start, today + timedelta(days=1), today)


def classify(question: str, previous: dict[str, Any] | None = None) -> str:
    text = question.lower()
    if re.search(r"\b(what if|if i|reduce .* by|save another)\b", text):
        return "scenario_analysis"
    if re.search(r"\b(net worth|wealth|assets|liabilities)\b", text):
        return "wealth_analysis"
    if re.search(r"\b(goal|emergency fund|reach my)\b", text):
        return "goal_analysis"
    if re.search(r"\b(subscription|recurring|monthly payments)\b", text):
        return "recurring_payment_analysis"
    if re.search(r"\b(transaction|transactions|purchase|purchases)\b", text):
        return "transaction_analysis"
    if re.search(r"\b(merchant|swiggy|zomato|amazon|uber|biggest expense|biggest expenses|largest purchase|largest expenses)\b", text):
        return "merchant_analysis"
    if re.search(r"\b(compare|compared|versus|vs|why .* higher|increased)\b", text) or (previous and re.search(r"\b(last month|previous month|higher|increased)\b", text)):
        return "comparison"
    if re.search(r"\b(income|salary|earned|comes from)\b", text):
        return "income_analysis"
    if re.search(r"\b(saving|savings rate|save)\b", text):
        return "savings_analysis"
    if re.search(r"\b(where|spend|expense|expenses|money goes|breakdown|finances)\b", text):
        return "expense_analysis"
    return "financial_overview"


def _metric(metric_id: str, label: str, value: float, fmt: str = "currency", comparison: MetricComparison | None = None) -> Metric:
    return Metric(id=metric_id, label=label, value=round(value, 2), format=fmt, comparison=comparison)


def _comparison(current: float, previous: float, label: str = "vs last month") -> MetricComparison:
    difference = current - previous
    direction = "up" if difference > 0.005 else "down" if difference < -0.005 else "flat"
    percentage = None if previous == 0 else round((difference / previous) * 100, 2)
    return MetricComparison(value=percentage, direction=direction, label=label)


def _category_rows(user_id: str, window: PeriodWindow) -> list[dict[str, Any]]:
    return run_scoped_sql(
        user_id,
        """
        SELECT category, category_name, total_spent, transaction_count,
               previous_period_spend, difference, percentage_change
        FROM analytics.category_spending
        WHERE month >= %s AND month < %s
        ORDER BY total_spent DESC
        LIMIT 50
        """,
        (window.start, window.end_exclusive),
    )


def _cashflow_rows(user_id: str, window: PeriodWindow) -> list[dict[str, Any]]:
    return run_scoped_sql(
        user_id,
        """
        SELECT month, income, expenses, savings, savings_rate
        FROM analytics.monthly_cashflow
        WHERE month >= %s AND month < %s
        ORDER BY month
        LIMIT 24
        """,
        (window.start, window.end_exclusive),
    )


def _period_evidence(category: str | None, rows: list[dict[str, Any]], window: PeriodWindow) -> list[Evidence]:
    if not rows:
        return []
    total = sum(_number(row.get("total_spent")) for row in rows)
    count = sum(int(row.get("transaction_count") or 0) for row in rows)
    return [Evidence(type="transaction_aggregation", metric=category, transactionCount=count, total=round(total, 2), period=window.start.strftime("%Y-%m"))]


def _overview(user_id: str, window: PeriodWindow, query: AnalyticsQuery) -> WealthAnalyticsResponse:
    cashflow = _cashflow_rows(user_id, window)
    categories = _category_rows(user_id, window)
    income_rows = run_scoped_sql(
        user_id,
        """
        SELECT category_name, SUM(total_income)::numeric AS total_income, SUM(transaction_count)::int AS transaction_count
        FROM analytics.income_summary
        WHERE month >= %s AND month < %s
        GROUP BY category_name
        ORDER BY total_income DESC
        LIMIT 20
        """,
        (window.start, window.end_exclusive),
    )
    current = cashflow[-1] if cashflow else {}
    if not cashflow and not categories:
        return WealthAnalyticsResponse(
            requestId=query.requestId or "analytics-request",
            conversationId=query.conversationId,
            intent="financial_overview",
            answer=Answer(title="Financial data unavailable", summary="No matching financial records are available for this profile and period.", detail="This does not establish zero income or zero spending; the linked data may be incomplete or not yet synchronized."),
            period=window.model(), metrics=[], charts=[], table=None, insights=[], recommendations=["Refresh your linked accounts or choose a wider period."], evidence=[], followUps=["Show my accounts", "How can I improve my savings?"], dataFreshness={"lastUpdated": None}, context={"intent": "financial_overview", "period": window.model().model_dump()},
        )
    income = _number(current.get("income"))
    expenses = _number(current.get("expenses"))
    savings = _number(current.get("savings"))
    rate = _number(current.get("savings_rate"))
    category_points = [ChartPoint(label=str(row["category_name"]), value=_number(row["total_spent"])) for row in categories[:6]]
    if len(categories) > 6:
        category_points.append(ChartPoint(label="Other", value=sum(_number(row["total_spent"]) for row in categories[6:])))
    trend_points = [ChartPoint(label=_date(row["month"])[:7], value=_number(row["income"]), secondaryValue=_number(row["expenses"])) for row in cashflow]
    charts = [Chart(type="donut", title="Where your money went", data=category_points)] if category_points else []
    if trend_points:
        charts.append(Chart(type="stacked_bar", title="Income vs expenses", data=trend_points))
        charts.append(Chart(type="line", title="Savings trend", data=[ChartPoint(label=_date(row["month"])[:7], value=_number(row["savings"])) for row in cashflow]))
    observations: list[str] = []
    if categories:
        observations.append(f"{categories[0]['category_name']} is your largest expense category at ₹{_number(categories[0]['total_spent']):,.0f} this period.")
    if rate >= 30:
        observations.append(f"Your savings rate is {rate:.1f}%, which gives you useful room for goal planning.")
    elif income:
        observations.append(f"Your savings rate is {rate:.1f}%; reviewing the largest expense categories may improve your monthly surplus.")
    return WealthAnalyticsResponse(
        requestId=query.requestId or "analytics-request",
        conversationId=query.conversationId,
        intent="financial_overview",
        answer=Answer(
            title="Financial overview",
            summary=f"You received ₹{income:,.0f}, spent ₹{expenses:,.0f}, and saved ₹{savings:,.0f} in {window.label}.",
            detail="The figures below are calculated from completed, user-scoped INR transactions. Transfers between accounts are excluded from income and spending.",
        ),
        period=window.model(),
        metrics=[_metric("income", "Income", income), _metric("expenses", "Expenses", expenses), _metric("savings", "Saved", savings), _metric("savings-rate", "Savings rate", rate, "percentage")],
        charts=charts,
        table={"columns": ["Category", "Spent", "Transactions"], "rows": [[row["category_name"], _number(row["total_spent"]), int(row["transaction_count"])] for row in categories[:10]]},
        insights=observations,
        recommendations=["Review the largest category before changing long-term investments.", "Use the savings figure as the starting point for a goal contribution plan."],
        evidence=_period_evidence(None, categories, window),
        followUps=["Where did I spend the most this month?", "How much am I saving?", "How is my emergency fund progressing?"],
        dataFreshness={"lastUpdated": _date(window.end_display)},
        context={"intent": "financial_overview", "period": window.model().model_dump()},
    )


def _expense(user_id: str, window: PeriodWindow, query: AnalyticsQuery, comparison: bool = False) -> WealthAnalyticsResponse:
    categories = _category_rows(user_id, window)
    question = query.question.lower()
    requested = next((row for row in categories if any(word in str(row["category"]).lower() or word in str(row["category_name"]).lower() for word in ["food", "dining", "shopping", "transport", "utility", "bill"] if word in question)), None)
    target = requested or (categories[0] if categories else None)
    if not categories:
        return WealthAnalyticsResponse(
            requestId=query.requestId or "analytics-request",
            conversationId=query.conversationId,
            intent="comparison" if comparison else "expense_analysis",
            answer=Answer(title="Spending data unavailable", summary=f"No matching spending records are available for {window.label}.", detail="This does not establish zero spending; the available transaction coverage may be incomplete."),
            period=window.model(), metrics=[], charts=[], table={"columns": ["Category", "Spent", "Transactions"], "rows": []}, insights=[], recommendations=["Refresh your linked accounts or choose a wider period."], evidence=[], followUps=["Compare this with last month", "Show my biggest expenses"], dataFreshness={"lastUpdated": None}, context={"intent": "category_analysis", "period": window.model().model_dump()},
        )
    if target and requested is None and not re.search(r"where did|most|breakdown|finances", question):
        target = next((row for row in categories if "food" in question and "food" in str(row["category_name"]).lower()), target)
    total = sum(_number(row["total_spent"]) for row in categories)
    title = "Spending breakdown"
    summary = f"You spent ₹{total:,.0f} in {window.label}."
    insights: list[str] = []
    if target:
        previous = _number(target.get("previous_period_spend"))
        current = _number(target.get("total_spent"))
        title = f"{target['category_name']} spending"
        summary = f"{target['category_name']} was ₹{current:,.0f} in {window.label}."
        if previous:
            change = current - previous
            insights.append(f"That is ₹{abs(change):,.0f} {'higher' if change >= 0 else 'lower'} than the previous period.")
    points = [ChartPoint(label=str(row["category_name"]), value=_number(row["total_spent"])) for row in categories[:6]]
    if len(categories) > 6:
        points.append(ChartPoint(label="Other", value=sum(_number(row["total_spent"]) for row in categories[6:])))
    metric = _metric("total-expenses", "Expenses", total)
    if target:
        metric = _metric("category-spend", str(target["category_name"]), _number(target["total_spent"]), comparison=_comparison(_number(target["total_spent"]), _number(target.get("previous_period_spend"))))
    return WealthAnalyticsResponse(
        requestId=query.requestId or "analytics-request",
        conversationId=query.conversationId,
        intent="comparison" if comparison else "expense_analysis",
        answer=Answer(title=title, summary=summary, detail="Completed debits are grouped by normalized category; transfers, refunds, and failed or pending records are not treated as spending."),
        period=window.model(),
        metrics=[metric],
        charts=[Chart(type="donut", title="Where your money went", data=points)] if points else [],
        table={"columns": ["Category", "Spent", "Transactions"], "rows": [[row["category_name"], _number(row["total_spent"]), int(row["transaction_count"])] for row in categories[:10]]},
        insights=insights,
        recommendations=[f"Review {target['category_name']} against the previous period." if target else "Add more completed transactions to compare spending patterns."],
        evidence=_period_evidence(str(target["category_name"]) if target else None, [target] if target else categories, window),
        followUps=["Compare this with last month", "Show my biggest expenses", "Show recurring expenses"],
        dataFreshness={"lastUpdated": _date(window.end_display)},
        context={"intent": "category_analysis", "category": target.get("category") if target else None, "period": window.model().model_dump()},
    )


def _income_or_savings(user_id: str, window: PeriodWindow, query: AnalyticsQuery, savings: bool) -> WealthAnalyticsResponse:
    rows = _cashflow_rows(user_id, window)
    current = rows[-1] if rows else {}
    if not rows:
        label = "savings" if savings else "income"
        return WealthAnalyticsResponse(
            requestId=query.requestId or "analytics-request", conversationId=query.conversationId,
            intent="savings_analysis" if savings else "income_analysis",
            answer=Answer(title=f"{label.title()} data unavailable", summary=f"No monthly {label} records are available for {window.label}.", detail="This does not establish zero income or zero savings; available data may be incomplete."), period=window.model(), metrics=[], charts=[], table=None, insights=[], recommendations=["Refresh your linked accounts or choose a wider period."], evidence=[], followUps=["Where did I spend the most this month?"], dataFreshness={"lastUpdated": None}, context={"intent": "savings_analysis" if savings else "income_analysis", "period": window.model().model_dump()},
        )
    income = _number(current.get("income"))
    expenses = _number(current.get("expenses"))
    saved = _number(current.get("savings"))
    rate = _number(current.get("savings_rate"))
    chosen = saved if savings else income
    label = "Savings" if savings else "Income"
    return WealthAnalyticsResponse(
        requestId=query.requestId or "analytics-request",
        conversationId=query.conversationId,
        intent="savings_analysis" if savings else "income_analysis",
        answer=Answer(title=f"{label} analysis", summary=f"Your {label.lower()} was ₹{chosen:,.0f} in {window.label}.", detail=f"Income was ₹{income:,.0f}, expenses were ₹{expenses:,.0f}, and the calculated savings rate was {rate:.1f}%.") ,
        period=window.model(),
        metrics=[_metric("income", "Income", income), _metric("expenses", "Expenses", expenses), _metric("savings", "Saved", saved), _metric("savings-rate", "Savings rate", rate, "percentage")],
        charts=[Chart(type="line", title="Savings trend", data=[ChartPoint(label=_date(row["month"])[:7], value=_number(row["savings"])) for row in rows])],
        table={"columns": ["Month", "Income", "Expenses", "Saved", "Savings rate"], "rows": [[_date(row["month"])[:7], _number(row["income"]), _number(row["expenses"]), _number(row["savings"]), _number(row["savings_rate"])] for row in rows]},
        insights=[f"You saved {rate:.1f}% of income in the latest available month."],
        recommendations=["Consider directing a consistent part of this surplus toward an active goal."],
        evidence=[Evidence(type="monthly_cashflow", total=chosen, period=window.start.strftime("%Y-%m"))],
        followUps=["How can I improve my savings?", "How is my emergency fund progressing?", "Show income versus expenses for the last six months"],
        dataFreshness={"lastUpdated": _date(window.end_display)},
        context={"intent": "savings_analysis" if savings else "income_analysis", "period": window.model().model_dump()},
    )


def _goals(user_id: str, window: PeriodWindow, query: AnalyticsQuery) -> WealthAnalyticsResponse:
    rows = run_scoped_sql(user_id, "SELECT goal_id, goal_name, target_amount, current_amount, remaining_amount, progress_percentage, target_date, monthly_contribution FROM analytics.goal_progress WHERE status = 'active' ORDER BY progress_percentage ASC LIMIT 20")
    charts = [Chart(type="progress", title="Goal progress", data=[ChartPoint(label=str(row["goal_name"]), value=_number(row["progress_percentage"])) for row in rows])]
    table = {"columns": ["Goal", "Current", "Target", "Remaining", "Progress"], "rows": [[row["goal_name"], _number(row["current_amount"]), _number(row["target_amount"]), _number(row["remaining_amount"]), _number(row["progress_percentage"])] for row in rows]}
    details = " ".join(f"{row['goal_name']} is {_number(row['progress_percentage']):.0f}% complete with ₹{_number(row['remaining_amount']):,.0f} remaining." for row in rows[:3]) or "No active goals are available."
    return WealthAnalyticsResponse(requestId=query.requestId or "analytics-request", conversationId=query.conversationId, intent="goal_analysis", answer=Answer(title="Goal progress", summary=details, detail="Progress is current amount divided by target amount. Monthly contribution suggestions are calculations, not executed transfers."), period=window.model(), metrics=[_metric("active-goals", "Active goals", len(rows), "number")], charts=charts if rows else [], table=table, insights=[], recommendations=["Choose one active goal and compare its remaining amount with your monthly surplus."], evidence=[Evidence(type="goal_progress", metric=str(row["goal_name"]), total=_number(row["current_amount"]), period=_date(row["target_date"]) if row.get("target_date") else None) for row in rows], followUps=["How much do I need to save each month to reach my goal?", "What happens if I save ₹2,000 more each month?"], dataFreshness={"lastUpdated": _date(window.end_display)}, context={"intent": "goal_analysis", "period": window.model().model_dump()})


def _recurring(user_id: str, window: PeriodWindow, query: AnalyticsQuery) -> WealthAnalyticsResponse:
    rows = run_scoped_sql(user_id, "SELECT merchant, estimated_monthly_amount, estimated_annual_amount, transaction_count FROM analytics.recurring_payments ORDER BY estimated_monthly_amount DESC LIMIT 20")
    monthly = sum(_number(row["estimated_monthly_amount"]) for row in rows)
    return WealthAnalyticsResponse(requestId=query.requestId or "analytics-request", conversationId=query.conversationId, intent="recurring_payment_analysis", answer=Answer(title="Recurring payments", summary=f"Your estimated recurring commitments are ₹{monthly:,.0f} per month." if rows else "No recurring payment pattern was established in the available data.", detail="Recurring payments are inferred from repeated completed debits across multiple months; review the evidence before acting."), period=window.model(), metrics=[_metric("recurring-monthly", "Estimated monthly recurring", monthly), _metric("recurring-annual", "Annualized recurring", monthly * 12)] if rows else [], table={"columns": ["Merchant", "Monthly estimate", "Annualized", "Transactions"], "rows": [[row["merchant"], _number(row["estimated_monthly_amount"]), _number(row["estimated_annual_amount"]), int(row["transaction_count"])] for row in rows]}, insights=[], recommendations=["Review recurring merchants you no longer use before cancelling anything."] if rows else ["Refresh your linked accounts or choose a wider period."], evidence=[Evidence(type="recurring_payment", metric=str(row["merchant"]), total=_number(row["estimated_monthly_amount"]), period=window.start.strftime("%Y-%m")) for row in rows], followUps=["Show my biggest expenses", "How can I improve my savings?"], dataFreshness={"lastUpdated": _date(window.end_display) if rows else None}, context={"intent": "recurring_payment_analysis", "period": window.model().model_dump()})


def _merchant(user_id: str, window: PeriodWindow, query: AnalyticsQuery) -> WealthAnalyticsResponse:
    rows = run_scoped_sql(user_id, """
        SELECT merchant, category_name, SUM(amount)::numeric AS total_spent,
               COUNT(*)::int AS transaction_count
        FROM analytics.user_transactions
        WHERE transaction_date >= %s AND transaction_date < %s
          AND currency = 'INR' AND direction = 'debit'
          AND status = 'completed' AND NOT is_internal_transfer AND NOT is_refund
        GROUP BY merchant, category_name
        ORDER BY total_spent DESC
        LIMIT 20
    """, (window.start, window.end_exclusive))
    if not rows:
        return WealthAnalyticsResponse(requestId=query.requestId or "analytics-request", conversationId=query.conversationId, intent="merchant_analysis", answer=Answer(title="Merchant data unavailable", summary=f"No matching merchant spending records are available for {window.label}.", detail="This does not establish zero spending; available transaction coverage may be incomplete."), period=window.model(), metrics=[], charts=[], table={"columns": ["Merchant", "Spent", "Transactions"], "rows": []}, insights=[], recommendations=["Refresh your linked accounts or choose a wider period."], evidence=[], followUps=["Where did I spend the most this month?"], dataFreshness={"lastUpdated": None}, context={"intent": "merchant_analysis", "period": window.model().model_dump()})
    top = rows[0]
    points = [ChartPoint(label=str(row["merchant"]), value=_number(row["total_spent"])) for row in rows[:8]]
    return WealthAnalyticsResponse(requestId=query.requestId or "analytics-request", conversationId=query.conversationId, intent="merchant_analysis", answer=Answer(title="Largest merchants", summary=f"{top['merchant']} was your largest merchant expense at ₹{_number(top['total_spent']):,.0f} in {window.label}.", detail="Merchant totals include completed INR debits and exclude transfers, refunds, and failed or pending records."), period=window.model(), metrics=[_metric("top-merchant", str(top["merchant"]), _number(top["total_spent"]))], charts=[Chart(type="horizontal_bar", title="Largest merchant expenses", data=points)], table={"columns": ["Merchant", "Category", "Spent", "Transactions"], "rows": [[row["merchant"], row["category_name"], _number(row["total_spent"]), int(row["transaction_count"])] for row in rows]}, insights=[f"The top {min(3, len(rows))} merchants account for ₹{sum(_number(row['total_spent']) for row in rows[:3]):,.0f} in this period."], recommendations=["Open the transaction list before deciding whether a merchant expense is recurring or discretionary."], evidence=[Evidence(type="merchant_aggregation", metric=str(row["merchant"]), transactionCount=int(row["transaction_count"]), total=_number(row["total_spent"]), period=window.start.strftime("%Y-%m")) for row in rows[:8]], followUps=["Show my transactions", "Show recurring expenses", "How can I improve my savings?"], dataFreshness={"lastUpdated": _date(window.end_display)}, context={"intent": "merchant_analysis", "period": window.model().model_dump()})


def _transactions(user_id: str, window: PeriodWindow, query: AnalyticsQuery) -> WealthAnalyticsResponse:
    rows = run_scoped_sql(user_id, "SELECT transaction_id, merchant, description, category_name, amount, direction, transaction_date, status FROM analytics.user_transactions WHERE transaction_date >= %s AND transaction_date < %s AND status = 'completed' ORDER BY transaction_date DESC, amount DESC LIMIT 50", (window.start, window.end_exclusive))
    if not rows:
        return WealthAnalyticsResponse(requestId=query.requestId or "analytics-request", conversationId=query.conversationId, intent="transaction_analysis", answer=Answer(title="Transactions unavailable", summary=f"No completed transactions are available for {window.label}.", detail="This does not establish that no activity occurred; the available data may be incomplete."), period=window.model(), metrics=[], charts=[], table={"columns": ["Merchant", "Category", "Amount", "Date"], "rows": []}, insights=[], recommendations=["Refresh your linked accounts or choose a wider period."], evidence=[], followUps=["Where did I spend the most this month?"], dataFreshness={"lastUpdated": None}, context={"intent": "transaction_analysis", "period": window.model().model_dump()})
    debit = sum(_number(row["amount"]) for row in rows if row["direction"] == "debit")
    return WealthAnalyticsResponse(requestId=query.requestId or "analytics-request", conversationId=query.conversationId, intent="transaction_analysis", answer=Answer(title="Recent transactions", summary=f"Showing {len(rows)} completed transactions for {window.label}.", detail="Transactions are scoped to this profile and include both credits and debits. Transfers and refunds are labelled in the table."), period=window.model(), metrics=[_metric("transaction-count", "Transactions", len(rows), "number"), _metric("transaction-debits", "Debits shown", debit)], charts=[], table={"columns": ["Merchant", "Category", "Amount", "Direction", "Date"], "rows": [[row["merchant"], row["category_name"], _number(row["amount"]), row["direction"], _date(row["transaction_date"])] for row in rows[:30]]}, insights=[], recommendations=["Ask about a merchant or category to turn this list into a spending analysis."], evidence=[Evidence(type="transaction_list", transactionCount=len(rows), period=window.start.strftime("%Y-%m"), transactionIds=[str(row["transaction_id"]) for row in rows])], followUps=["Show my biggest expenses", "Compare this with last month"], dataFreshness={"lastUpdated": _date(window.end_display)}, context={"intent": "transaction_analysis", "period": window.model().model_dump()})


def _wealth(user_id: str, window: PeriodWindow, query: AnalyticsQuery) -> WealthAnalyticsResponse:
    rows = run_scoped_sql(user_id, "SELECT total_assets, total_liabilities, net_worth, cash_savings, deposits, investments, other_assets FROM analytics.net_worth_summary LIMIT 1")
    row = rows[0] if rows else {}
    if not row:
        return WealthAnalyticsResponse(requestId=query.requestId or "analytics-request", conversationId=query.conversationId, intent="wealth_analysis", answer=Answer(title="Wealth data unavailable", summary="No account balance snapshot is available for this profile.", detail="This does not establish zero net worth; account coverage may be incomplete."), period=window.model(), metrics=[], charts=[], table=None, insights=[], recommendations=["Open the Accounts tab and refresh your linked accounts."], evidence=[], followUps=["Show my accounts", "How am I progressing toward my goals?"], dataFreshness={"lastUpdated": None}, context={"intent": "wealth_analysis", "period": window.model().model_dump()})
    assets = _number(row.get("total_assets"))
    liabilities = _number(row.get("total_liabilities"))
    net_worth = _number(row.get("net_worth"))
    return WealthAnalyticsResponse(requestId=query.requestId or "analytics-request", conversationId=query.conversationId, intent="wealth_analysis", answer=Answer(title="Your wealth", summary=f"Your current net worth is ₹{net_worth:,.0f}.", detail="Net worth is total reported account assets minus reported liabilities. The current demo schema has no liability feed, so liabilities are shown as zero until one is linked."), period=window.model(), metrics=[_metric("total-assets", "Total assets", assets), _metric("total-liabilities", "Total liabilities", liabilities), _metric("net-worth", "Net worth", net_worth)], charts=[Chart(type="donut", title="Assets breakdown", data=[ChartPoint(label="Cash / Savings", value=_number(row.get("cash_savings"))), ChartPoint(label="Deposits", value=_number(row.get("deposits")))])], table=None, insights=[], recommendations=["Use cash flow and goal progress alongside net worth when planning a purchase."], evidence=[Evidence(type="net_worth_snapshot", total=net_worth, period=_date(window.end_display))], followUps=["Show income versus expenses for the last six months", "How is my emergency fund progressing?"], dataFreshness={"lastUpdated": _date(window.end_display)}, context={"intent": "wealth_analysis", "period": window.model().model_dump()})


def _scenario(user_id: str, window: PeriodWindow, query: AnalyticsQuery) -> WealthAnalyticsResponse:
    match = re.search(r"(?:₹|rs\.?\s*)?(\d[\d,]*(?:\.\d+)?)", query.question.lower())
    reduction = float(match.group(1).replace(",", "")) if match else 2000.0
    categories = _category_rows(user_id, window)
    target = next((row for row in categories if "food" in query.question.lower() and "food" in str(row["category_name"]).lower()), categories[0] if categories else None)
    if not target:
        return WealthAnalyticsResponse(requestId=query.requestId or "analytics-request", conversationId=query.conversationId, intent="scenario_analysis", answer=Answer(title="Scenario unavailable", summary=f"There is not enough spending data to simulate this change for {window.label}.", detail="A scenario is only shown when matching completed spending records are available."), period=window.model(), metrics=[], charts=[], table=None, insights=[], recommendations=["Refresh your linked accounts or choose a wider period."], evidence=[], followUps=["Where did I spend the most this month?"], dataFreshness={"lastUpdated": None}, context={"intent": "scenario_analysis", "period": window.model().model_dump()})
    current = _number(target.get("total_spent")) if target else 0.0
    monthly_saving = min(reduction, current) if current else reduction
    return WealthAnalyticsResponse(requestId=query.requestId or "analytics-request", conversationId=query.conversationId, intent="scenario_analysis", answer=Answer(title="Spending scenario", summary=f"Reducing this spending by ₹{monthly_saving:,.0f} per month could free ₹{monthly_saving * 12:,.0f} over a year.", detail=f"Current {target['category_name'] if target else 'selected spending'} is ₹{current:,.0f} for {window.label}. This is a simulation only and does not change your accounts or goals."), period=window.model(), metrics=[_metric("current-spend", "Current spending", current), _metric("monthly-reduction", "Potential monthly saving", monthly_saving), _metric("annual-impact", "Potential annual saving", monthly_saving * 12)], charts=[], table=None, insights=["A scenario is not a forecast; it assumes the reduction continues consistently."], recommendations=["Compare the simulated saving with the remaining amount on your emergency fund."], evidence=_period_evidence(str(target["category_name"]) if target else None, [target] if target else categories, window), followUps=["How is my emergency fund progressing?", "Show my recurring expenses"], dataFreshness={"lastUpdated": _date(window.end_display)}, context={"intent": "scenario_analysis", "category": target.get("category") if target else None, "period": window.model().model_dump()})


def answer_query(query: AnalyticsQuery) -> WealthAnalyticsResponse:
    user_id = query.userContext.internalUserId
    intent = classify(query.question, query.context.previous)
    # A comparison displays the current period and derives the prior period
    # from the analytics view's lagged comparison columns.
    if intent == "comparison":
        today = date.today()
        current_start = _month_start(today)
        window = PeriodWindow(today.strftime("%B %Y"), current_start, today + timedelta(days=1), today)
    else:
        window = resolve_period(query.question, query.context.previous)
    if intent == "financial_overview":
        return _overview(user_id, window, query)
    if intent in {"expense_analysis", "comparison"}:
        return _expense(user_id, window, query, comparison=intent == "comparison")
    if intent == "income_analysis":
        return _income_or_savings(user_id, window, query, savings=False)
    if intent == "savings_analysis":
        return _income_or_savings(user_id, window, query, savings=True)
    if intent == "goal_analysis":
        return _goals(user_id, window, query)
    if intent == "recurring_payment_analysis":
        return _recurring(user_id, window, query)
    if intent == "merchant_analysis":
        return _merchant(user_id, window, query)
    if intent == "transaction_analysis":
        return _transactions(user_id, window, query)
    if intent == "wealth_analysis":
        return _wealth(user_id, window, query)
    return _scenario(user_id, window, query)
