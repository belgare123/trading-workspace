"""Built-in performance profiler for the Trading Workspace platform.

Usage:
    from core.profiler import profile, ProfilerRegistry, timing

    # Decorator
    @profile("feature_engine.calculate")
    async def calculate(self, symbol: str) -> FeatureSet: ...

    # Context manager
    with timing("decision_engine.process"):
        await self.process(signals)

    # Get results
    stats = ProfilerRegistry.get_stats("feature_engine.calculate")
    report = ProfilerRegistry.generate_report()
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections import defaultdict
from contextlib import contextmanager, asynccontextmanager
from dataclasses import dataclass, field
from functools import wraps
from typing import Any, Callable, TypeVar

logger = logging.getLogger(__name__)

F = TypeVar("F", bound=Callable[..., Any])


# ═══════════════════════════════════════════════════════════
#  Data Types
# ═══════════════════════════════════════════════════════════


@dataclass
class ProfileEntry:
    """A single timing measurement."""
    name: str
    elapsed_ms: float
    timestamp: float
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class ProfileStats:
    """Aggregated statistics for a profiled operation."""
    name: str
    count: int = 0
    total_ms: float = 0.0
    min_ms: float = float("inf")
    max_ms: float = 0.0
    avg_ms: float = 0.0
    p50_ms: float = 0.0
    p95_ms: float = 0.0
    p99_ms: float = 0.0
    recent_calls: list[ProfileEntry] = field(default_factory=list)
    last_reset: float = field(default_factory=time.time)

    @property
    def calls_per_second(self) -> float:
        elapsed = time.time() - self.last_reset
        return self.count / elapsed if elapsed > 0 else 0.0


# ═══════════════════════════════════════════════════════════
#  Registry
# ═══════════════════════════════════════════════════════════


class ProfilerRegistry:
    """Global registry of profiled operations."""

    _stats: dict[str, ProfileStats] = defaultdict(lambda: ProfileStats(name="unknown"))
    _max_recent: int = 100
    _enabled: bool = True

    @classmethod
    def record(cls, name: str, elapsed_ms: float, metadata: dict | None = None) -> None:
        """Record a timing measurement."""
        if not cls._enabled:
            return

        stats = cls._stats[name]
        stats.name = name
        stats.count += 1
        stats.total_ms += elapsed_ms
        stats.min_ms = min(stats.min_ms, elapsed_ms)
        stats.max_ms = max(stats.max_ms, elapsed_ms)
        stats.avg_ms = stats.total_ms / stats.count

        entry = ProfileEntry(
            name=name,
            elapsed_ms=elapsed_ms,
            timestamp=time.time(),
            metadata=metadata or {},
        )
        stats.recent_calls.append(entry)
        if len(stats.recent_calls) > cls._max_recent:
            stats.recent_calls.pop(0)

    @classmethod
    def get_stats(cls, name: str) -> ProfileStats | None:
        """Get aggregated stats for a named operation."""
        stats = cls._stats.get(name)
        if not stats:
            return None

        # Compute percentiles
        if stats.recent_calls:
            sorted_times = sorted(e.elapsed_ms for e in stats.recent_calls)
            n = len(sorted_times)
            stats.p50_ms = sorted_times[int(n * 0.5)]
            stats.p95_ms = sorted_times[int(n * 0.95)]
            stats.p99_ms = sorted_times[int(n * 0.99)]

        return stats

    @classmethod
    def generate_report(cls, sort_by: str = "total_ms") -> list[dict[str, Any]]:
        """Generate a performance report for all profiled operations."""
        report = []
        for name in cls._stats:
            stats = cls.get_stats(name)
            if stats and stats.count > 0:
                report.append({
                    "name": name,
                    "count": stats.count,
                    "total_ms": round(stats.total_ms, 2),
                    "avg_ms": round(stats.avg_ms, 3),
                    "min_ms": round(stats.min_ms, 3),
                    "max_ms": round(stats.max_ms, 3),
                    "p50_ms": round(stats.p50_ms, 3) if stats.p50_ms != float("inf") else 0,
                    "p95_ms": round(stats.p95_ms, 3) if stats.p95_ms != float("inf") else 0,
                    "p99_ms": round(stats.p99_ms, 3) if stats.p99_ms != float("inf") else 0,
                    "cps": round(stats.calls_per_second, 2),
                })

        report.sort(key=lambda x: x.get(sort_by, 0), reverse=True)
        return report

    @classmethod
    def reset(cls, name: str | None = None) -> None:
        """Reset stats for a specific operation or all."""
        if name:
            cls._stats.pop(name, None)
        else:
            cls._stats.clear()

    @classmethod
    def enable(cls) -> None:
        cls._enabled = True

    @classmethod
    def disable(cls) -> None:
        cls._enabled = False

    @classmethod
    @property
    def enabled(cls) -> bool:
        return cls._enabled


# ═══════════════════════════════════════════════════════════
#  Decorators & Context Managers
# ═══════════════════════════════════════════════════════════


def profile(name: str | None = None) -> Callable[[F], F]:
    """Decorator: profile a function/method's execution time.

    Args:
        name: Metric name. Defaults to ``module.function``.
    """
    def decorator(func: F) -> F:
        metric_name = name or f"{func.__module__}.{func.__qualname__}"

        @wraps(func)
        def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
            if not ProfilerRegistry.enabled:
                return func(*args, **kwargs)
            start = time.perf_counter()
            try:
                return func(*args, **kwargs)
            finally:
                elapsed = (time.perf_counter() - start) * 1000
                ProfilerRegistry.record(metric_name, elapsed)

        @wraps(func)
        async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
            if not ProfilerRegistry.enabled:
                return await func(*args, **kwargs)
            start = time.perf_counter()
            try:
                return await func(*args, **kwargs)
            finally:
                elapsed = (time.perf_counter() - start) * 1000
                ProfilerRegistry.record(metric_name, elapsed)

        if asyncio.iscoroutinefunction(func):
            return async_wrapper  # type: ignore
        return sync_wrapper  # type: ignore

    return decorator


@contextmanager
def timing(name: str, metadata: dict | None = None):
    """Context manager: profile a block of code."""
    if not ProfilerRegistry.enabled:
        yield
        return
    start = time.perf_counter()
    try:
        yield
    finally:
        elapsed = (time.perf_counter() - start) * 1000
        ProfilerRegistry.record(name, elapsed, metadata=metadata)


@asynccontextmanager
async def async_timing(name: str, metadata: dict | None = None):
    """Async context manager: profile an async block."""
    if not ProfilerRegistry.enabled:
        yield
        return
    start = time.perf_counter()
    try:
        yield
    finally:
        elapsed = (time.perf_counter() - start) * 1000
        ProfilerRegistry.record(name, elapsed, metadata=metadata)


# ═══════════════════════════════════════════════════════════
#  Memory Tracking
# ═══════════════════════════════════════════════════════════


@dataclass
class MemorySnapshot:
    """A snapshot of memory usage."""
    timestamp: float
    rss_mb: float
    objects_total: int
    objects_by_type: dict[str, int]


def take_memory_snapshot() -> MemorySnapshot:
    """Take a memory usage snapshot.

    Returns RSS in MB, total Python object count, and top object types.
    """
    import gc
    import os

    # RSS memory
    try:
        import psutil
        process = psutil.Process(os.getpid())
        rss_mb = process.memory_info().rss / (1024 * 1024)
    except ImportError:
        # Fallback: /proc/self/status
        try:
            with open("/proc/self/status") as f:
                for line in f:
                    if line.startswith("VmRSS:"):
                        rss_mb = int(line.split()[1]) / 1024
                        break
                else:
                    rss_mb = 0.0
        except (FileNotFoundError, OSError):
            rss_mb = 0.0

    # Python object count
    gc.collect()
    objects = gc.get_objects()
    objects_total = len(objects)

    # Top types
    type_counts: dict[str, int] = defaultdict(int)
    for obj in objects:
        type_counts[type(obj).__name__] += 1

    top_types = dict(sorted(type_counts.items(), key=lambda x: -x[1])[:30])

    return MemorySnapshot(
        timestamp=time.time(),
        rss_mb=round(rss_mb, 1),
        objects_total=objects_total,
        objects_by_type=top_types,
    )


# ═══════════════════════════════════════════════════════════
#  CLI Output
# ═══════════════════════════════════════════════════════════


def format_report(report: list[dict[str, Any]] | None = None) -> str:
    """Format profiler report as a table string."""
    if report is None:
        report = ProfilerRegistry.generate_report()

    if not report:
        return "No profiling data collected."

    lines = [
        f"{'Operation':<40} {'Count':>7} {'Total(ms)':>10} {'Avg(ms)':>9} {'Min(ms)':>9} {'Max(ms)':>9} {'p95(ms)':>9} {'CPS':>8}",
        "-" * 101,
    ]
    for entry in report[:30]:  # Top 30
        lines.append(
            f"{entry['name']:<40} "
            f"{entry['count']:>7} "
            f"{entry['total_ms']:>10.1f} "
            f"{entry['avg_ms']:>9.3f} "
            f"{entry['min_ms']:>9.3f} "
            f"{entry['max_ms']:>9.3f} "
            f"{entry['p95_ms']:>9.3f} "
            f"{entry['cps']:>8.2f}"
        )

    return "\n".join(lines)


def format_memory(snapshot: MemorySnapshot) -> str:
    """Format memory snapshot as readable string."""
    lines = [
        f"Memory Snapshot @ {time.strftime('%H:%M:%S', time.localtime(snapshot.timestamp))}",
        f"  RSS:      {snapshot.rss_mb:.1f} MB",
        f"  Objects:  {snapshot.objects_total:,}",
        "",
        "Top Object Types:",
    ]
    for i, (type_name, count) in enumerate(
        sorted(snapshot.objects_by_type.items(), key=lambda x: -x[1])[:15],
        1
    ):
        lines.append(f"  {i:2d}. {type_name:<30s} {count:>8,}")

    return "\n".join(lines)
