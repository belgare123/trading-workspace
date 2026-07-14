"""
System Monitor — Data Models.

Defines the platform health dashboard models: runtime services,
resource metrics, event store statistics, WebSocket clients,
plugin runtime, timeline, alerts, and overall health score.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


# ── Component Models ───────────────────────────────────────────────


@dataclass
class RuntimeService:
    id: str = ""
    name: str = ""
    status: str = "running"  # running | stopped | error | degraded
    uptime_seconds: int = 0
    version: str = "1.0.0"
    pid: int = 0
    port: int | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "status": self.status,
            "uptime_seconds": self.uptime_seconds,
            "version": self.version,
            "pid": self.pid,
            "port": self.port,
        }


@dataclass
class ResourceMetrics:
    cpu_percent: float = 0.0
    memory_percent: float = 0.0
    memory_mb: float = 0.0
    threads: int = 0
    sqlite_size_mb: float = 0.0
    open_files: int = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "cpu_percent": self.cpu_percent,
            "memory_percent": self.memory_percent,
            "memory_mb": self.memory_mb,
            "threads": self.threads,
            "sqlite_size_mb": self.sqlite_size_mb,
            "open_files": self.open_files,
        }


@dataclass
class EventStoreMetrics:
    total_events_today: int = 0
    append_per_second: float = 0.0
    active_readers: int = 0
    stream_count: int = 0
    snapshot_count: int = 0
    replay_status: str = "idle"  # idle | running | paused
    trace_queries: int = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "total_events_today": self.total_events_today,
            "append_per_second": self.append_per_second,
            "active_readers": self.active_readers,
            "stream_count": self.stream_count,
            "snapshot_count": self.snapshot_count,
            "replay_status": self.replay_status,
            "trace_queries": self.trace_queries,
        }


@dataclass
class WebSocketMetrics:
    total_clients: int = 0
    clients_by_channel: dict[str, int] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "total_clients": self.total_clients,
            "clients_by_channel": self.clients_by_channel,
        }


@dataclass
class PluginRuntimeMetrics:
    installed: int = 0
    enabled: int = 0
    disabled: int = 0
    errors: int = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "installed": self.installed,
            "enabled": self.enabled,
            "disabled": self.disabled,
            "errors": self.errors,
        }


@dataclass
class TimelineEvent:
    id: str = ""
    timestamp: str = ""
    icon: str = ""
    title: str = ""
    description: str = ""
    type: str = "info"  # info | success | warning | error

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "timestamp": self.timestamp,
            "icon": self.icon,
            "title": self.title,
            "description": self.description,
            "type": self.type,
        }


@dataclass
class Alert:
    id: str = ""
    type: str = "warning"  # critical | warning | info
    title: str = ""
    description: str = ""
    timestamp: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "type": self.type,
            "title": self.title,
            "description": self.description,
            "timestamp": self.timestamp,
        }


@dataclass
class ComponentScore:
    name: str = ""
    score: float = 100.0
    weight: float = 1.0
    status: str = "healthy"  # healthy | degraded | critical

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "score": self.score,
            "weight": self.weight,
            "status": self.status,
        }


@dataclass
class HealthStatus:
    overall_score: float = 100.0
    status: str = "healthy"  # healthy | degraded | critical
    components: list[ComponentScore] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "overall_score": self.overall_score,
            "status": self.status,
            "components": [c.to_dict() for c in self.components],
        }


# ── Aggregate ──────────────────────────────────────────────────────


@dataclass
class SystemOverview:
    services: list[RuntimeService] = field(default_factory=list)
    resources: ResourceMetrics = field(default_factory=ResourceMetrics)
    event_store: EventStoreMetrics = field(default_factory=EventStoreMetrics)
    websockets: WebSocketMetrics = field(default_factory=WebSocketMetrics)
    plugins: PluginRuntimeMetrics = field(default_factory=PluginRuntimeMetrics)
    timeline: list[TimelineEvent] = field(default_factory=list)
    alerts: list[Alert] = field(default_factory=list)
    health: HealthStatus = field(default_factory=HealthStatus)

    def to_dict(self) -> dict[str, Any]:
        return {
            "services": [s.to_dict() for s in self.services],
            "resources": self.resources.to_dict(),
            "event_store": self.event_store.to_dict(),
            "websockets": self.websockets.to_dict(),
            "plugins": self.plugins.to_dict(),
            "timeline": [t.to_dict() for t in self.timeline],
            "alerts": [a.to_dict() for a in self.alerts],
            "health": self.health.to_dict(),
        }
