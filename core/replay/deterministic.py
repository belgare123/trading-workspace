"""
9.7 Deterministic Replay — детерминированное воспроизведение.

Один и тот же .market-файл всегда даёт одинаковый результат.
Критично для тестирования стратегий.
"""

from __future__ import annotations

import hashlib
import logging
import time
from dataclasses import dataclass, field
from typing import Any

from core.replay.models import ReplayEvent

logger = logging.getLogger(__name__)


@dataclass
class DeterministicHash:
    """Хеш состояния replay-сессии."""
    algorithm: str = "sha256"
    events_hash: str = ""
    state_hash: str = ""
    result_hash: str = ""
    timestamps: list[float] = field(default_factory=list)

    @property
    def combined(self) -> str:
        raw = f"{self.events_hash}:{self.state_hash}:{self.result_hash}"
        return hashlib.sha256(raw.encode()).hexdigest()[:16]

    def to_dict(self) -> dict[str, Any]:
        return {
            "algorithm": self.algorithm,
            "events_hash": self.events_hash,
            "state_hash": self.state_hash,
            "result_hash": self.result_hash,
            "combined": self.combined,
        }


class DeterministicExecutor:
    """Детерминированное исполнение replay.

    Гарантирует:
      - Воспроизводимость сигналов
      - Воспроизводимость решений
      - Воспроизводимость жизненного цикла
      - Воспроизводимость метрик
    """

    def __init__(self, seed: int = 42) -> None:
        self._seed = seed
        self._hashes: list[DeterministicHash] = []
        self._state: dict[str, Any] = {}

    def hash_events(self, events: list[ReplayEvent]) -> str:
        """Вычислить хеш списка событий."""
        raw = "|".join(
            f"{e.timestamp}:{e.stream}:{e.symbol}:{hashlib.md5(str(e.data).encode()).hexdigest()[:8]}"
            for e in events
        )
        return hashlib.sha256(raw.encode()).hexdigest()[:16]

    def record_step(
        self,
        events_hash: str,
        state_snapshot: dict[str, Any],
    ) -> DeterministicHash:
        """Записать шаг детерминированного исполнения."""
        dhash = DeterministicHash(
            events_hash=events_hash,
            state_hash=self._hash_state(state_snapshot),
        )
        self._hashes.append(dhash)
        return dhash

    def verify(self, other: "DeterministicExecutor") -> bool:
        """Проверить, что два исполнения идентичны."""
        if len(self._hashes) != len(other._hashes):
            logger.warning(
                "Deterministic mismatch: step count %d vs %d",
                len(self._hashes), len(other._hashes),
            )
            return False
        for i, (a, b) in enumerate(zip(self._hashes, other._hashes)):
            if a.combined != b.combined:
                logger.warning(
                    "Deterministic mismatch at step %d: %s vs %s",
                    i, a.combined, b.combined,
                )
                return False
        logger.info("Deterministic verification PASSED (%d steps)", len(self._hashes))
        return True

    def _hash_state(self, state: dict[str, Any]) -> str:
        raw = str(sorted(state.items()))
        return hashlib.sha256(raw.encode()).hexdigest()[:16]

    def reset(self) -> None:
        self._hashes.clear()
        self._state.clear()

    @property
    def total_steps(self) -> int:
        return len(self._hashes)

    @property
    def final_hash(self) -> str:
        if not self._hashes:
            return ""
        return self._hashes[-1].combined
