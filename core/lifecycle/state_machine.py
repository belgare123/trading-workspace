"""
8.1 Opportunity State Machine — управление состояниями торговой идеи.

Validated transitions:

CREATED → VALIDATED (проверена политикой)
VALIDATED → WAITING_ENTRY (цена ещё не в entry)
WAITING_ENTRY → ACTIVE (цена достигла entry)
ACTIVE → PARTIAL_TARGET (достигнут частичный тейк)
ACTIVE → STOPPED (сработал стоп)
PARTIAL_TARGET → FULL_TARGET (все тейки)
PARTIAL_TARGET → STOPPED (стоп после частичного)
FULL_TARGET → ARCHIVED
STOPPED → ARCHIVED
CANCELLED → ARCHIVED
EXPIRED → ARCHIVED
любое → CANCELLED (ручная отмена)
любое → EXPIRED (TTL истёк)

Usage:
    sm = StateMachine()
    sm.can_transition(OpportunityState.CREATED, OpportunityState.VALIDATED)  # True
    sm.can_transition(OpportunityState.CREATED, OpportunityState.ACTIVE)     # False
"""

from __future__ import annotations

import logging
from typing import Any

from core.lifecycle.models import OpportunityState

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════
#  Transition Graph
# ═══════════════════════════════════════════════════════════════════


# Словарь допустимых переходов: from_state → set(to_state)
_TRANSITIONS: dict[OpportunityState, set[OpportunityState]] = {
    OpportunityState.CREATED: {
        OpportunityState.VALIDATED,
        OpportunityState.CANCELLED,
        OpportunityState.EXPIRED,
    },
    OpportunityState.VALIDATED: {
        OpportunityState.WAITING_ENTRY,
        OpportunityState.ACTIVE,           # цена уже в entry
        OpportunityState.CANCELLED,
        OpportunityState.EXPIRED,
    },
    OpportunityState.WAITING_ENTRY: {
        OpportunityState.ACTIVE,           # цена достигла entry
        OpportunityState.CANCELLED,
        OpportunityState.EXPIRED,
    },
    OpportunityState.ACTIVE: {
        OpportunityState.PARTIAL_TARGET,
        OpportunityState.FULL_TARGET,      # один тикет → full
        OpportunityState.STOPPED,
        OpportunityState.CANCELLED,
        OpportunityState.EXPIRED,
    },
    OpportunityState.PARTIAL_TARGET: {
        OpportunityState.FULL_TARGET,
        OpportunityState.STOPPED,
        OpportunityState.CANCELLED,
        OpportunityState.EXPIRED,
    },
    OpportunityState.FULL_TARGET: {
        OpportunityState.ARCHIVED,
        OpportunityState.CANCELLED,
    },
    OpportunityState.STOPPED: {
        OpportunityState.ARCHIVED,
        OpportunityState.CANCELLED,
    },
    OpportunityState.CANCELLED: {
        OpportunityState.ARCHIVED,
    },
    OpportunityState.EXPIRED: {
        OpportunityState.ARCHIVED,
    },
    OpportunityState.ARCHIVED: set(),  # terminal
}

# Обратный индекс: какие переходы разрешены в to_state
_INVERSE_TRANSITIONS: dict[OpportunityState, set[OpportunityState]] = {}
for from_state, to_set in _TRANSITIONS.items():
    for to_state in to_set:
        if to_state not in _INVERSE_TRANSITIONS:
            _INVERSE_TRANSITIONS[to_state] = set()
        _INVERSE_TRANSITIONS[to_state].add(from_state)


class TransitionError(Exception):
    """Недопустимый переход состояния."""
    def __init__(self, from_state: OpportunityState, to_state: OpportunityState, reason: str = ""):
        self.from_state = from_state
        self.to_state = to_state
        msg = f"Cannot transition from {from_state.value!r} to {to_state.value!r}"
        if reason:
            msg += f": {reason}"
        super().__init__(msg)


# ═══════════════════════════════════════════════════════════════════
#  StateMachine
# ═══════════════════════════════════════════════════════════════════


class StateMachine:
    """State Machine для жизненного цикла Opportunity.

    Thread-safe. Использует предопределённый граф переходов.
    """

    def can_transition(
        self,
        from_state: OpportunityState,
        to_state: OpportunityState,
    ) -> bool:
        """Проверить, разрешён ли переход.

        Args:
            from_state: Текущее состояние.
            to_state:   Целевое состояние.

        Returns:
            True если переход разрешён.
        """
        allowed = _TRANSITIONS.get(from_state, set())
        return to_state in allowed

    def validate(
        self,
        from_state: OpportunityState,
        to_state: OpportunityState,
    ) -> None:
        """Проверить переход, выбросить TransitionError если запрещён.

        Args:
            from_state: Текущее состояние.
            to_state:   Целевое состояние.

        Raises:
            TransitionError: Если переход не разрешён.
        """
        if not self.can_transition(from_state, to_state):
            raise TransitionError(
                from_state, to_state,
                f"Allowed transitions from {from_state.value!r}: "
                f"{[s.value for s in _TRANSITIONS.get(from_state, set())]}",
            )

    def allowed_transitions(
        self,
        state: OpportunityState,
    ) -> list[OpportunityState]:
        """Получить список разрешённых переходов из текущего состояния.

        Args:
            state: Текущее состояние.

        Returns:
            Список возможных состояний.
        """
        return list(_TRANSITIONS.get(state, set()))

    def can_enter(self, state: OpportunityState) -> list[OpportunityState]:
        """Получить состояния, из которых можно войти в данное.

        Args:
            state: Целевое состояние.

        Returns:
            Список состояний-предшественников.
        """
        return list(_INVERSE_TRANSITIONS.get(state, set()))
