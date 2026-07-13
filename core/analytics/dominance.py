"""
Analytics Engine — Dominance Profile (Phase 11.4).
"""

from __future__ import annotations

import logging
from typing import Any

from core.analytics.models import DominanceProfile, DominanceTrend

logger = logging.getLogger(__name__)


class DominanceAnalyzer:
    """Анализ доминирования BTC."""

    def analyze(
        self,
        btc_dominance: float = 0.0,
        btc_change_24h: float = 0.0,
        alt_change_24h: float = 0.0,
        dominance_history: list[float] | None = None,
    ) -> DominanceProfile:
        """Рассчитать профиль доминирования.

        Args:
            btc_dominance: Текущий % доминирования BTC.
            btc_change_24h: Изменение BTC за 24ч (%).
            alt_change_24h: Изменение альтов за 24ч (%).
            dominance_history: История доминирования для тренда.
        """
        change_24h = btc_dominance - (dominance_history[-2] if dominance_history and len(dominance_history) > 1 else btc_dominance)

        # Определение тренда
        if btc_change_24h > 2 and alt_change_24h < -1:
            trend = DominanceTrend.BTC_RISING
        elif btc_change_24h < -1 and alt_change_24h > 2:
            if abs(alt_change_24h) > abs(btc_change_24h) * 1.5:
                trend = DominanceTrend.ALT_SEASON
            else:
                trend = DominanceTrend.BTC_FALLING
        elif btc_change_24h > 0 and alt_change_24h > 0 and btc_change_24h > alt_change_24h:
            trend = DominanceTrend.FLIGHT_TO_BTC
        else:
            trend = DominanceTrend.BTC_STABLE

        return DominanceProfile(
            btc_dominance=btc_dominance,
            trend=trend,
            btc_change_24h=btc_change_24h,
            alt_change_24h=alt_change_24h,
            dominance_change_24h=round(change_24h, 4),
        )
