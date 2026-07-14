"""
Service Runtime — Data Model.

Базовые типы для всей Service Runtime:
- IService        — полный протокол жизненного цикла
- ServiceMetadata — описание и метаданные сервиса
- RestartPolicy   — стратегия перезапуска при сбое
- HealthStatus    — результат проверки здоровья
"""

from __future__ import annotations

import enum
import time
from dataclasses import dataclass, field
from typing import Any, Protocol

from core.di import Phase


# ═══════════════════════════════════════════════════════════════════════════════
#  IService
# ═══════════════════════════════════════════════════════════════════════════════


class IService(Protocol):
    """Полный протокол жизненного цикла сервиса.

    Любой компонент платформы — Exchange, FeatureEngine, Telegram, Replay,
    Plugin Loader — реализует этот контракт.

    Фазы жизненного цикла:
        1. initialize()  — загрузить конфиг, создать ресурсы
        2. start()       — подписаться, начать обработку
        3. health()      — отчёт о состоянии (вызывается периодически)
        4. stop()        — приостановить обработку
        5. shutdown()    — освободить ресурсы (финальная очистка)

    Structural typing — наследовать IService не обязательно.
    """

    name: str
    """Уникальное имя сервиса (например, 'telegram', 'feature_engine')."""

    phase: Phase
    """Фаза, к которой относится сервис (влияет на порядок запуска/остановки)."""

    async def initialize(self) -> None:
        """Инициализация: загрузка конфига, создание ресурсов.

        Вызывается **до** start(). Здесь сервис:
        - Читает настройки
        - Создаёт пулы соединений
        - Загружает калькуляторы/плагины

        Если initialize() упал — сервис не перейдёт в start().
        """
        ...

    async def start(self) -> None:
        """Запуск: подписка, начало обработки.

        Вызывается **после** initialize(). Здесь сервис:
        - Подписывается на EventBus
        - Запускает background tasks
        - Открывает порты (если network-сервис)
        """
        ...

    async def stop(self) -> None:
        """Остановка: приостановить обработку.

        Вызывается при graceful shutdown. Здесь сервис:
        - Отписывается от событий
        - Закрывает соединения (но не уничтожает)
        - Сохраняет состояние (checkpoint)

        После stop() может быть start() — например, при restart.
        """
        ...

    async def shutdown(self) -> None:
        """Завершение: освобождение всех ресурсов.

        Вызывается **один раз** при остановке приложения. Здесь сервис:
        - Закрывает соединения
        - Удаляет временные файлы
        - Финализирует логи

        После shutdown() сервис считается мёртвым — start() больше не вызывается.
        """
        ...

    async def health(self) -> dict[str, Any]:
        """Проверка состояния сервиса.

        Returns:
            dict с ключами:
                - state: str      — running | degraded | stopped | error
                - latency_ms: float  — время ответа (заполняется Runtime)
                - last_update: float — timestamp последней успешной проверки
                - errors: int       — количество ошибок с последнего успеха
                - detail: str       — описание (причина degraded/error)
                - meta: dict        — произвольные метрики сервиса
        """
        ...


# ═══════════════════════════════════════════════════════════════════════════════
#  ServiceMetadata
# ═══════════════════════════════════════════════════════════════════════════════


@dataclass
class ServiceMetadata:
    """Метаданные сервиса — регистрационная информация.

    Используется Registry для построения графа зависимостей
    и определения порядка запуска/остановки.

    Attributes:
        name:         Уникальное имя сервиса (должно совпадать с IService.name)
        version:      Семантическая версия (semver)
        priority:     Приоритет запуска (0-100, выше = раньше).
                      Используется как fallback если граф зависимостей плоский.
        critical:     Если True — сбой сервиса останавливает приложение.
        dependencies: Список имён сервисов, от которых зависит данный.
                      Registry строит DAG на основе этой информации.
    """

    name: str
    version: str = "1.0"
    priority: int = 50
    critical: bool = False
    dependencies: list[str] = field(default_factory=list)

    def __repr__(self) -> str:
        deps = f", deps={self.dependencies}" if self.dependencies else ""
        critical = ", CRITICAL" if self.critical else ""
        return (
            f"ServiceMetadata({self.name} v{self.version}"
            f", prio={self.priority}{critical}{deps})"
        )


# ═══════════════════════════════════════════════════════════════════════════════
#  RestartPolicy
# ═══════════════════════════════════════════════════════════════════════════════


class RestartPolicy(enum.Enum):
    """Стратегия перезапуска сервиса при сбое.

    ALWAYS:
        Перезапускать всегда — даже после clean stop().
        Подходит для: Telegram (должен быть всегда онлайн).

    ON_FAILURE:
        Перезапускать только если сервис упал с ошибкой.
        Не перезапускать после clean stop().
        Подходит для: большинство сервисов.

    NEVER:
        Никогда не перезапускать.
        Подходит для: Replay (завершил работу — значит закончил),
        одноразовые задачи.
    """

    ALWAYS = "always"
    ON_FAILURE = "on_failure"
    NEVER = "never"


# ═══════════════════════════════════════════════════════════════════════════════
#  HealthStatus
# ═══════════════════════════════════════════════════════════════════════════════


@dataclass
class HealthStatus:
    """Результат проверки здоровья сервиса.

    Attributes:
        state:       Текущее состояние (running | degraded | stopped | error)
        latency_ms:  Время ответа healthcheck в миллисекундах
        last_update: Unix timestamp последнего успешного healthcheck
        errors:      Количество ошибок подряд (сбрасывается после успеха)
        detail:      Человекочитаемое описание (особенно при degraded/error)
        meta:        Произвольные метрики сервиса
    """

    state: str = "unknown"
    latency_ms: float = 0.0
    last_update: float = field(default_factory=time.time)
    errors: int = 0
    detail: str = ""
    meta: dict[str, Any] = field(default_factory=dict)

    # ── Factory методы ──

    @classmethod
    def ok(cls, detail: str = "running", meta: dict | None = None) -> HealthStatus:
        return cls(
            state="running",
            detail=detail,
            meta=meta or {},
        )

    @classmethod
    def degraded(cls, detail: str, meta: dict | None = None) -> HealthStatus:
        return cls(
            state="degraded",
            detail=detail,
            meta=meta or {},
        )

    @classmethod
    def error(cls, detail: str, meta: dict | None = None) -> HealthStatus:
        return cls(
            state="error",
            detail=detail,
            meta=meta or {},
        )

    @classmethod
    def stopped(cls, detail: str = "stopped") -> HealthStatus:
        return cls(state="stopped", detail=detail)

    # ── Свойства ──

    @property
    def is_healthy(self) -> bool:
        return self.state == "running"

    @property
    def is_degraded(self) -> bool:
        return self.state == "degraded"

    @property
    def is_error(self) -> bool:
        return self.state == "error"

    @property
    def is_stopped(self) -> bool:
        return self.state == "stopped"

    def to_dict(self) -> dict[str, Any]:
        """Сериализация (для Dashboard, /status endpoint)."""
        return {
            "state": self.state,
            "latency_ms": round(self.latency_ms, 2),
            "last_update": self.last_update,
            "errors": self.errors,
            "detail": self.detail,
            "meta": self.meta,
        }

    def __repr__(self) -> str:
        return (
            f"HealthStatus({self.state}"
            f", latency={self.latency_ms:.1f}ms"
            f", errors={self.errors}"
            f", detail={self.detail[:50]!r})"
        )
