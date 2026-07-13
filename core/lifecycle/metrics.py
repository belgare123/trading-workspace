"""
8.8 Lifecycle Metrics — финальные метрики для закрытой сделки.

Автоматически вычисляет:
  - Lifetime
  - Activation Time
  - Holding Time
  - MFE / MAE
  - RR
  - PnL
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from typing import Any

from core.lifecycle.models import LifecycleMetrics, Position, Trade

logger = logging.getLogger(__name__)


@dataclass
class FinalMetrics:
    """Итоговые метрики для закрытой сделки.

    Attributes:
        lifetime:       Полное время жизни Opportunity (создание → закрытие).
        activation_time:Время от CREATED до ACTIVE.
        holding_time:   Время от ACTIVE до закрытия.
        mfe:            Max Favorable Excursion (максимальное движение в +).
        mae:            Max Adverse Excursion (максимальное движение в -).
        rr:             Risk/Reward ratio.
        pnl:            PnL в %.
        pnl_abs:        PnL в абсолютных единицах.
        volatility:     Волатильность за время жизни.
        entry_efficiency: Насколько близко к entry был вход (0-1).
    """
    lifetime: float = 0.0
    activation_time: float = 0.0
    holding_time: float = 0.0
    mfe: float = 0.0
    mae: float = 0.0
    rr: float = 0.0
    pnl: float = 0.0
    pnl_abs: float = 0.0
    volatility: float = 0.0
    entry_efficiency: float = 0.0
    max_drawdown: float = 0.0
    profit_factor: float = 0.0
    score: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "lifetime": round(self.lifetime, 1),
            "activation_time": round(self.activation_time, 1),
            "holding_time": round(self.holding_time, 1),
            "mfe": round(self.mfe, 2),
            "mae": round(self.mae, 2),
            "rr": round(self.rr, 4),
            "pnl": round(self.pnl, 2),
            "pnl_abs": round(self.pnl_abs, 2),
            "volatility": round(self.volatility, 4),
            "entry_efficiency": round(self.entry_efficiency, 4),
            "max_drawdown": round(self.max_drawdown, 2),
            "profit_factor": round(self.profit_factor, 4),
            "score": round(self.score, 2),
        }


class MetricsCalculator:
    """Калькулятор метрик жизненного цикла.

    Usage:
        calculator = MetricsCalculator()
        metrics = calculator.calculate(
            position=position,
            trade=trade,
            created_at=1718000000.0,
            activated_at=1718000500.0,
        )
    """

    def calculate(
        self,
        position: Position,
        trade: Trade | None = None,
        created_at: float = 0.0,
        activated_at: float = 0.0,
        current_metrics: LifecycleMetrics | None = None,
    ) -> FinalMetrics:
        """Вычислить финальные метрики.

        Args:
            position:         Закрытая позиция.
            trade:            Trade (если есть).
            created_at:       Timestamp создания Opportunity.
            activated_at:     Timestamp активации.
            current_metrics:  Текущие метрики (для MFE/MAE, если trade не задан).

        Returns:
            FinalMetrics.
        """
        now = time.time()
        closed_at = position.closed_at or now

        # Time
        lifetime = closed_at - created_at if created_at > 0 else 0.0
        activation_time = activated_at - created_at if activated_at > 0 and created_at > 0 else 0.0
        holding_time = position.holding_time

        # MFE / MAE
        if trade:
            mfe = trade.mfe
            mae = trade.mae
        elif current_metrics:
            mfe = current_metrics.mfe
            mae = current_metrics.mae
        else:
            mfe = 0.0
            mae = 0.0

        # PnL & RR
        if trade:
            pnl = trade.pnl_pct
            pnl_abs = trade.pnl
            rr = trade.rr
        else:
            pnl = 0.0
            pnl_abs = 0.0
            rr = 0.0

        # Volatility
        if position.highest_price > 0 and position.lowest_price > 0 and position.entry_price > 0:
            volatility = (position.highest_price - position.lowest_price) / position.entry_price * 100
        else:
            volatility = 0.0

        # Entry efficiency
        entry_efficiency = 1.0

        # Max drawdown
        max_drawdown = current_metrics.current_drawdown if current_metrics else 0.0

        # Profit factor
        profit_factor = rr if rr > 0 else 0.0

        # Score (composite)
        score = self._calculate_score(
            pnl=pnl,
            rr=rr,
            mfe=mfe,
            mae=mae,
            holding_time=holding_time,
        )

        return FinalMetrics(
            lifetime=lifetime,
            activation_time=activation_time,
            holding_time=holding_time,
            mfe=mfe,
            mae=mae,
            rr=rr,
            pnl=pnl,
            pnl_abs=pnl_abs,
            volatility=volatility,
            entry_efficiency=entry_efficiency,
            max_drawdown=max_drawdown,
            profit_factor=profit_factor,
            score=score,
        )

    def _calculate_score(
        self,
        pnl: float,
        rr: float,
        mfe: float,
        mae: float,
        holding_time: float,
    ) -> float:
        """Композитный скоринг сделки (0-100).

        Формула:
          score = rr_contrib * 40 + pnl_contrib * 30 + efficiency * 20 - time_penalty * 10

        Args:
            pnl:          PnL %.
            rr:           RR.
            mfe:          MFE %.
            mae:          MAE %.
            holding_time: Holding time в секундах.

        Returns:
            Score (0-100).
        """
        # RR contribution (0-40)
        rr_score = min(40.0, rr * 20.0)

        # PnL contribution (0-30)
        pnl_score = min(30.0, max(0.0, pnl * 3.0))

        # Efficiency (0-20): MFE vs MAE
        total = mfe + mae
        efficiency = (mfe / total * 20) if total > 0 else 0.0
        efficiency = min(20.0, efficiency)

        # Time penalty (0-10)
        hours = holding_time / 3600
        time_penalty = min(10.0, hours * 2.0)

        score = rr_score + pnl_score + efficiency - time_penalty
        return max(0.0, min(100.0, score))
