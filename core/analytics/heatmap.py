"""
Analytics Engine — Market Heatmap (Phase 11.7).
"""

from __future__ import annotations

import logging
from typing import Any

from core.analytics.models import MarketHeatmap, MarketProfile

logger = logging.getLogger(__name__)


class HeatmapBuilder:
    """Построение тепловой карты рынка."""

    def build(
        self,
        profiles: dict[str, MarketProfile],
    ) -> MarketHeatmap:
        """Построить тепловую карту из профилей символов."""
        if not profiles:
            return MarketHeatmap()

        # Расчет изменений
        changes = []
        for symbol, profile in profiles.items():
            regime = profile.regime
            # Сила = buyer_strength - seller_strength
            strength = profile.buyer_strength - profile.seller_strength
            changes.append((symbol, strength))

        changes.sort(key=lambda x: x[1], reverse=True)
        top_gainers = [s for s, _ in changes[:5]]
        top_losers = [s for s, _ in changes[-5:]]

        # Сектора (упрощённо: группируем по тикеру)
        sectors: dict[str, float] = {}
        for symbol, profile in profiles.items():
            # Определяем сектор по первому символу
            sector = self._classify_sector(symbol)
            strength = profile.buyer_strength - profile.seller_strength
            if sector in sectors:
                sectors[sector] = (sectors[sector] + strength) / 2
            else:
                sectors[sector] = strength

        return MarketHeatmap(
            symbols=profiles,
            top_gainers=top_gainers,
            top_losers=top_losers,
            sectors=sectors,
        )

    @staticmethod
    def _classify_sector(symbol: str) -> str:
        """Определить сектор по символу."""
        symbol_upper = symbol.upper()
        if symbol_upper in ("BTC", "BTCUSDT"):
            return "BTC"
        elif symbol_upper in ("ETH", "ETHUSDT"):
            return "ETH"
        elif any(x in symbol_upper for x in ("SOL", "ADA", "DOT", "AVAX", "MATIC")):
            return "L1"
        elif any(x in symbol_upper for x in ("BNB", "FTT", "CRO", "LEO", "OKB")):
            return "CEX"
        elif any(x in symbol_upper for x in ("AAVE", "MKR", "COMP")):
            return "DeFi"
        return "Other"
