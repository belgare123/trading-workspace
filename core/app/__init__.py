"""
App Lifecycle — жизненный цикл приложения.

Содержит:
- Application — главный класс приложения (bootstrap → start → run → shutdown)
- Lifecycle — стейт-машина стадий приложения
- Bootstrap — чистая регистрация компонентов (без запуска)
- Health — система проверки состояния
- IService — интерфейс сервиса
- Phase — фазы инициализации
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from core.app.application import Application, run_app
from core.app.bootstrap import bootstrap_app
from core.app.health import HealthRegistry, HealthStatus
from core.app.lifecycle import Lifecycle, LifecycleStage
from core.app.phases import Phase

if TYPE_CHECKING:
    from core.services import IService

__all__ = [
    "Application",
    "run_app",
    "bootstrap_app",
    "HealthRegistry",
    "HealthStatus",
    "IService",
    "Lifecycle",
    "LifecycleStage",
    "Phase",
]
