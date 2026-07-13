"""
Analytics Engine — Data Models (Phase 11).

Рыночные режимы, профили и события аналитики.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class RegimeType(Enum):
    """Тип рыночного режима."""
    TRENDING_BULL = "trending_bull"
    TRENDING_BEAR = "trending_bear"
    RANGING = "ranging"
    HIGH_VOLATILITY = "high_volatility"
    LOW_VOLATILITY = "low_volatility"
    BREAKOUT = "breakout"
    CRASH = "crash"
    RECOVERY = "recovery"
    DISTRIBUTION = "distribution"
    ACCUMULATION = "accumulation"
    UNKNOWN = "unknown"


class SessionType(Enum):
    """Торговая сессия."""
    ASIA = "asia"
    LONDON = "london"
    NEW_YORK = "new_york"
    OVERLAP_LONDON_NY = "overlap_london_ny"
    OVERLAP_ASIA_LONDON = "overlap_asia_london"
    CLOSED = "closed"


class VolatilityState(Enum):
    """Состояние волатильности."""
    EXPANDING = "expanding"
    CONTRACTING = "contracting"
    STABLE = "stable"
    SPIKE = "spike"


class LiquidityState(Enum):
    """Состояние ликвидности."""
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    DRY = "dry"  # экстремально низкая


class DominanceTrend(Enum):
    """Тренд доминирования BTC."""
    BTC_RISING = "btc_rising"        # BTC растёт, альты падают
    BTC_FALLING = "btc_falling"      # BTC падает, альты растут
    BTC_STABLE = "btc_stable"        # BTC стабилен, альты следуют
    ALT_SEASON = "alt_season"        # Альты сильно опережают BTC
    FLIGHT_TO_BTC = "flight_to_btc"  # Бегство в BTC


@dataclass
class MarketRegime:
    """Текущий рыночный режим."""
    regime: RegimeType = RegimeType.UNKNOWN
    confidence: float = 0.0  # 0..1
    duration_bars: int = 0
    strength: float = 0.0    # -1..1
    timestamp: float = 0.0

    def __post_init__(self) -> None:
        if self.timestamp == 0.0:
            self.timestamp = time.time()

    def to_dict(self) -> dict[str, Any]:
        return {
            "regime": self.regime.value,
            "confidence": round(self.confidence, 2),
            "duration_bars": self.duration_bars,
            "strength": round(self.strength, 2),
            "timestamp": self.timestamp,
        }


@dataclass
class VolatilityProfile:
    """Профиль волатильности."""
    state: VolatilityState = VolatilityState.STABLE
    current_atr: float = 0.0
    atr_percent: float = 0.0       # ATR% от цены
    atr_ratio: float = 1.0         # Текущий ATR / средний ATR
    bb_width: float = 0.0          # Ширина полос Боллинджера
    bb_ratio: float = 1.0          # Текущая / средняя ширина
    historical_percentile: float = 50.0  # Перцентиль волатильности

    def to_dict(self) -> dict[str, Any]:
        return {
            "state": self.state.value,
            "current_atr": round(self.current_atr, 4),
            "atr_percent": round(self.atr_percent, 4),
            "atr_ratio": round(self.atr_ratio, 4),
            "bb_width": round(self.bb_width, 4),
            "bb_ratio": round(self.bb_ratio, 4),
            "historical_percentile": round(self.historical_percentile, 1),
        }


@dataclass
class LiquidityProfile:
    """Профиль ликвидности."""
    state: LiquidityState = LiquidityState.MEDIUM
    bid_ask_spread: float = 0.0
    order_book_depth: float = 0.0
    volume_ratio: float = 1.0      # Текущий объём / средний
    large_trades: int = 0          # Количество крупных сделок
    imbalance: float = 0.0         # Дисбаланс книги (-1..1)

    def to_dict(self) -> dict[str, Any]:
        return {
            "state": self.state.value,
            "bid_ask_spread": round(self.bid_ask_spread, 6),
            "order_book_depth": round(self.order_book_depth, 2),
            "volume_ratio": round(self.volume_ratio, 2),
            "large_trades": self.large_trades,
            "imbalance": round(self.imbalance, 4),
        }


@dataclass
class DominanceProfile:
    """Профиль доминирования BTC."""
    btc_dominance: float = 0.0     # BTC dominance %
    trend: DominanceTrend = DominanceTrend.BTC_STABLE
    btc_change_24h: float = 0.0
    alt_change_24h: float = 0.0
    dominance_change_24h: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "btc_dominance": round(self.btc_dominance, 2),
            "trend": self.trend.value,
            "btc_change_24h": round(self.btc_change_24h, 2),
            "alt_change_24h": round(self.alt_change_24h, 2),
            "dominance_change_24h": round(self.dominance_change_24h, 2),
        }


@dataclass
class MarketProfile:
    """Полная картина рынка.

    Сегодня:
      рынок трендовый
      сила покупателей высокая
      BTC доминирует
      альты слабые
      volatility expanding
      liquidity low
    """
    symbol: str = ""
    timestamp: float = 0.0

    # Режим
    regime: MarketRegime = field(default_factory=MarketRegime)
    prev_regime: MarketRegime | None = None

    # Профили
    volatility: VolatilityProfile = field(default_factory=VolatilityProfile)
    liquidity: LiquidityProfile = field(default_factory=LiquidityProfile)
    dominance: DominanceProfile = field(default_factory=DominanceProfile)

    # Силы
    buyer_strength: float = 0.0   # 0..1
    seller_strength: float = 0.0  # 0..1
    session: SessionType = SessionType.CLOSED

    # Сводка
    summary: str = ""

    def __post_init__(self) -> None:
        if self.timestamp == 0.0:
            self.timestamp = time.time()

    @property
    def dominant_side(self) -> str:
        if self.buyer_strength > self.seller_strength + 0.1:
            return "buyers"
        elif self.seller_strength > self.buyer_strength + 0.1:
            return "sellers"
        return "neutral"

    def generate_summary(self) -> str:
        parts = []
        parts.append(f"режим: {self.regime.regime.value}")
        parts.append(f"сила покупателей: {self._fmt_strength(self.buyer_strength)}")
        parts.append(f"сила продавцов: {self._fmt_strength(self.seller_strength)}")
        parts.append(f"волатильность: {self.volatility.state.value}")
        parts.append(f"ликвидность: {self.liquidity.state.value}")
        if self.dominance.trend != DominanceTrend.BTC_STABLE:
            parts.append(f"доминирование: {self.dominance.trend.value}")
        parts.append(f"сессия: {self.session.value}")
        self.summary = ", ".join(parts)
        return self.summary

    @staticmethod
    def _fmt_strength(s: float) -> str:
        if s >= 0.8:
            return "очень высокая"
        elif s >= 0.6:
            return "высокая"
        elif s >= 0.4:
            return "средняя"
        elif s >= 0.2:
            return "низкая"
        return "очень низкая"

    def to_dict(self) -> dict[str, Any]:
        return {
            "symbol": self.symbol,
            "timestamp": self.timestamp,
            "regime": self.regime.to_dict(),
            "prev_regime": self.prev_regime.to_dict() if self.prev_regime else None,
            "volatility": self.volatility.to_dict(),
            "liquidity": self.liquidity.to_dict(),
            "dominance": self.dominance.to_dict(),
            "buyer_strength": round(self.buyer_strength, 2),
            "seller_strength": round(self.seller_strength, 2),
            "session": self.session.value,
            "summary": self.summary or self.generate_summary(),
        }


@dataclass
class AnalyticsEvent:
    """Событие аналитики."""
    event_type: str
    symbol: str
    profile: MarketProfile | None = None
    regime_before: RegimeType | None = None
    regime_after: RegimeType | None = None
    timestamp: float = 0.0


    def __post_init__(self) -> None:
        if self.timestamp == 0.0:
            self.timestamp = time.time()

    def to_dict(self) -> dict[str, Any]:
        return {
            "event_type": self.event_type,
            "symbol": self.symbol,
            "regime_before": self.regime_before.value if self.regime_before else None,
            "regime_after": self.regime_after.value if self.regime_after else None,
            "timestamp": self.timestamp,
        }


@dataclass
class MarketHeatmap:
    """Тепловая карта рынка."""
    timestamp: float = 0.0
    symbols: dict[str, MarketProfile] = field(default_factory=dict)
    top_gainers: list[str] = field(default_factory=list)
    top_losers: list[str] = field(default_factory=list)
    sectors: dict[str, float] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if self.timestamp == 0.0:
            self.timestamp = time.time()

    def to_dict(self) -> dict[str, Any]:
        return {
            "timestamp": self.timestamp,
            "top_gainers": self.top_gainers[:10],
            "top_losers": self.top_losers[:10],
            "sectors": self.sectors,
            "symbols": {k: v.to_dict() for k, v in self.symbols.items()},
        }
