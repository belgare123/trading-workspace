"""
Analytics Engine — Liquidity Profile (Phase 11.3).
"""

from __future__ import annotations

import logging
from typing import Any

from core.analytics.models import LiquidityProfile, LiquidityState

logger = logging.getLogger(__name__)


class LiquidityAnalyzer:
    """Анализ ликвидности."""

    def analyze(
        self,
        bid_ask_spread: float = 0.0,
        order_book_depth: float = 0.0,
        volume: float = 0.0,
        avg_volume: float = 0.0,
        large_trades: int = 0,
        bid_volume: float = 0.0,
        ask_volume: float = 0.0,
    ) -> LiquidityProfile:
        """Рассчитать профиль ликвидности.

        Args:
            bid_ask_spread: Текущий спред.
            order_book_depth: Глубина книги (в Base currency).
            volume: Текущий объём.
            avg_volume: Средний объём.
            large_trades: Количество крупных сделок.
            bid_volume: Суммарный объём бидов.
            ask_volume: Суммарный объём асков.
        """
        volume_ratio = volume / avg_volume if avg_volume > 0 else 1.0
        imbalance = self._calc_imbalance(bid_volume, ask_volume)

        # Определение состояния
        if bid_ask_spread > 0.01 or volume_ratio < 0.2:
            state = LiquidityState.DRY
        elif bid_ask_spread > 0.005 or volume_ratio < 0.5:
            state = LiquidityState.LOW
        elif bid_ask_spread < 0.001 and volume_ratio > 1.5:
            state = LiquidityState.HIGH
        else:
            state = LiquidityState.MEDIUM

        return LiquidityProfile(
            state=state,
            bid_ask_spread=bid_ask_spread,
            order_book_depth=order_book_depth,
            volume_ratio=round(volume_ratio, 4),
            large_trades=large_trades,
            imbalance=round(imbalance, 4),
        )

    @staticmethod
    def _calc_imbalance(bid_vol: float, ask_vol: float) -> float:
        """Дисбаланс книги заявок (-1 = все продавцы, +1 = все покупатели)."""
        total = bid_vol + ask_vol
        if total == 0:
            return 0.0
        return (bid_vol - ask_vol) / total
