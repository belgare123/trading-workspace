"""
Decision Policy (7.7) — слой фильтрации возможностей перед публикацией.

Политики:
  - strict:    минимум 2 стратегии, confidence ≥ 0.7
  - moderate:  хотя бы 1 стратегия, confidence ≥ 0.5
  - aggressive: достаточно confidence ≥ 0.3
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

from core.decision.models import (
    ConsensusResult,
    Opportunity,
    OpportunityStatus,
    SignalDirection,
)

logger = logging.getLogger(__name__)


class PolicyName(Enum):
    """Доступные политики принятия решений."""

    STRICT = "strict"
    MODERATE = "moderate"
    AGGRESSIVE = "aggressive"


# ═══════════════════════════════════════════════════════════════════
#  Policy Config
# ═══════════════════════════════════════════════════════════════════


@dataclass
class PolicyConfig:
    """Конфигурация одной политики."""

    min_strategies: int = 1
    min_confidence: float = 0.5
    min_agreement: float = 0.0
    reject_on_conflict: bool = True
    allow_neutral: bool = False


# Предопределённые политики
POLICY_REGISTRY: dict[PolicyName, PolicyConfig] = {
    PolicyName.STRICT: PolicyConfig(
        min_strategies=2,
        min_confidence=0.7,
        min_agreement=0.6,
        reject_on_conflict=True,
        allow_neutral=False,
    ),
    PolicyName.MODERATE: PolicyConfig(
        min_strategies=1,
        min_confidence=0.5,
        min_agreement=0.0,
        reject_on_conflict=True,
        allow_neutral=False,
    ),
    PolicyName.AGGRESSIVE: PolicyConfig(
        min_strategies=1,
        min_confidence=0.3,
        min_agreement=0.0,
        reject_on_conflict=False,
        allow_neutral=True,
    ),
}


# ═══════════════════════════════════════════════════════════════════
#  DecisionPolicy
# ═══════════════════════════════════════════════════════════════════


class DecisionPolicy:
    """Применение политики к Opportunity.

    Usage:
        policy = DecisionPolicy("strict")
        result = policy.evaluate(opportunity, consensus)

        if result.accepted:
            # публикуем opportunity
        else:
            # opportunity rejected
            print(result.reason)
    """

    def __init__(self, policy_name: str = "moderate") -> None:
        policy_map = {p.value: p for p in PolicyName}

        self._policy_name = policy_name.lower()
        if self._policy_name not in policy_map:
            valid = [p.value for p in PolicyName]
            raise ValueError(
                f"Unknown policy '{policy_name}'. Valid: {valid}"
            )

        self._config = POLICY_REGISTRY[policy_map[self._policy_name]]

    @property
    def name(self) -> str:
        return self._policy_name

    @property
    def config(self) -> PolicyConfig:
        return self._config

    def evaluate(
        self,
        opportunity: Opportunity,
        consensus: ConsensusResult | None = None,
    ) -> "PolicyResult":
        """Оценить opportunity на соответствие политике.

        Args:
            opportunity: Проверяемая возможность.
            consensus:   Результат консенсуса (если есть).

        Returns:
            PolicyResult.
        """
        consensus = consensus or opportunity.consensus
        reasons: list[str] = []

        # 1. Проверка на конфликт
        if consensus and consensus.is_conflict and self._config.reject_on_conflict:
            reasons.append(f"Conflict rejected by policy '{self._policy_name}'")

        # 2. Минимальное количество стратегий
        n_strategies = len(opportunity.strategies)
        if n_strategies < self._config.min_strategies:
            reasons.append(
                f"Not enough strategies: {n_strategies} < "
                f"{self._config.min_strategies}"
            )

        # 3. Минимальный confidence
        if opportunity.confidence < self._config.min_confidence:
            reasons.append(
                f"Confidence too low: {opportunity.confidence:.2f} < "
                f"{self._config.min_confidence}"
            )

        # 4. Минимальный agreement
        if consensus and self._config.min_agreement > 0:
            if consensus.agreement < self._config.min_agreement:
                reasons.append(
                    f"Agreement too low: {consensus.agreement:.2f} < "
                    f"{self._config.min_agreement}"
                )

        # 5. NEUTRAL
        if (
            opportunity.direction == SignalDirection.NEUTRAL
            and not self._config.allow_neutral
        ):
            reasons.append("Neutral direction not allowed by policy")

        if reasons:
            return PolicyResult(
                accepted=False,
                reason="; ".join(reasons),
                policy=self._policy_name,
            )

        return PolicyResult(
            accepted=True,
            reason="Passed all policy checks",
            policy=self._policy_name,
        )

    def __repr__(self) -> str:
        return f"DecisionPolicy('{self._policy_name}')"


# ═══════════════════════════════════════════════════════════════════
#  PolicyResult
# ═══════════════════════════════════════════════════════════════════


@dataclass
class PolicyResult:
    """Результат проверки политики."""

    accepted: bool
    reason: str = ""
    policy: str = ""

    def __bool__(self) -> bool:
        return self.accepted
