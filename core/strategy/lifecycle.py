"""
Plugin Lifecycle — состояния плагина и валидация переходов.

Жизненный цикл стратегии от обнаружения до удаления:

    DISCOVERED
        │
        ▼
    VALIDATED
        │
        ▼
    INSTALLED
        │
        ▼
    INITIALIZED
        │
        ▼
    RUNNING ◄──────────┐
        │               │
    ┌───┴───┐           │
    ▼       ▼           │
  PAUSED  STOPPED ──────┤
    │       │           │
    ▼       ▼           │
  FAILED ──► REMOVED    │
    │                   │
    └───────────────────┘

Каждая стратегия проходит этот lifecycle.
FAILED — может быть восстановлена (→ STOPPED) или удалена (→ REMOVED).
REMOVED — терминальное состояние.
"""

from __future__ import annotations

import enum
from typing import Dict, List, Set


class StrategyState(str, enum.Enum):
    """Состояние жизненного цикла стратегии/плагина.

    DISCOVERED  — файлы стратегии найдены (Discovery Engine).
    VALIDATED   — manifest.yaml прошёл валидацию (синтаксис, поля,
                  версия API, совместимость).
    INSTALLED   — стратегия зарегистрирована в PluginRegistry,
                  модуль импортирован, зависимости проверены.
    INITIALIZED — Strategy.initialize() вызван, контекст готов.
    RUNNING     — Стратегия активно вычисляет сигналы (analyze()).
    PAUSED      — Вычисления приостановлены, состояние сохранено.
    STOPPED     — Strategy.stop() завершён, может быть перезапущен.
    FAILED      — Аварийное состояние, может быть восстановлен или удалён.
    REMOVED     — Финальное удаление из реестра (terminal).
    """

    DISCOVERED = "discovered"
    VALIDATED = "validated"
    INSTALLED = "installed"
    INITIALIZED = "initialized"
    RUNNING = "running"
    PAUSED = "paused"
    STOPPED = "stopped"
    FAILED = "failed"
    REMOVED = "removed"

    def __repr__(self) -> str:
        return f"StrategyState.{self.name}"

    @property
    def is_active(self) -> bool:
        """Стратегия активна (вычисляет сигналы или может начать)."""
        return self in (StrategyState.RUNNING, StrategyState.PAUSED)

    @property
    def is_running(self) -> bool:
        """Стратегия активно вычисляет сигналы."""
        return self == StrategyState.RUNNING

    @property
    def is_terminal(self) -> bool:
        """Терминальное состояние (стратегия не может быть переиспользована)."""
        return self == StrategyState.REMOVED

    @property
    def is_stopped(self) -> bool:
        """Стратегия остановлена (может быть перезапущена)."""
        return self == StrategyState.STOPPED

    @property
    def needs_reload(self) -> bool:
        """Стратегия должна пройти lifecycle заново для возобновления."""
        return self.is_terminal

    @property
    def is_failed(self) -> bool:
        """Стратегия в аварийном состоянии."""
        return self == StrategyState.FAILED

    @property
    def is_recoverable(self) -> bool:
        """Может быть восстановлена."""
        return self in (StrategyState.STOPPED, StrategyState.FAILED)


# ═══════════════════════════════════════════════════════════════════
# Allowed transitions
# ═══════════════════════════════════════════════════════════════════

_ALLOWED_TRANSITIONS: dict[StrategyState, set[StrategyState]] = {
    # 1. Discovery → Validation
    StrategyState.DISCOVERED: {
        StrategyState.VALIDATED,
        StrategyState.FAILED,
    },
    # 2. Validation → Installation
    StrategyState.VALIDATED: {
        StrategyState.INSTALLED,
        StrategyState.FAILED,
    },
    # 3. Installation → Initialization
    StrategyState.INSTALLED: {
        StrategyState.INITIALIZED,
        StrategyState.FAILED,
        StrategyState.REMOVED,
    },
    # 4. Initialization → Running
    StrategyState.INITIALIZED: {
        StrategyState.RUNNING,
        StrategyState.FAILED,
    },
    # 5. Running ↔ Pause / Stop
    StrategyState.RUNNING: {
        StrategyState.PAUSED,
        StrategyState.STOPPED,
        StrategyState.FAILED,
    },
    # 6. Pause → Running / Stop
    StrategyState.PAUSED: {
        StrategyState.RUNNING,
        StrategyState.STOPPED,
        StrategyState.FAILED,
    },
    # 7. Stopped → Restart / Recovery / Removal
    StrategyState.STOPPED: {
        StrategyState.INSTALLED,    # full restart (reload module)
        StrategyState.INITIALIZED,  # restart without re-install
        StrategyState.FAILED,
        StrategyState.REMOVED,
    },
    # 8. Failed → Recovery / Removal
    StrategyState.FAILED: {
        StrategyState.STOPPED,  # recovery: failed → stopped → retry
        StrategyState.REMOVED,
    },
    # 9. Removed — terminal
    StrategyState.REMOVED: set(),
}


# ═══════════════════════════════════════════════════════════════════
#  StatusTransition — валидатор
# ═══════════════════════════════════════════════════════════════════


class InvalidTransitionError(Exception):
    """Недопустимый переход состояния стратегии.

    Attributes:
        strategy:   Имя стратегии.
        from_state: Текущее состояние.
        to_state:   Запрошенное состояние.
        message:    Описание ошибки.
    """

    def __init__(
        self,
        strategy: str,
        from_state: StrategyState,
        to_state: StrategyState,
        message: str | None = None,
    ):
        self.strategy = strategy
        self.from_state = from_state
        self.to_state = to_state
        msg = message or (
            f"Invalid transition: '{strategy}' "
            f"{from_state.value} → {to_state.value}"
        )
        super().__init__(msg)


class StatusTransition:
    """Валидатор переходов состояний стратегии.

    Гарантирует, что стратегия проходит через состояния
    в правильном порядке согласно разрешённому графу.
    """

    @staticmethod
    def allowed(from_state: StrategyState) -> set[StrategyState]:
        """Какие состояния достижимы из данного."""
        return _ALLOWED_TRANSITIONS.get(from_state, set())

    @staticmethod
    def can_transition(
        from_state: StrategyState,
        to_state: StrategyState,
    ) -> bool:
        """Можно ли перейти из from_state в to_state."""
        allowed_set = _ALLOWED_TRANSITIONS.get(from_state, set())
        return to_state in allowed_set

    @staticmethod
    def validate(
        strategy: str,
        from_state: StrategyState,
        to_state: StrategyState,
    ) -> None:
        """Проверить переход. Выбрасывает InvalidTransitionError если нельзя."""
        if not StatusTransition.can_transition(from_state, to_state):
            raise InvalidTransitionError(
                strategy=strategy,
                from_state=from_state,
                to_state=to_state,
            )

    @staticmethod
    def path(
        from_state: StrategyState,
        to_state: StrategyState,
    ) -> list[StrategyState]:
        """Найти кратчайший путь между состояниями (BFS).

        Полезно для Engine: сколько шагов нужно для перезапуска.

        Returns:
            Список состояний от from_state до to_state включительно,
            или пустой список, если путь невозможен.
        """
        if from_state == to_state:
            return [from_state]

        from collections import deque

        visited: set[StrategyState] = set()
        queue: deque[tuple[StrategyState, list[StrategyState]]] = deque()
        queue.append((from_state, [from_state]))
        visited.add(from_state)

        while queue:
            current, path_so_far = queue.popleft()

            for next_state in _ALLOWED_TRANSITIONS.get(current, set()):
                if next_state == to_state:
                    return path_so_far + [next_state]
                if next_state not in visited:
                    visited.add(next_state)
                    queue.append((next_state, path_so_far + [next_state]))

        return []

    @staticmethod
    def describe() -> str:
        """Человеко-читаемое описание всех разрешённых переходов."""
        lines: list[str] = []
        for from_state, to_states in _ALLOWED_TRANSITIONS.items():
            if to_states:
                targets = ", ".join(
                    s.value for s in sorted(to_states, key=lambda x: x.value)
                )
                lines.append(f"  {from_state.value:15s} → {targets}")
            else:
                lines.append(f"  {from_state.value:15s} → (terminal)")
        return "\n".join(lines)
