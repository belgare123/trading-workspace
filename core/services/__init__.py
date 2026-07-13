"""
Service Runtime — полный lifecycle для всех сервисов платформы.

Позволяет любому компоненту (FeatureEngine, Telegram, Replay, REST API,
Plugin Loader) подключаться одинаково, без изменений в Application.

Application видит только:
    runtime.start_all()
    runtime.stop_all()

Всё остальное — Responsibility of Service Runtime.
"""

from __future__ import annotations

from core.services.base import (
    HealthStatus,
    IService,
    RestartPolicy,
    ServiceMetadata,
)
from core.services.graph import DependencyGraph, DependencyError
from core.services.hooks import EventHooks
from core.services.metrics import MetricsCollector, ServiceMetrics
from core.services.registry import (
    RegistrationError,
    ServiceEntry,
    ServiceRegistry,
)
from core.services.runtime import ServiceRuntime, ServiceRuntimeError
from core.services.tasks import BackgroundTaskManager, TaskHandle

__all__ = [
    # Data Model
    "IService",
    "ServiceMetadata",
    "RestartPolicy",
    "HealthStatus",
    # Graph
    "DependencyGraph",
    "DependencyError",
    # Registry
    "ServiceRegistry",
    "ServiceEntry",
    "RegistrationError",
    # Runtime
    "ServiceRuntime",
    "ServiceRuntimeError",
    # Tasks
    "BackgroundTaskManager",
    "TaskHandle",
    # Hooks
    "EventHooks",
    # Metrics
    "MetricsCollector",
    "ServiceMetrics",
]
