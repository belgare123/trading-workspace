"""
Market Replay Framework — Orchestrator Engine (Phase 9).

Объединяет все модули replay в единый цикл исполнения.

Использование:
    engine = ReplayEngine()
    engine.load_package(pkg)
    engine.run(speed=2.0)  # весь пакет
    # или пошагово:
    engine.start(speed=1.0)
    for _ in range(10):
        engine.tick()
    engine.stop()
"""

from __future__ import annotations

import logging
import time
from typing import Any, Callable

from core.replay.bus import (
    REPLAY_BREAKPOINT,
    REPLAY_COMPLETED,
    REPLAY_ERROR,
    REPLAY_PAUSED,
    REPLAY_PROGRESS,
    REPLAY_RESUMED,
    REPLAY_SEEK,
    REPLAY_SNAPSHOT,
    REPLAY_STARTED,
    REPLAY_STOPPED,
    ReplayBus,
)
from core.event_store import EventStoreReader
from core.profiler import profile
from core.replay.controller import ReplayController
from core.replay.debugger import ReplayDebugger
from core.replay.deterministic import DeterministicExecutor
from core.replay.models import (
    ReplayContext,
    ReplayEvent,
    ReplayManifest,
    ReplayPackage,
    ReplaySnapshot,
    SeekTarget,
)
from core.replay.snapshot import SnapshotEngine
from core.replay.speed import SpeedController
from core.replay.source import ReplaySource
from core.replay.timeline import Timeline
from core.replay.validation import ValidationEngine

logger = logging.getLogger(__name__)


class ReplayEngine:
    """Оркестратор Market Replay Framework.

    Интегрирует:
      - Timeline (9.2) — шкала событий
      - Source (9.1) — источник данных
      - SpeedController (9.4) — скорость
      - Controller (9.5+9.6) — pause/resume/seek
      - DeterministicExecutor (9.7) — детерминизм
      - SnapshotEngine — снимки
      - Debugger — отладка
      - ValidationEngine (9.10) — валидация
      - ReplayBus — шина событий
    """

    def __init__(self) -> None:
        self.bus = ReplayBus()
        self.timeline = Timeline()
        self.speed = SpeedController(1.0)
        self.controller = ReplayController()
        self.deterministic = DeterministicExecutor()
        self.snapshots = SnapshotEngine()
        self.debugger = ReplayDebugger()
        self.validation = ValidationEngine()

        self._context: ReplayContext | None = None
        self._callbacks: dict[str, list[Callable]] = {}
        self._event_handlers: dict[str, Callable[[ReplayEvent], None]] = {}
        self._is_running = False
        self._tick_count = 0

    # ── Загрузка ────────────────────────────────────────────────

    def load(self, events: list[ReplayEvent]) -> None:
        """Загрузить события напрямую."""
        self.timeline.load(events)
        self._context = None
        logger.info("ReplayEngine loaded %d events", len(events))

    def load_package(self, package: ReplayPackage) -> None:
        """Загрузить .market-пакет."""
        self.timeline.load(package.events)
        self._context = ReplayContext(package=package)
        logger.info(
            "ReplayEngine loaded package '%s': %d events, %.1fs",
            package.manifest.name, len(package.events), package.duration,
        )

    async def load_from_reader(
        self,
        reader: EventStoreReader,
        stream: str = "market",
        since: float | None = None,
        until: float | None = None,
        limit: int = 10000,
    ) -> int:
        """Загрузить события из EventStoreReader.

        Args:
            reader: Экземпляр EventStoreReader.
            stream: Тип агрегата (``"market"``).
            since:  Загружать события после timestamp.
            until:  Загружать события до timestamp.
            limit:  Максимум событий.

        Returns:
            Количество загруженных событий.
        """
        cnt = await self.timeline.load_from_reader(
            reader=reader,
            stream=stream,
            since=since,
            until=until,
            limit=limit,
        )
        self._context = None
        logger.info("ReplayEngine loaded %d events from EventStore", cnt)
        return cnt

    # ── Callback API ─────────────────────────────────────────────

    def on_event(self, stream: str, callback: Callable[[ReplayEvent], None]) -> None:
        """Подписаться на события потока."""
        self._event_handlers[f"event:{stream}"] = callback
        self.timeline.subscribe(stream, self._wrap_event_handler(callback))

    def on(self, event_name: str, callback: Callable) -> None:
        """Подписаться на событие ReplayBus."""
        self.bus.subscribe(event_name, callback)  # type: ignore

    def _wrap_event_handler(self, callback: Callable[[ReplayEvent], None]) -> Callable[[ReplayEvent], None]:
        def wrapper(event: ReplayEvent) -> None:
            try:
                callback(event)
            except Exception as e:
                logger.error("Event handler error: %s", e)
                self.bus.emit(REPLAY_ERROR, {"error": str(e), "event": event.to_dict()})
        return wrapper

    # ── Управление ───────────────────────────────────────────────

    def start(self, speed: float = 1.0) -> None:
        """Запустить replay."""
        self.speed.set(speed)
        self.timeline.reset()
        self._is_running = True
        self._tick_count = 0
        self.deterministic.reset()
        self._context = self._ensure_context()
        self.bus.emit(REPLAY_STARTED, {"speed": speed})
        logger.info("ReplayEngine started (speed=%gx)", speed)

    def stop(self) -> None:
        """Остановить replay."""
        self._is_running = False
        self.bus.emit(REPLAY_STOPPED, {
            "ticks": self._tick_count,
            "events_processed": self.timeline.state.current_index,
        })
        logger.info("ReplayEngine stopped after %d ticks", self._tick_count)

    def pause(self) -> None:
        """Приостановить replay."""
        self.controller.pause()
        self.bus.emit(REPLAY_PAUSED, {
            "timestamp": self.timeline.state.current_timestamp,
            "index": self.timeline.state.current_index,
        })

    def resume(self) -> None:
        """Возобновить replay."""
        self.controller.resume()
        self.bus.emit(REPLAY_RESUMED, {
            "timestamp": self.timeline.state.current_timestamp,
            "index": self.timeline.state.current_index,
        })

    def toggle_pause(self) -> bool:
        """Переключить паузу. Вернуть True если на паузе."""
        paused = self.controller.toggle()
        if paused:
            self.bus.emit(REPLAY_PAUSED, {})
        else:
            self.bus.emit(REPLAY_RESUMED, {})
        return paused

    def seek(self, timestamp: float) -> None:
        """Переместиться к timestamp."""
        idx = self.timeline.seek(timestamp)
        self._tick_count = 0
        self.bus.emit(REPLAY_SEEK, {"timestamp": timestamp, "index": idx})
        logger.info("ReplayEngine seek to %.3f (event %d)", timestamp, idx)

    def set_speed(self, speed: float) -> None:
        """Установить скорость."""
        self.speed.set(speed)
        self.timeline.state.speed = speed
        logger.info("ReplayEngine speed set to %gx", speed)

    # ── Исполнение ───────────────────────────────────────────────

    @profile("replay_engine.tick")
    def tick(self) -> list[ReplayEvent]:
        """Выполнить один тик replay.

        Returns:
            События, обработанные на этом тике.
        """
        if not self._is_running:
            return []

        context = self._ensure_context()

        # Seek если установлен
        seek_target = self.controller.consume_seek()
        if seek_target:
            self.timeline.seek(seek_target.timestamp)

        # Проверка паузы
        if self.controller.is_paused:
            return []

        # Tick timeline
        events = self.timeline.tick(speed=self.speed.speed)
        if not events:
            self._check_completed()
            return []

        self._tick_count += 1

        # Уведомления через шину
        for event in events:
            self.bus.emit_event(event)

        # Обновить детерминированный хеш
        self.deterministic.record_step(
            events_hash=self.deterministic.hash_events(events),
            state_snapshot={"index": self.timeline.state.current_index},
        )

        # Авто-снимки
        if self.snapshots.count > 0 and self._tick_count % self.snapshots.count == 0:
            self._take_snapshot()

        # Breakpoints для debugger
        if self.debugger.should_break(context.current_timestamp, context.current_index):
            self.controller.pause()
            self.bus.emit(REPLAY_BREAKPOINT, {"timestamp": context.current_timestamp})

        # Прогресс
        if self._tick_count % 100 == 0:
            self.bus.emit_progress(context)

        return events

    def run(self, speed: float = 1.0, tick_limit: int = 0) -> int:
        """Запустить replay до конца (или до лимита тиков).

        Args:
            speed: Множитель скорости.
            tick_limit: Максимум тиков (0 = без лимита).

        Returns:
            Количество обработанных событий.
        """
        self.start(speed=speed)
        total = 0
        while True:
            events = self.tick()
            if not events:
                break
            total += len(events)
            if tick_limit > 0 and self._tick_count >= tick_limit:
                self.stop()
                break
        if not self.controller.is_paused:
            self.stop()
        return total

    def run_step(self) -> ReplayEvent | None:
        """Выполнить ровно один шаг (одно событие). Для отладки."""
        if not self._is_running:
            return None
        event = self.timeline.tick_one()
        if event:
            self._tick_count += 1
            self.bus.emit_event(event)
        else:
            self._check_completed()
        return event

    # ── Внутренние методы ────────────────────────────────────────

    def _ensure_context(self) -> ReplayContext:
        if self._context is None:
            self._context = ReplayContext(
                package=ReplayPackage(
                    manifest=ReplayManifest(),
                    events=self.timeline.events,
                ),
            )
        self._context.current_index = self.timeline.state.current_index
        self._context.current_timestamp = self.timeline.state.current_timestamp
        self._context.current_speed = self.speed.speed
        self._context.is_paused = self.controller.is_paused
        self._context.is_finished = self.timeline.state.is_finished
        return self._context

    def _check_completed(self) -> None:
        if self.timeline.state.is_finished:
            self._is_running = False
            self.bus.emit(REPLAY_COMPLETED, {
                "ticks": self._tick_count,
                "total_events": len(self.timeline.events),
                "final_hash": self.deterministic.final_hash,
            })
            logger.info("ReplayEngine completed: %d events", len(self.timeline.events))

    def _take_snapshot(self) -> ReplaySnapshot:
        context = self._ensure_context()
        snapshot = self.snapshots.take(
            timestamp=context.current_timestamp,
            label=f"tick_{self._tick_count}",
        )
        self.bus.emit_snapshot(snapshot)
        return snapshot

    # ── Свойства ─────────────────────────────────────────────────

    @property
    def is_running(self) -> bool:
        return self._is_running

    @property
    def is_paused(self) -> bool:
        return self.controller.is_paused

    @property
    def events_processed(self) -> int:
        return self.timeline.state.current_index

    @property
    def progress(self) -> float:
        return self.timeline.state.progress

    def to_dict(self) -> dict[str, Any]:
        return {
            "is_running": self._is_running,
            "is_paused": self.controller.is_paused,
            "speed": self.speed.speed,
            "events_processed": self.events_processed,
            "total_events": len(self.timeline.events),
            "progress_pct": round(self.progress * 100, 1),
            "tick_count": self._tick_count,
            "snapshots": self.snapshots.count,
            "deterministic_hash": self.deterministic.final_hash,
        }
