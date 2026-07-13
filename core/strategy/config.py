"""EngineConfig — настройки StrategyEngine.

Вынесены из engine.py для декомпозиции (Step 7).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Optional

from core.strategy.sandbox import SandboxConfig
from core.strategy.context import SessionInfo
from core.strategy.signal import Signal


@dataclass
class EngineConfig:
    """Настройки StrategyEngine.

    Attributes:
        strategies_dir:     Путь к директории со стратегиями.
        auto_discovery:     Автоматически сканировать strategies_dir при start().
        analyze_on_tick:    Запускать analyze() всех стратегий при каждом tick().
        tick_interval:      Интервал между tick() в секундах (0 = ручной режим).
        warmup_on_start:    Запускать warmup() после initialize().
        on_signal:          Callback при новом сигнале.
        session:            Информация о сессии для всех стратегий.
        default_config:     Настройки по умолчанию для всех стратегий.
    """

    strategies_dir: str = "strategies"
    auto_discovery: bool = True
    analyze_on_tick: bool = True
    tick_interval: float = 0.0
    warmup_on_start: bool = True
    on_signal: Optional[Callable[[Signal], None]] = None
    session: Optional[SessionInfo] = None
    default_config: dict[str, Any] = field(default_factory=dict)
    sandbox: SandboxConfig = field(default_factory=SandboxConfig.default)
    discovery_engine: Any = None
    plugin_registry: Any = None
    registry_path: str | None = None
