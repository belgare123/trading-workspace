"""
Learning Engine — Anomaly Detector (Phase 13.5).

Обнаружение аномалий с помощью ML/Z-score.
"""

from __future__ import annotations

import logging
import statistics
from typing import Any

from core.learning.models import Anomaly, AnomalyType, LearningEvent

logger = logging.getLogger(__name__)


class AnomalyDetector:
    """Детектор аномалий на основе статистики и ML.

    Обнаруживает:
      - Аномалии цены
      - Аномалии объёма
      - Сдвиги волатильности
      - Падение ликвидности
    """

    def __init__(self, z_threshold: float = 2.5) -> None:
        self.z_threshold = z_threshold
        self._price_history: list[float] = []
        self._volume_history: list[float] = []
        self._volatility_history: list[float] = []

    def detect_price(self, price: float, symbol: str = "") -> Anomaly | None:
        """Обнаружить ценовую аномалию (Z-score)."""
        self._price_history.append(price)
        if len(self._price_history) < 20:
            return None
        recent = self._price_history[-20:]
        mean = statistics.mean(recent)
        std = statistics.stdev(recent)
        if std == 0:
            return None
        z = (price - mean) / std
        if abs(z) > self.z_threshold:
            return Anomaly(
                anomaly_type=AnomalyType.PRICE_JUMP,
                severity=min(1.0, abs(z) / 10),
                symbol=symbol,
                description=f"Price anomaly: {price:.2f} (z={z:.2f})",
                expected_value=mean,
                actual_value=price,
                confidence=min(1.0, abs(z) / 5),
            )
        return None

    def detect_volume(self, volume: float, symbol: str = "") -> Anomaly | None:
        """Обнаружить аномалию объёма."""
        self._volume_history.append(volume)
        if len(self._volume_history) < 10:
            return None
        recent = self._volume_history[-10:]
        mean = statistics.mean(recent)
        std = statistics.stdev(recent)
        if std == 0:
            return None
        z = (volume - mean) / std
        if z > self.z_threshold:
            return Anomaly(
                anomaly_type=AnomalyType.VOLUME_SPIKE,
                severity=min(1.0, z / 20),
                symbol=symbol,
                description=f"Volume spike: {volume:.1f} (z={z:.2f})",
                expected_value=mean,
                actual_value=volume,
                confidence=min(1.0, z / 10),
            )
        return None

    def detect_volatility_shift(self, atr_ratio: float, symbol: str = "") -> Anomaly | None:
        """Обнаружить сдвиг волатильности."""
        self._volatility_history.append(atr_ratio)
        if len(self._volatility_history) < 10:
            return None
        recent = self._volatility_history[-10:]
        mean = statistics.mean(recent)
        std = statistics.stdev(recent)
        if std == 0:
            return None
        z = (atr_ratio - mean) / std
        if abs(z) > self.z_threshold:
            return Anomaly(
                anomaly_type=AnomalyType.VOLATILITY_SHIFT,
                severity=min(1.0, abs(z) / 10),
                symbol=symbol,
                description=f"Volatility shift: {atr_ratio:.2f} (z={z:.2f})",
                expected_value=mean,
                actual_value=atr_ratio,
            )
        return None

    def detect_liquidity_drop(self, volume_ratio: float, symbol: str = "") -> Anomaly | None:
        """Обнаружить падение ликвидности."""
        if volume_ratio < 0.2:
            return Anomaly(
                anomaly_type=AnomalyType.LIQUIDITY_DROP,
                severity=min(1.0, (0.2 - volume_ratio) * 5),
                symbol=symbol,
                description=f"Liquidity drop: {volume_ratio:.2f} of avg",
                expected_value=1.0,
                actual_value=volume_ratio,
            )
        return None

    def clear(self) -> None:
        self._price_history.clear()
        self._volume_history.clear()
        self._volatility_history.clear()
