"""
Replay Debugger — отладка replay-сессии.

Pause → Current Features → Current Decision → Current Opportunity → Current Lifecycle

Похоже на debugger IDE.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from typing import Any

from core.replay.models import ReplayContext, ReplaySnapshot

logger = logging.getLogger(__name__)


@dataclass
class DebugInspectResult:
    """Результат инспекции текущего состояния."""
    timestamp: float = 0.0
    frame: int = 0
    current_event: dict[str, Any] | None = None
    feature_graph: dict[str, Any] = field(default_factory=dict)
    decision_context: dict[str, Any] = field(default_factory=dict)
    lifecycle_context: dict[str, Any] = field(default_factory=dict)
    signals: list[dict[str, Any]] = field(default_factory=list)
    opportunities: list[dict[str, Any]] = field(default_factory=list)
    metrics: dict[str, Any] = field(default_factory=dict)

    def summary(self) -> str:
        lines = [
            f"[Frame {self.frame} @ {self.timestamp:.3f}]",
            f"  Signals:      {len(self.signals)}",
            f"  Decisions:    {'yes' if self.decision_context else 'no'}",
            f"  Opportunities: {len(self.opportunities)}",
            f"  Features:     {len(self.feature_graph)} keys",
        ]
        return "\n".join(lines)


class ReplayDebugger:
    """Отладчик replay-сессии с инспекцией состояния."""

    def __init__(self) -> None:
        self._breakpoints: list[float] = []
        self._break_on_index: set[int] = set()
        self._inspect_history: list[DebugInspectResult] = []

    def set_breakpoint(self, timestamp: float) -> None:
        """Установить точку остановки на timestamp."""
        if timestamp not in self._breakpoints:
            self._breakpoints.append(timestamp)
            self._breakpoints.sort()
            logger.info("Breakpoint set at %.3f", timestamp)

    def set_break_index(self, index: int) -> None:
        """Установить точку остановки на индекс события."""
        self._break_on_index.add(index)
        logger.info("Breakpoint set at event index %d", index)

    def clear_breakpoints(self) -> None:
        """Очистить все точки остановки."""
        self._breakpoints.clear()
        self._break_on_index.clear()
        logger.info("Breakpoints cleared")

    def should_break(self, timestamp: float, index: int) -> bool:
        """Проверить, нужно ли остановиться."""
        # Точная остановка
        if index in self._break_on_index:
            return True
        # По времени (±50ms)
        for bp in self._breakpoints:
            if abs(timestamp - bp) < 0.05:
                return True
        return False

    def inspect(
        self,
        context: ReplayContext,
        feature_graph_state: dict[str, Any] | None = None,
        decision_context: dict[str, Any] | None = None,
        lifecycle_context: dict[str, Any] | None = None,
        signals: list[dict[str, Any]] | None = None,
        opportunities: list[dict[str, Any]] | None = None,
        metrics: dict[str, Any] | None = None,
    ) -> DebugInspectResult:
        """Инспектировать текущее состояние.

        Returns:
            DebugInspectResult с текущими данными.
        """
        result = DebugInspectResult(
            timestamp=context.current_timestamp,
            frame=context.current_index,
            current_event=(
                context.package.events[context.current_index].to_dict()
                if context.current_index < len(context.package.events)
                else None
            ),
            feature_graph=feature_graph_state or {},
            decision_context=decision_context or {},
            lifecycle_context=lifecycle_context or {},
            signals=signals or [],
            opportunities=opportunities or [],
            metrics=metrics or {},
        )
        self._inspect_history.append(result)
        return result

    @property
    def history(self) -> list[DebugInspectResult]:
        return list(self._inspect_history)

    def replay(self) -> str:
        """Повторить последнюю инспекцию как текстовый лог."""
        if not self._inspect_history:
            return "No inspections recorded."
        return "\n\n".join(r.summary() for r in self._inspect_history[-10:])
