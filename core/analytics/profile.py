"""
Analytics Engine — Market Profile Builder (Phase 11.6).

Сборка полной картины рынка из всех анализаторов.
"""

from __future__ import annotations

import logging
from typing import Any

from core.analytics.dominance import DominanceAnalyzer
from core.analytics.liquidity import LiquidityAnalyzer
from core.analytics.models import MarketProfile, MarketRegime
from core.analytics.regime import RegimeDetector
from core.analytics.session import get_current_session
from core.analytics.volatility import VolatilityAnalyzer

logger = logging.getLogger(__name__)


class ProfileBuilder:
    """Сборка MarketProfile из всех анализаторов."""

    def __init__(self) -> None:
        self._regime = RegimeDetector()
        self._volatility = VolatilityAnalyzer()
        self._liquidity = LiquidityAnalyzer()
        self._dominance = DominanceAnalyzer()
        self._last_profile: MarketProfile | None = None

    def build(
        self,
        symbol: str,
        candles: list[dict[str, Any]],
        bid_ask_spread: float = 0.0,
        order_book_depth: float = 0.0,
        volume: float = 0.0,
        avg_volume: float = 0.0,
        large_trades: int = 0,
        bid_volume: float = 0.0,
        ask_volume: float = 0.0,
        btc_dominance: float = 0.0,
        btc_change_24h: float = 0.0,
        alt_change_24h: float = 0.0,
        dominance_history: list[float] | None = None,
    ) -> MarketProfile:
        """Собрать полную картину рынка."""
        regime = self._regime.detect(candles)
        volatility = self._volatility.analyze(candles)
        liquidity = self._liquidity.analyze(
            bid_ask_spread=bid_ask_spread,
            order_book_depth=order_book_depth,
            volume=volume,
            avg_volume=avg_volume,
            large_trades=large_trades,
            bid_volume=bid_volume,
            ask_volume=ask_volume,
        )
        dominance = self._dominance.analyze(
            btc_dominance=btc_dominance,
            btc_change_24h=btc_change_24h,
            alt_change_24h=alt_change_24h,
            dominance_history=dominance_history,
        )

        session = get_current_session()

        # Силы покупателей/продавцов
        buyer_strength, seller_strength = self._calc_forces(
            regime, volatility, liquidity, candles,
        )

        profile = MarketProfile(
            symbol=symbol,
            regime=regime,
            prev_regime=self._last_profile.regime if self._last_profile else None,
            volatility=volatility,
            liquidity=liquidity,
            dominance=dominance,
            session=session,
            buyer_strength=buyer_strength,
            seller_strength=seller_strength,
        )
        profile.generate_summary()
        self._last_profile = profile
        return profile

    @staticmethod
    def _calc_forces(
        regime: MarketRegime,
        volatility: Any,
        liquidity: Any,
        candles: list[dict],
    ) -> tuple[float, float]:
        """Рассчитать силы покупателей и продавцов.

        Returns:
            (buyer_strength, seller_strength) в [0, 1].
        """
        if not candles or len(candles) < 10:
            return 0.5, 0.5

        closes = [c["close"] for c in candles[-20:]]
        volumes = [c.get("volume", 0) for c in candles[-20:]]

        # Up/down volume
        up_vol = sum(
            volumes[i] for i in range(1, len(closes))
            if closes[i] > closes[i - 1]
        )
        down_vol = sum(
            volumes[i] for i in range(1, len(closes))
            if closes[i] < closes[i - 1]
        )
        total_vol = up_vol + down_vol
        if total_vol == 0:
            return 0.5, 0.5

        # Buyer/seller ratio
        buyer = up_vol / total_vol
        seller = down_vol / total_vol

        # Коррекция на режим
        if regime.regime.value == "trending_bull":
            buyer = min(1.0, buyer * 1.2)
        elif regime.regime.value == "trending_bear":
            seller = min(1.0, seller * 1.2)

        return round(buyer, 4), round(seller, 4)
