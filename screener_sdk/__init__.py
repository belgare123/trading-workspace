"""
Screener SDK — публичный API для создания стратегий.

Всё, что нужно автору стратегии, доступно через один импорт:

    from screener_sdk import (
        BaseStrategy,
        StrategyContext,
        Signal,
        SignalBundle,
        SignalDirection,
    )

Никаких импортов из core.* — SDK скрывает внутреннюю архитектуру.
"""

from __future__ import annotations

from typing import Any

# ═══════════════════════════════════════════════════════════════════
#  Версия SDK
# ═══════════════════════════════════════════════════════════════════

SDK_VERSION = "2.0.0"
"""Версия SDK. Меняется при:

  - major: ломающие изменения в BaseStrategy/StrategyContext
  - minor: новые возможности (не ломают старые стратегии)
  - patch: исправления, новые методы
"""

SDK_MIN_CORE = "0.12.0"
"""Минимальная версия ядра, совместимая с этим SDK."""

# ═══════════════════════════════════════════════════════════════════
#  Публичный экспорт — только то, что нужно автору стратегии
# ═══════════════════════════════════════════════════════════════════

# ── Base — основная стратегия ──
from core.strategy.base import BaseStrategy  # noqa: E402, F401

# ── Signal models ──
from core.strategy.signal import (  # noqa: E402, F401
    Opportunity,
    PriceTarget,
    RiskAssessment,
    Signal,
    SignalBundle,
    SignalDirection,
)

# ── Context ──
from core.strategy.context import (  # noqa: E402, F401
    StrategyConfig,
    StrategyContext,
)

# ── Descriptor (read-only для стратегий) ──
from core.strategy.descriptor import (  # noqa: E402, F401
    ManifestError,
    StrategyCategory,
    StrategyDescriptor,
)

# ═══════════════════════════════════════════════════════════════════
#  Утилиты SDK
# ═══════════════════════════════════════════════════════════════════


def version_info() -> dict[str, str]:
    """Информация о версии SDK.

    Returns:
        Словарь: sdk_version, min_core, core_version (если доступна).
    """
    info: dict[str, str] = {
        "sdk_version": SDK_VERSION,
        "sdk_min_core": SDK_MIN_CORE,
    }
    try:
        from core import __version__ as core_version  # type: ignore[attr-defined]

        info["core_version"] = core_version
    except (ImportError, AttributeError):
        info["core_version"] = "unknown"
    return info


__all__ = [
    # SDK
    "SDK_VERSION",
    "SDK_MIN_CORE",
    "version_info",
    # Strategy
    "BaseStrategy",
    # Context
    "StrategyContext",
    "StrategyConfig",
    # Signal models
    "Signal",
    "SignalBundle",
    "SignalDirection",
    "Opportunity",
    "PriceTarget",
    "RiskAssessment",
    # Descriptor (read-only)
    "StrategyDescriptor",
    "StrategyCategory",
    "ManifestError",
]
