"""
Quality Engine — 12 Metrics (Phase 10.1).

Все метрики рассчитываются из списка закрытых сделок (Trade).
Каждая сделка должна содержать:
  - pnl (float, абсолютный)
  - pnl_pct (float, процентный)
  - holding_time (float, секунды)
  - rr (float, R:R)
  - entry_price, exit_price
"""

from __future__ import annotations

import math
import statistics
from typing import Any

from core.quality.models import MetricName, MetricValue


def calc_win_rate(trades: list[dict[str, Any]]) -> MetricValue:
    """Win Rate — доля прибыльных сделок."""
    if not trades:
        return MetricValue(name=MetricName.WIN_RATE, value=0.0, grade="N/A")
    wins = sum(1 for t in trades if t.get("pnl", 0) > 0)
    wr = wins / len(trades)
    grade = _grade_pct(wr, thresholds=[0.70, 0.55, 0.40])
    return MetricValue(name=MetricName.WIN_RATE, value=wr * 100, grade=grade)


def calc_profit_factor(trades: list[dict[str, Any]]) -> MetricValue:
    """Profit Factor — отношение gross profit к gross loss."""
    gross_profit = sum(t.get("pnl", 0) for t in trades if t.get("pnl", 0) > 0)
    gross_loss = abs(sum(t.get("pnl", 0) for t in trades if t.get("pnl", 0) < 0))
    pf = gross_profit / gross_loss if gross_loss > 0 else (gross_profit if gross_profit > 0 else 1.0)
    grade = _grade_value(pf, thresholds=[2.0, 1.5, 1.0])
    return MetricValue(name=MetricName.PROFIT_FACTOR, value=round(pf, 4), grade=grade)


def calc_expectancy(trades: list[dict[str, Any]]) -> MetricValue:
    """Expectancy — средняя ожидаемая прибыль на сделку в R."""
    if not trades:
        return MetricValue(name=MetricName.EXPECTANCY, value=0.0, grade="N/A")
    win_trades = [t for t in trades if t.get("pnl", 0) > 0]
    loss_trades = [t for t in trades if t.get("pnl", 0) <= 0]
    win_rate = len(win_trades) / len(trades) if trades else 0
    avg_win_r = statistics.mean([t.get("rr", 0) for t in win_trades]) if win_trades else 0
    avg_loss_r = abs(statistics.mean([t.get("rr", 0) for t in loss_trades]) or 0) if loss_trades else 0
    e = win_rate * avg_win_r - (1 - win_rate) * avg_loss_r
    grade = _grade_value(e, thresholds=[0.5, 0.2, 0.0])
    return MetricValue(name=MetricName.EXPECTANCY, value=round(e, 4), grade=grade)


def calc_sharpe(trades: list[dict[str, Any]], risk_free_rate: float = 0.0) -> MetricValue:
    """Sharpe ratio."""
    if len(trades) < 3:
        return MetricValue(name=MetricName.SHARPE, value=0.0, grade="N/A")
    returns = [t.get("pnl_pct", 0) for t in trades]
    if all(r == 0 for r in returns):
        return MetricValue(name=MetricName.SHARPE, value=0.0, grade="N/A")
    mean_r = statistics.mean(returns)
    std_r = statistics.stdev(returns) if len(returns) > 1 else 1.0
    sharpe = (mean_r - risk_free_rate) / std_r if std_r > 0 else 0.0
    sharpe_annualized = sharpe * math.sqrt(365)
    grade = _grade_value(sharpe_annualized, thresholds=[2.0, 1.0, 0.5])
    return MetricValue(name=MetricName.SHARPE, value=round(sharpe_annualized, 4), grade=grade)


def calc_sortino(trades: list[dict[str, Any]], risk_free_rate: float = 0.0) -> MetricValue:
    """Sortino ratio (downside deviation только)."""
    if len(trades) < 3:
        return MetricValue(name=MetricName.SORTINO, value=0.0, grade="N/A")
    returns = [t.get("pnl_pct", 0) for t in trades]
    if all(r == 0 for r in returns):
        return MetricValue(name=MetricName.SORTINO, value=0.0, grade="N/A")
    mean_r = statistics.mean(returns)
    downside = [r - risk_free_rate for r in returns if r < risk_free_rate]
    downside_std = statistics.stdev(downside) if len(downside) > 1 else (abs(mean_r) if mean_r != 0 else 1.0)
    sortino = (mean_r - risk_free_rate) / downside_std if downside_std > 0 else 0.0
    sortino_annualized = sortino * math.sqrt(365)
    grade = _grade_value(sortino_annualized, thresholds=[2.0, 1.0, 0.5])
    return MetricValue(name=MetricName.SORTINO, value=round(sortino_annualized, 4), grade=grade)


def calc_max_drawdown(trades: list[dict[str, Any]]) -> MetricValue:
    """Maximum drawdown в процентах (на основе PnL)."""
    if not trades:
        return MetricValue(name=MetricName.MAX_DRAWDOWN, value=0.0, grade="N/A")
    cumulative = 0.0
    peak = -float("inf")
    max_dd_pct = 0.0
    for t in trades:
        cumulative += t.get("pnl", 0)
        if cumulative > peak:
            peak = cumulative
        if peak > 0:
            dd_pct = (peak - cumulative) / peak * 100
            if dd_pct > max_dd_pct:
                max_dd_pct = dd_pct
        # Если ещё не было пика — считаем от первого положительного
        elif peak <= 0 and cumulative < 0:
            # Плавающий депозит — максимальный DD пока не определим
            pass
    # Ограничиваем 100%
    max_dd_pct = min(max_dd_pct, 100.0)
    grade = _grade_value(max_dd_pct, thresholds=[5, 15, 30], reverse=True)
    return MetricValue(name=MetricName.MAX_DRAWDOWN, value=round(max_dd_pct, 2), grade=grade)


def calc_recovery_factor(trades: list[dict[str, Any]]) -> MetricValue:
    """Recovery Factor — total return / max drawdown."""
    if not trades:
        return MetricValue(name=MetricName.RECOVERY_FACTOR, value=0.0, grade="N/A")
    total_return = sum(t.get("pnl", 0) for t in trades)
    peak = 0.0
    cumulative = 0.0
    max_dd = 0.0
    for t in trades:
        cumulative += t.get("pnl", 0)
        if cumulative > peak:
            peak = cumulative
        dd = peak - cumulative
        if dd > max_dd:
            max_dd = dd
    rf = total_return / max_dd if max_dd > 0 else (total_return if total_return > 0 else 0.0)
    grade = _grade_value(rf, thresholds=[5.0, 2.0, 1.0])
    return MetricValue(name=MetricName.RECOVERY_FACTOR, value=round(rf, 4), grade=grade)


def calc_avg_r_ratio(trades: list[dict[str, Any]]) -> MetricValue:
    """Average R:R (Risk-to-Reward) по закрытым сделкам."""
    if not trades:
        return MetricValue(name=MetricName.AVG_R_RATIO, value=0.0, grade="N/A")
    rr_values = [t.get("rr", 0) for t in trades if t.get("rr", 0) > 0]
    avg_rr = statistics.mean(rr_values) if rr_values else 0.0
    grade = _grade_value(avg_rr, thresholds=[3.0, 1.5, 0.5])
    return MetricValue(name=MetricName.AVG_R_RATIO, value=round(avg_rr, 4), grade=grade)


def calc_avg_hold(trades: list[dict[str, Any]]) -> MetricValue:
    """Average holding time в минутах."""
    if not trades:
        return MetricValue(name=MetricName.AVG_HOLD, value=0.0, grade="N/A")
    holds = [t.get("holding_time", 0) for t in trades if t.get("holding_time", 0) > 0]
    avg_hold_sec = statistics.mean(holds) if holds else 0.0
    avg_hold_min = avg_hold_sec / 60.0
    # Ниже — лучше для скальпинга, но нейтрально
    return MetricValue(name=MetricName.AVG_HOLD, value=round(avg_hold_min, 1), grade="")


def calc_signal_precision(trades: list[dict[str, Any]]) -> MetricValue:
    """Signal Precision — доля сделок, где entry был лучше или равен сигнальному.

    Простейшая аппроксимация: win rate взвешенный на confidence.
    """
    if not trades:
        return MetricValue(name=MetricName.SIGNAL_PRECISION, value=0.0, grade="N/A")
    wins = sum(1 for t in trades if t.get("pnl", 0) > 0)
    sp = wins / len(trades) if trades else 0.0
    grade = _grade_pct(sp, thresholds=[0.65, 0.50, 0.35])
    return MetricValue(name=MetricName.SIGNAL_PRECISION, value=sp * 100, grade=grade)


def calc_false_positive_rate(trades: list[dict[str, Any]]) -> MetricValue:
    """False Positive Rate — доля убыточных сделок."""
    if not trades:
        return MetricValue(name=MetricName.FALSE_POSITIVE_RATE, value=0.0, grade="N/A")
    losses = sum(1 for t in trades if t.get("pnl", 0) <= 0)
    fpr = losses / len(trades) if trades else 0.0
    grade = _grade_pct(fpr, thresholds=[0.30, 0.45, 0.60], reverse=True)
    return MetricValue(name=MetricName.FALSE_POSITIVE_RATE, value=fpr * 100, grade=grade)


def calc_confidence(trades: list[dict[str, Any]]) -> MetricValue:
    """Confidence — уровень доверия к данным."""
    n = len(trades)
    if n >= 100:
        grade = "A"
    elif n >= 50:
        grade = "B"
    elif n >= 10:
        grade = "C"
    else:
        grade = "D"
    return MetricValue(name=MetricName.CONFIDENCE, value=float(n), grade=grade)


# ═══════════════════════════════════════════════════════════════════
#  Helpers
# ═══════════════════════════════════════════════════════════════════


def _grade_pct(value: float, thresholds: list[float], reverse: bool = False) -> str:
    """Преобразовать процент в A/B/C/D.

    Args:
        value: Значение (0-100).
        thresholds: Границы [A, B, C].
        reverse: True = чем ниже, тем лучше.
    """
    if reverse:
        if value <= thresholds[0]:
            return "A"
        elif value <= thresholds[1]:
            return "B"
        elif value <= thresholds[2]:
            return "C"
        return "D"
    if value >= thresholds[0]:
        return "A"
    elif value >= thresholds[1]:
        return "B"
    elif value >= thresholds[2]:
        return "C"
    return "D"


def _grade_value(value: float, thresholds: list[float], reverse: bool = False) -> str:
    """Преобразовать числовое значение в A/B/C/D."""
    if reverse:
        if value <= thresholds[0]:
            return "A"
        elif value <= thresholds[1]:
            return "B"
        elif value <= thresholds[2]:
            return "C"
        return "D"
    if value >= thresholds[0]:
        return "A"
    elif value >= thresholds[1]:
        return "B"
    elif value >= thresholds[2]:
        return "C"
    return "D"
