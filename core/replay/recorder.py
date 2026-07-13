"""
9.8 Replay Recorder — запись live-данных в .market-пакет.

Live → Recorder → Replay Package (.market)
"""

from __future__ import annotations

import json
import logging
import time
import uuid
from typing import Any

from core.replay.models import (
    ReplayEvent,
    ReplayManifest,
    ReplayPackage,
    ReplayStreamType,
)

logger = logging.getLogger(__name__)


class ReplayRecorder:
    """Запись рыночных событий в replay-пакет.

    Использование:
        recorder = ReplayRecorder("BTCUSDT")
        recorder.record(event)
        recorder.stop()
        pkg = recorder.package
    """

    def __init__(
        self,
        name: str = "",
        description: str = "",
        symbols: list[str] | None = None,
        streams: list[str] | None = None,
    ) -> None:
        self._events: list[ReplayEvent] = []
        self._start_time: float = 0.0
        self._is_recording = False
        self._name = name or f"recording_{uuid.uuid4().hex[:8]}"
        self._description = description
        self._symbols = list(symbols or [])
        self._streams = list(streams or [])
        self._total_size: int = 0

    @property
    def is_recording(self) -> bool:
        return self._is_recording

    @property
    def event_count(self) -> int:
        return len(self._events)

    def record(self, event: ReplayEvent) -> None:
        """Записать одно событие."""
        if not self._is_recording:
            return

        self._events.append(event)
        self._total_size += len(json.dumps(event.to_dict(), default=str))

        # Добавляем символ/поток в метаданные
        if event.symbol not in self._symbols:
            self._symbols.append(event.symbol)
        stream_str = event.stream.value if isinstance(event.stream, ReplayStreamType) else str(event.stream)
        if stream_str not in self._streams:
            self._streams.append(stream_str)

    def start(self) -> None:
        """Начать запись."""
        self._events.clear()
        self._start_time = time.time()
        self._is_recording = True
        logger.info("ReplayRecorder started: %s", self._name)

    def stop(self) -> ReplayPackage:
        """Остановить запись и вернуть пакет."""
        self._is_recording = False
        if not self._events:
            logger.warning("ReplayRecorder stopped with 0 events")
            return self._make_package([])

        logger.info(
            "ReplayRecorder stopped: %d events, %.1fKB",
            len(self._events), self._total_size / 1024,
        )
        return self._make_package(self._events)

    def _make_package(self, events: list[ReplayEvent]) -> ReplayPackage:
        if not events:
            return ReplayPackage(
                manifest=ReplayManifest(
                    name=self._name,
                    description=self._description,
                    symbols=self._symbols,
                    streams=self._streams,
                ),
                events=[],
            )

        timestamps = sorted(e.timestamp for e in events)
        manifest = ReplayManifest(
            name=self._name,
            description=self._description,
            symbols=self._symbols,
            streams=self._streams,
            start_time=timestamps[0],
            end_time=timestamps[-1],
            event_count=len(events),
        )
        return ReplayPackage(manifest=manifest, events=events)
