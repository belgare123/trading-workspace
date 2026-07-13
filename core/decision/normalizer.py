"""
Signal Normalizer (7.1) — приведение стратегических сигналов к единому формату.

Каждая стратегия может возвращать сигнал в своём формате.
Normalizer приводит всё к NormalizedSignal.
"""

from __future__ import annotations

import logging
from typing import Any

from core.decision.models import Evidence, NormalizedSignal, SignalDirection

logger = logging.getLogger(__name__)


class NormalizationError(Exception):
    """Ошибка нормализации сигнала."""


# ═══════════════════════════════════════════════════════════════════
#  Normalizer Interface
# ═══════════════════════════════════════════════════════════════════


class SignalNormalizer:
    """Нормализатор сигналов стратегий.

    Преобразует сырой сигнал стратегии в NormalizedSignal.

    Usage:
        normalizer = SignalNormalizer()
        norm = normalizer.normalize("Momentum", {
            "direction": "long",
            "score": 65,
            "confidence": 0.72,
        })
    """

    def normalize(
        self,
        strategy: str,
        raw: dict[str, Any],
        timestamp: float = 0.0,
    ) -> NormalizedSignal:
        """Привести сырой сигнал к единому формату.

        Args:
            strategy: Имя стратегии-источника.
            raw:      Сырой сигнал (dict).
            timestamp: Время создания (unix, 0 = now).

        Returns:
            NormalizedSignal.

        Raises:
            NormalizationError: Если сигнал не удалось распарсить.
        """
        direction = self._parse_direction(raw)
        confidence = self._parse_confidence(raw)
        score = self._parse_score(raw)
        evidence = self._parse_evidence(raw)

        return NormalizedSignal(
            strategy=strategy,
            direction=direction,
            confidence=confidence,
            score=score,
            evidence=evidence,
            timestamp=timestamp,
            meta=self._extract_meta(raw),
        )

    # ── Парсеры для разных полей ──

    @staticmethod
    def _parse_direction(raw: dict[str, Any]) -> SignalDirection:
        """Извлечь направление из сырого сигнала."""
        dir_raw = raw.get("direction", raw.get("side", raw.get("action", "")))
        if isinstance(dir_raw, SignalDirection):
            return dir_raw

        if isinstance(dir_raw, str):
            lower = dir_raw.strip().lower()
            if lower in ("long", "buy", "bull", "up", "l"):
                return SignalDirection.LONG
            if lower in ("short", "sell", "bear", "down", "s"):
                return SignalDirection.SHORT
            if lower in ("neutral", "none", "hold", "flat", "n"):
                return SignalDirection.NEUTRAL

        raise NormalizationError(
            f"Cannot parse direction from: {dir_raw!r}"
        )

    @staticmethod
    def _parse_confidence(raw: dict[str, Any]) -> float:
        """Извлечь confidence (0.0–1.0)."""
        conf = raw.get("confidence", raw.get("conf", raw.get("strength", 0.5)))

        if isinstance(conf, (int, float)):
            # Если confidence > 1, считаем что это проценты / 100
            if conf > 1.0:
                conf = conf / 100.0
            return max(0.0, min(1.0, float(conf)))

        if isinstance(conf, str):
            try:
                val = float(conf.replace("%", "").strip())
                if val > 1.0:
                    val = val / 100.0
                return max(0.0, min(1.0, val))
            except ValueError:
                pass

        return 0.5

    @staticmethod
    def _parse_score(raw: dict[str, Any]) -> float:
        """Извлечь score (сила сигнала)."""
        score = raw.get("score", raw.get("strength", raw.get("value", 0.0)))
        try:
            return float(score)
        except (TypeError, ValueError):
            return 0.0

    @staticmethod
    def _parse_evidence(raw: dict[str, Any]) -> list[Evidence]:
        """Извлечь доказательства из сырого сигнала.

        Поддерживает форматы:
          1. {"evidence": [{"label": "RSI", "weight": 0.3, ...}]}
          2. {"indicators": {"RSI": 72, "EMA": "cross"}, ...}
          3. {"reasons": ["EMA cross", "RSI oversold"], ...}
        """
        evidence: list[Evidence] = []

        # Формат 1: структурированные evidence
        raw_ev = raw.get("evidence", raw.get("proofs", []))
        if raw_ev and isinstance(raw_ev, list):
            for item in raw_ev:
                if isinstance(item, dict):
                    evidence.append(Evidence(
                        label=str(item.get("label", item.get("name", "unknown"))),
                        weight=float(item.get("weight", 1.0)),
                        value=item.get("value"),
                        detail=str(item.get("detail", item.get("desc", ""))),
                    ))
                elif isinstance(item, str):
                    evidence.append(Evidence(label=item, weight=1.0))
            return evidence

        # Формат 2: flat indicators
        indicators = raw.get("indicators", raw.get("features", {}))
        if indicators and isinstance(indicators, dict):
            for key, val in indicators.items():
                evidence.append(Evidence(
                    label=str(key),
                    weight=1.0 / max(len(indicators), 1),
                    value=val,
                ))
            return evidence

        # Формат 3: простой список причин
        reasons = raw.get("reasons", raw.get("tags", []))
        if reasons and isinstance(reasons, list):
            for r in reasons:
                evidence.append(Evidence(
                    label=str(r) if not isinstance(r, str) else r,
                    weight=1.0 / max(len(reasons), 1),
                ))
            return evidence

        return evidence

    @staticmethod
    def _extract_meta(raw: dict[str, Any]) -> dict[str, Any]:
        """Извлечь мета-данные."""
        reserved = {"direction", "side", "action", "confidence", "conf",
                     "strength", "score", "value", "evidence", "proofs",
                     "indicators", "features", "reasons", "tags"}
        return {k: v for k, v in raw.items() if k not in reserved}
