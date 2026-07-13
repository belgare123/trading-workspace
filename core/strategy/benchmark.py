"""
Strategy Benchmark — метрики выполнения стратегии.

Расширяет StrategyMetrics:
  - Скользящее окно последних N вызовов analyze()
  - Частота вызовов calls/sec и signals/hour
  - Таймауты и исключения
  - Benchmark-отчёт для Dashboard
"""

from __future__ import annotations

import logging
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)

# Максимальное количество записей в скользящем окне
_DEFAULT_WINDOW_SIZE = 100

# Порог таймаута по умолчанию (ms) — если analyze() дольше — считается таймаутом
_DEFAULT_TIMEOUT_THRESHOLD_MS = 10_000.0


@dataclass
class RunSnapshot:
    """Снимок одного вызова analyze().

    Attributes:
        timestamp:    Unix timestamp начала вызова.
        elapsed_ms:   Время выполнения в миллисекундах.
        signal_count: Количество сигналов (0 если ошибка).
        error:        Текст ошибки (None если успех).
        is_timeout:   True если превышен порог таймаута.
        is_actionable: True если были actionable сигналы.
    """

    timestamp: float
    elapsed_ms: float
    signal_count: int = 0
    error: str | None = None
    is_timeout: bool = False
    is_actionable: bool = False

    def to_dict(self) -> dict[str, object]:
        return {
            "timestamp": self.timestamp,
            "elapsed_ms": round(self.elapsed_ms, 2),
            "signal_count": self.signal_count,
            "error": self.error,
            "is_timeout": self.is_timeout,
            "is_actionable": self.is_actionable,
        }


@dataclass
class StrategyBenchmark:
    """Метрики выполнения стратегии для Dashboard.

    Используется как расширение поверх StrategyMetrics:
    - Хранит скользящее окно последних вызовов analyze()
    - Считает частоту вызовов, сигналов и ошибок
    - Вычисляет перцентили задержки

    Attributes:
        name:                  Имя стратегии.
        window_size:           Размер скользящего окна.
        timeout_threshold_ms:  Порог таймаута (ms).

        # ── Счётчики ──
        total_calls:           Всего вызовов analyze().
        total_signals:         Всего сигналов.
        total_errors:          Всего ошибок.
        total_timeouts:        Всего таймаутов.
        timeout_count:         Количество таймаутов за окно.

        # ── Окно ──
        recent_runs:           Скользящее окно RunSnapshot.
        window_start:          Timestamp начала окна.
    """

    name: str
    window_size: int = _DEFAULT_WINDOW_SIZE
    timeout_threshold_ms: float = _DEFAULT_TIMEOUT_THRESHOLD_MS

    # ── Totals ──
    total_calls: int = 0
    total_signals: int = 0
    total_errors: int = 0
    total_timeouts: int = 0
    timeout_count: int = 0

    # ── Sliding window ──
    recent_runs: deque[RunSnapshot] = field(default_factory=lambda: deque(maxlen=_DEFAULT_WINDOW_SIZE))
    window_start: float = 0.0

    def __post_init__(self) -> None:
        if self.window_start == 0.0:
            self.window_start = time.time()

    # ── Recording ──

    def record_run(
        self,
        elapsed_ms: float,
        signal_count: int = 0,
        error: str | None = None,
        is_actionable: bool = False,
    ) -> RunSnapshot:
        """Записать один вызов analyze().

        Args:
            elapsed_ms:    Время выполнения (ms).
            signal_count:  Количество сигналов (0 если ошибка).
            error:         Текст ошибки (None если успех).
            is_actionable: Были ли actionable сигналы.

        Returns:
            RunSnapshot записанного вызова.
        """
        is_timeout = elapsed_ms > self.timeout_threshold_ms
        snapshot = RunSnapshot(
            timestamp=time.time(),
            elapsed_ms=elapsed_ms,
            signal_count=signal_count,
            error=error,
            is_timeout=is_timeout,
            is_actionable=is_actionable,
        )

        self.total_calls += 1
        self.recent_runs.append(snapshot)

        if error:
            self.total_errors += 1
        else:
            self.total_signals += signal_count

        if is_timeout:
            self.total_timeouts += 1

        return snapshot

    def record_timeout(self, elapsed_ms: float) -> None:
        """Записать таймаут (analyze() превысил лимит)."""
        self.record_run(elapsed_ms=elapsed_ms, error="Timeout")

    def record_exception(self, elapsed_ms: float, exc: Exception) -> None:
        """Записать исключение."""
        self.record_run(elapsed_ms=elapsed_ms, error=f"{type(exc).__name__}: {exc}")

    # ── Properties ──

    @property
    def window_minutes(self) -> float:
        """Время окна в минутах."""
        if not self.recent_runs:
            return 0.0
        return max((time.time() - self.recent_runs[0].timestamp) / 60.0, 0.1)

    @property
    def calls_per_minute(self) -> float:
        """Вызовов analyze() в минуту (за окно)."""
        if self.window_minutes == 0 or len(self.recent_runs) < 2:
            return 0.0
        return round(len(self.recent_runs) / self.window_minutes, 1)

    @property
    def signals_per_hour(self) -> float:
        """Сигналов в час (за окно)."""
        if self.window_minutes == 0:
            return 0.0
        window_signals = sum(r.signal_count for r in self.recent_runs)
        hours = self.window_minutes / 60.0
        if hours == 0:
            return 0.0
        return round(window_signals / hours, 1)

    @property
    def avg_latency_ms(self) -> float:
        """Средняя задержка analyze() за окно."""
        if not self.recent_runs:
            return 0.0
        return round(
            sum(r.elapsed_ms for r in self.recent_runs) / len(self.recent_runs), 2
        )

    @property
    def max_latency_ms(self) -> float:
        """Максимальная задержка за окно."""
        if not self.recent_runs:
            return 0.0
        return max(r.elapsed_ms for r in self.recent_runs)

    @property
    def p99_latency_ms(self) -> float:
        """P99 задержки за окно."""
        if not self.recent_runs:
            return 0.0
        sorted_ms = sorted(r.elapsed_ms for r in self.recent_runs)
        idx = int(len(sorted_ms) * 0.99)
        return round(sorted_ms[min(idx, len(sorted_ms) - 1)], 2)

    @property
    def p95_latency_ms(self) -> float:
        """P95 задержки за окно."""
        if not self.recent_runs:
            return 0.0
        sorted_ms = sorted(r.elapsed_ms for r in self.recent_runs)
        idx = int(len(sorted_ms) * 0.95)
        return round(sorted_ms[min(idx, len(sorted_ms) - 1)], 2)

    @property
    def error_rate(self) -> float:
        """Доля ошибок за окно (0.0–1.0)."""
        if not self.recent_runs:
            return 0.0
        window_errors = sum(1 for r in self.recent_runs if r.error)
        return round(window_errors / len(self.recent_runs), 4)

    @property
    def timeout_rate(self) -> float:
        """Доля таймаутов за окно (0.0–1.0)."""
        if not self.recent_runs:
            return 0.0
        window_timeouts = sum(1 for r in self.recent_runs if r.is_timeout)
        return round(window_timeouts / len(self.recent_runs), 4)

    @property
    def success_rate(self) -> float:
        """Доля успешных вызовов (без ошибок) за окно."""
        return round(1.0 - self.error_rate, 4)

    @property
    def is_healthy(self) -> bool:
        """Стратегия считается healthy если:
        - error_rate < 10%
        - timeout_rate < 5%
        - calls_per_minute > 0 (есть активность)
        """
        if self.total_calls == 0:
            return True  # новая стратегия
        if self.error_rate >= 0.10:
            return False
        if self.timeout_rate >= 0.05:
            return False
        return True

    # ── Report ──

    def to_dict(self) -> dict[str, Any]:
        """Полный benchmark-отчёт для Dashboard."""
        return {
            "name": self.name,
            "is_healthy": self.is_healthy,
            "total": {
                "calls": self.total_calls,
                "signals": self.total_signals,
                "errors": self.total_errors,
                "timeouts": self.total_timeouts,
            },
            "window": {
                "samples": len(self.recent_runs),
                "minutes": round(self.window_minutes, 1),
            },
            "rates": {
                "calls_per_minute": self.calls_per_minute,
                "signals_per_hour": self.signals_per_hour,
            },
            "latency_ms": {
                "avg": self.avg_latency_ms,
                "max": self.max_latency_ms,
                "p95": self.p95_latency_ms,
                "p99": self.p99_latency_ms,
            },
            "errors": {
                "rate": self.error_rate,
                "count_window": sum(1 for r in self.recent_runs if r.error),
            },
            "timeouts": {
                "rate": self.timeout_rate,
                "count_window": sum(1 for r in self.recent_runs if r.is_timeout),
            },
        }

    def summary(self) -> str:
        """Краткий human-readable отчёт."""
        health = "✓ HEALTHY" if self.is_healthy else "✗ UNHEALTHY"
        lines = [
            f"[Benchmark] {self.name} {health}",
            f"  Calls:      {self.total_calls} total, "
            f"{self.calls_per_minute}/min",
            f"  Signals:    {self.total_signals} total, "
            f"{self.signals_per_hour}/hour",
            f"  Errors:     {self.total_errors} ({self.error_rate*100:.1f}%)",
            f"  Timeouts:   {self.total_timeouts} ({self.timeout_rate*100:.1f}%)",
            f"  Latency:    avg={self.avg_latency_ms}ms, "
            f"p95={self.p95_latency_ms}ms, "
            f"p99={self.p99_latency_ms}ms",
            f"  Window:     {len(self.recent_runs)} samples "
            f"over {self.window_minutes:.0f}min",
        ]
        return "\n".join(lines)

    def __repr__(self) -> str:
        return (
            f"StrategyBenchmark({self.name}, "
            f"{self.total_calls} calls, "
            f"{self.error_rate*100:.1f}% err, "
            f"{'healthy' if self.is_healthy else 'unhealthy'})"
        )
