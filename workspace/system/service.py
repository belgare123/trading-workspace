"""
System Monitor — Mock Runtime Service.

Provides realistic platform-health mock data. The computed Health Score
aggregates component scores (resources, services, alerts, plugins,
replay, event store) so it's never a hardcoded number.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from .models import (
    Alert,
    ComponentScore,
    EventStoreMetrics,
    HealthStatus,
    PluginRuntimeMetrics,
    ResourceMetrics,
    RuntimeService,
    SystemOverview,
    TimelineEvent,
    WebSocketMetrics,
)

# ── Helpers ────────────────────────────────────────────────────────

_now = datetime.utcnow()


def _ts(**delta: int) -> str:
    """Return ISO timestamp relative to now."""
    return (_now - timedelta(**delta)).isoformat(timespec="minutes")


def _fmt_duration(seconds: int) -> str:
    h, r = divmod(seconds, 3600)
    m, s = divmod(r, 60)
    if h:
        return f"{h}h {m}m"
    if m:
        return f"{m}m {s}s"
    return f"{s}s"


# ── Mock Data ──────────────────────────────────────────────────────


def get_mock_services() -> list[RuntimeService]:
    return [
        RuntimeService(id="svc-scanner", name="Scanner", status="running", uptime_seconds=187200, version="1.2.0", pid=1423, port=9122),
        RuntimeService(id="svc-replay", name="Replay", status="running", uptime_seconds=172800, version="1.1.0", pid=1424, port=9123),
        RuntimeService(id="svc-marketplace", name="Marketplace", status="running", uptime_seconds=187200, version="1.0.0", pid=1425, port=9124),
        RuntimeService(id="svc-ml", name="ML Runtime", status="running", uptime_seconds=86400, version="0.9.0", pid=1426, port=9125),
        RuntimeService(id="svc-workspace", name="Workspace API", status="running", uptime_seconds=187200, version="1.0.0", pid=1420, port=9121),
        RuntimeService(id="svc-strategy", name="Strategy Engine", status="degraded", uptime_seconds=43200, version="1.2.0", pid=1427, port=9126),
    ]


def get_mock_resources() -> ResourceMetrics:
    return ResourceMetrics(
        cpu_percent=34.2,
        memory_percent=41.7,
        memory_mb=614.3,
        threads=184,
        sqlite_size_mb=47.8,
        open_files=312,
    )


def get_mock_event_store() -> EventStoreMetrics:
    return EventStoreMetrics(
        total_events_today=2_134_582,
        append_per_second=2430.0,
        active_readers=8,
        stream_count=47,
        snapshot_count=12,
        replay_status="running",
        trace_queries=156,
    )


def get_mock_websockets() -> WebSocketMetrics:
    return WebSocketMetrics(
        total_clients=26,
        clients_by_channel={
            "scanner": 18,
            "replay": 2,
            "strategies": 6,
        },
    )


def get_mock_plugins() -> PluginRuntimeMetrics:
    return PluginRuntimeMetrics(
        installed=24,
        enabled=18,
        disabled=6,
        errors=0,
    )


def get_mock_timeline() -> list[TimelineEvent]:
    return [
        TimelineEvent(id="ev-001", timestamp=_ts(hours=0, minutes=16), icon="🤖", title="Training finished",
                       description="News Sentiment Analyzer completed epoch 100/100", type="success"),
        TimelineEvent(id="ev-002", timestamp=_ts(hours=0, minutes=18), icon="🔄", title="Strategy restarted",
                       description="Momentum Strategy v2 reloaded with new parameters", type="info"),
        TimelineEvent(id="ev-003", timestamp=_ts(hours=0, minutes=19), icon="▶️", title="Replay loaded",
                       description="BTC/USDT 2026-01-15 session loaded (1.2M ticks)", type="info"),
        TimelineEvent(id="ev-004", timestamp=_ts(hours=0, minutes=22), icon="🧩", title="Plugin installed",
                       description="liquidity-engine@1.3.0 installed by user", type="success"),
        TimelineEvent(id="ev-005", timestamp=_ts(hours=0, minutes=30), icon="📊", title="ML model promoted",
                       description="Momentum Predictor v2.1.0 promoted to Production", type="success"),
        TimelineEvent(id="ev-006", timestamp=_ts(hours=1, minutes=5), icon="⚡", title="Scanner snapshot",
                       description="21 symbols scanned, 3 setup alerts fired", type="info"),
        TimelineEvent(id="ev-007", timestamp=_ts(hours=1, minutes=15), icon="⚠️", title="Replay queue warning",
                       description="Replay event queue exceeded 80% capacity", type="warning"),
        TimelineEvent(id="ev-008", timestamp=_ts(hours=2, minutes=0), icon="🧠", title="Experiment started",
                       description="XGBoost hyperparameter sweep #12 initiated", type="info"),
        TimelineEvent(id="ev-009", timestamp=_ts(hours=2, minutes=30), icon="🔌", title="Plugin disabled",
                       description="order-block-core@0.4.0 disabled by user", type="warning"),
        TimelineEvent(id="ev-010", timestamp=_ts(hours=3, minutes=0), icon="📈", title="Strategy P&L updated",
                       description="Daily P&L: +$2,340.12 (momentum: +$1,820, mean-rev: +$520)", type="success"),
        TimelineEvent(id="ev-011", timestamp=_ts(hours=4, minutes=0), icon="🔄", title="Event Store cleanup",
                       description="Auto-archived 12.4k events older than 7 days", type="info"),
        TimelineEvent(id="ev-012", timestamp=_ts(hours=5, minutes=0), icon="🧪", title="Backtest completed",
                       description="LSTM v4 on BTC/USDT Q2: Sharpe 1.87, Return 14.3%", type="success"),
        TimelineEvent(id="ev-013", timestamp=_ts(hours=6, minutes=0), icon="⚠️", title="Strategy runtime warning",
                       description="Memory usage for Whale Flow strategy exceeded 512 MB", type="warning"),
        TimelineEvent(id="ev-014", timestamp=_ts(hours=8, minutes=0), icon="✅", title="Daily health check",
                       description="All services passed health check — 0 failures", type="success"),
        TimelineEvent(id="ev-015", timestamp=_ts(hours=12, minutes=0), icon="🤖", title="ML training queued",
                       description="Market Regime Classifier v2 training queued for off-peak", type="info"),
        TimelineEvent(id="ev-016", timestamp=_ts(hours=24, minutes=0), icon="📊", title="Weekly report generated",
                       description="Week 28 summary: +8.2% across all strategies", type="success"),
    ]


def get_mock_alerts() -> list[Alert]:
    return [
        Alert(id="alert-001", type="warning", title="Replay queue lag",
              description="Replay event queue depth at 78% threshold — consider increasing partition count",
              timestamp=_ts(hours=0, minutes=15)),
        Alert(id="alert-002", type="warning", title="High CPU",
              description="ML Runtime sustained CPU > 85% for 5 minutes — training may be blocking other services",
              timestamp=_ts(hours=0, minutes=30)),
        Alert(id="alert-003", type="warning", title="Slow strategy",
              description="Momentum Strategy v2 tick processing > 50ms — consider reducing symbol count",
              timestamp=_ts(hours=1, minutes=0)),
        Alert(id="alert-004", type="info", title="Plugin update available",
              description="3 plugin updates available: liquidity-engine 1.4.0, order-block-core 0.5.0, ml-runtime 0.10.0",
              timestamp=_ts(hours=2, minutes=0)),
        Alert(id="alert-005", type="info", title="Snapshot schedule",
              description="Next Event Store snapshot scheduled in 45 minutes",
              timestamp=_ts(hours=3, minutes=0)),
    ]


def compute_health_score(
    resources: ResourceMetrics,
    services: list[RuntimeService],
    alerts: list[Alert],
    plugins: PluginRuntimeMetrics,
    event_store: EventStoreMetrics,
) -> tuple[float, list[ComponentScore]]:
    """
    Compute overall health from multiple dimensions.
    Each component returns 0–100; the final score is a weighted average.
    """
    components: list[ComponentScore] = []

    # ── Resources (weight 25%) ──
    cpu_score = max(0.0, 100.0 - resources.cpu_percent)           # 0% → 100, 100% → 0
    mem_score = max(0.0, 100.0 - resources.memory_percent)        # same
    resource_score = cpu_score * 0.4 + mem_score * 0.6
    resource_status = "healthy" if resource_score >= 80 else ("degraded" if resource_score >= 50 else "critical")
    components.append(ComponentScore(name="resources", score=round(resource_score, 1), weight=25, status=resource_status))

    # ── Services (weight 25%) ──
    running = sum(1 for s in services if s.status == "running")
    total = len(services)
    service_score = (running / total) * 100.0 if total else 100.0
    # degraded services reduce score proportionally
    degraded = sum(1 for s in services if s.status == "degraded")
    service_score -= degraded * 10.0
    service_score = max(0.0, service_score)
    service_status = "healthy" if service_score >= 80 else ("degraded" if service_score >= 50 else "critical")
    components.append(ComponentScore(name="services", score=round(service_score, 1), weight=25, status=service_status))

    # ── Alerts (weight 15%) ──
    critical_alerts = sum(1 for a in alerts if a.type == "critical")
    warning_alerts = sum(1 for a in alerts if a.type == "warning")
    alert_score = max(0.0, 100.0 - critical_alerts * 30.0 - warning_alerts * 10.0)
    alert_status = "healthy" if alert_score >= 80 else ("degraded" if alert_score >= 50 else "critical")
    components.append(ComponentScore(name="alerts", score=round(alert_score, 1), weight=15, status=alert_status))

    # ── Plugins (weight 10%) ──
    if plugins.installed:
        plugin_health = (plugins.enabled / plugins.installed) * 100.0
        plugin_error_penalty = plugins.errors * 15.0
        plugin_score = max(0.0, plugin_health - plugin_error_penalty)
    else:
        plugin_score = 100.0
    plugin_status = "healthy" if plugin_score >= 80 else ("degraded" if plugin_score >= 50 else "critical")
    components.append(ComponentScore(name="plugins", score=round(plugin_score, 1), weight=10, status=plugin_status))

    # ── Replay / Event Store (weight 15%) ──
    es_score = 100.0
    if event_store.replay_status == "running":
        es_score = 95.0  # running is fine, slight deduction for active load
    elif event_store.replay_status == "paused":
        es_score = 60.0
    # If append rate is very low, might indicate queue backup
    if event_store.append_per_second < 500:
        es_score -= 10.0
    es_status = "healthy" if es_score >= 80 else ("degraded" if es_score >= 50 else "critical")
    components.append(ComponentScore(name="event_store", score=round(es_score, 1), weight=15, status=es_status))

    # ── Weighted average ──
    total_weight = sum(c.weight for c in components)
    overall = sum(c.score * c.weight for c in components) / total_weight if total_weight else 100.0
    overall = round(overall, 1)

    overall_status: str
    if overall >= 80:
        overall_status = "healthy"
    elif overall >= 50:
        overall_status = "degraded"
    else:
        overall_status = "critical"

    return overall, components, overall_status


def create_system_api() -> dict[str, Any]:
    """Build the full system overview with computed health."""
    services = get_mock_services()
    resources = get_mock_resources()
    event_store = get_mock_event_store()
    websockets = get_mock_websockets()
    plugins = get_mock_plugins()
    timeline = get_mock_timeline()
    alerts = get_mock_alerts()

    overall_score, component_scores, overall_status = compute_health_score(
        resources, services, alerts, plugins, event_store,
    )

    health = HealthStatus(
        overall_score=overall_score,
        status=overall_status,
        components=component_scores,
    )

    overview = SystemOverview(
        services=services,
        resources=resources,
        event_store=event_store,
        websockets=websockets,
        plugins=plugins,
        timeline=timeline,
        alerts=alerts,
        health=health,
    )

    return overview.to_dict()


# ── Individual endpoints (cached from aggregate) ──


def get_system_services() -> list[dict[str, Any]]:
    return [s.to_dict() for s in get_mock_services()]


def get_system_resources() -> dict[str, Any]:
    return get_mock_resources().to_dict()


def get_system_events() -> dict[str, Any]:
    return get_mock_event_store().to_dict()


def get_system_websockets() -> dict[str, Any]:
    return get_mock_websockets().to_dict()


def get_system_plugins() -> dict[str, Any]:
    return get_mock_plugins().to_dict()


def get_system_timeline() -> list[dict[str, Any]]:
    return [t.to_dict() for t in get_mock_timeline()]


def get_system_alerts() -> list[dict[str, Any]]:
    return [a.to_dict() for a in get_mock_alerts()]


def get_system_health() -> dict[str, Any]:
    services = get_mock_services()
    resources = get_mock_resources()
    event_store = get_mock_event_store()
    plugins = get_mock_plugins()
    alerts = get_mock_alerts()

    overall_score, component_scores, overall_status = compute_health_score(
        resources, services, alerts, plugins, event_store,
    )
    return HealthStatus(
        overall_score=overall_score,
        status=overall_status,
        components=component_scores,
    ).to_dict()
