"""
DI Container с поддержкой интерфейсов (Protocol), провайдеров
и авто-внедрения зависимостей (inject).

Container — сердце системы. Все компоненты (движки, сервисы, хранилища)
регистрируются здесь по интерфейсу или строковому имени, а стратегии получают
зависимости через конструктор.

Usage:
    container = Container()
    container.register(IFeatureEngine, FeatureEngine(...))
    container.register(IFeatureStore, get_feature_store())

    # resolve по интерфейсу
    fe = container.resolve(IFeatureEngine)

    # или по строковому имени
    store = container.get("feature_store")

    # авто-внедрение
    class MyStrategy:
        def __init__(self, features: IFeatureEngine, bus: IEventBus):
            ...
    strategy = container.inject(MyStrategy)
"""

from __future__ import annotations

import inspect
import asyncio
import logging
import time
from typing import (
    Any,
    Callable,
    Generic,
    TypeVar,
    get_type_hints,
)

from core.app.phases import Phase

logger = logging.getLogger(__name__)


# ══════════════════════════════════════════════
#  Type tokens
# ══════════════════════════════════════════════

T = TypeVar("T")

# ══════════════════════════════════════════════
#  Providers
# ══════════════════════════════════════════════


class Provider(Generic[T]):
    """Базовый класс провайдера."""

    def get(self) -> T:
        raise NotImplementedError

    async def async_get(self) -> T:
        return self.get()


class SingletonProvider(Provider[T]):
    """Провайдер, возвращающий один экземпляр."""

    def __init__(self, instance: T):
        self._instance = instance

    def get(self) -> T:
        return self._instance


class FactoryProvider(Provider[T]):
    """Провайдер, создающий новый экземпляр при каждом
    вызове get() через переданную фабрику."""

    def __init__(self, factory: Callable[[], T]):
        self._factory = factory

    def get(self) -> T:
        return self._factory()


class LazySingletonProvider(Provider[T]):
    """Провайдер, создающий экземпляр при первом вызове get()
    и кеширующий его."""

    def __init__(self, factory: Callable[[], T]):
        self._factory = factory
        self._instance: T | None = None

    def get(self) -> T:
        if self._instance is None:
            self._instance = self._factory()
        return self._instance


# ══════════════════════════════════════════════
#  Container
# ══════════════════════════════════════════════


class Container:
    """Контейнер зависимостей.

    Регистрирует компоненты по интерфейсу (Protocol) или по имени.
    Поддерживает resolve типизированный, авто-внедрение через inject,
    и обратную совместимость со старым get(name).
    """

    def __init__(self):
        # interface_type -> Provider
        self._registry: dict[type, Provider] = {}
        # name -> instance
        self._components: dict[str, Any] = {}
        # Фоновые задачи
        self._ticker_tasks: list[Any] = []
        self._running = False
        self.loop_start_time: float = 0.0
        self._current_phase: Phase | None = None

    # ── Регистрация ──

    def register(
        self,
        interface: type[T],
        instance: T | None = None,
        *,
        provider: Provider[T] | None = None,
        factory: Callable[[], T] | None = None,
    ) -> None:
        """Зарегистрировать компонент.

        Args:
            interface: Интерфейс (Protocol) или класс.
            instance: Экземпляр (создаёт SingletonProvider).
            provider: Кастомный провайдер.
            factory: Фабрика (создаёт FactoryProvider).

        Пример:
            container.register(IFeatureEngine, engine)
            container.register(IFeatureStore, provider=SingletonProvider(store))
            container.register(IEventBus, factory=lambda: EventBus())
        """
        if provider is not None:
            self._registry[interface] = provider
        elif instance is not None:
            self._registry[interface] = SingletonProvider(instance)
        elif factory is not None:
            self._registry[interface] = LazySingletonProvider(factory)
        else:
            raise ValueError(
                f"register({interface.__name__}) requires instance, provider, or factory"
            )

    def register_instance(self, name: str, instance: Any) -> None:
        """Регистрация по строковому имени."""
        self._components[name] = instance

    def set(self, name: str, instance: Any) -> None:
        """Alias for register_instance()."""
        self._components[name] = instance

    # ── Получение ──

    def resolve(self, interface: type[T]) -> T:
        """Получить компонент по интерфейсу.

        Raises KeyError, если не зарегистрирован.
        """
        provider = self._registry.get(interface)
        if provider is None:
            raise KeyError(
                f"No provider registered for {interface.__name__} "
                f"(phase: {self._current_phase})"
            )
        return provider.get()

    def resolve_or_none(self, interface: type[T]) -> T | None:
        """Получить компонент или None, если не зарегистрирован."""
        provider = self._registry.get(interface)
        if provider is None:
            return None
        return provider.get()

    def get(self, name: str, default: Any = None) -> Any:
        """Получить компонент по строковому имени."""
        return self._components.get(name, default)

    def require(self, name: str) -> Any:
        """Получить компонент по имени или raise."""
        val = self._components.get(name)
        if val is None:
            raise KeyError(
                f"Component '{name}' not registered "
                f"(phase: {self._current_phase})"
            )
        return val

    # ── Авто-внедрение ──

    def inject(self, cls: type[T], **overrides) -> T:
        """Создать экземпляр класса с авто-внедрением зависимостей.

        Аргументы конструктора резолвятся по type hints.
        Переданные **overrides имеют приоритет.

        Пример:
            engine = container.inject(StrategyEngine, feature_engine=my_fe)
        """
        hints = get_type_hints(cls.__init__)
        kwargs = {}
        for param_name, param_type in hints.items():
            if param_name == "return":
                continue
            if param_name in overrides:
                kwargs[param_name] = overrides[param_name]
                continue
            # Пытаемся найти провайдер для этого типа
            if param_type in self._registry:
                kwargs[param_name] = self.resolve(param_type)
            # Если тип str/int/float/bool — пропускаем
            elif param_type in (str, int, float, bool):
                continue
            # Ищем в named components по имени
            elif param_name in self._components:
                kwargs[param_name] = self._components[param_name]
        return cls(**kwargs)

    # ── Фазовая инициализация ──

    @property
    def current_phase(self) -> Phase | None:
        return self._current_phase

    @property
    def phases_completed(self) -> list[Phase]:
        if self._current_phase is None:
            return []
        idx = list(Phase).index(self._current_phase)
        return list(Phase)[: idx + 1]

    async def run_phase(self, phase: Phase, setup: Callable) -> None:
        """Выполнить фазу инициализации.

        Args:
            phase: Фаза для выполнения.
            setup: Функция (async или sync), принимающая Container.
        """
        self._current_phase = phase
        logger.info("[bootstrap] Phase %s...", phase.name)
        t0 = time.perf_counter()
        try:
            if asyncio.iscoroutinefunction(setup):
                await setup(self)
            else:
                setup(self)
            elapsed = time.perf_counter() - t0
            logger.info("[bootstrap] Phase %s complete (%.2fs)", phase.name, elapsed)
        except Exception:
            logger.exception("[bootstrap] Phase %s FAILED", phase.name)
            raise

    # ── Фоновые задачи ──

    def create_task(self, coro, name: str = "") -> asyncio.Task:
        """Создать фоновую задачу."""
        task = asyncio.create_task(coro, name=name)
        self._ticker_tasks.append(task)
        return task

    async def cancel_all_tasks(self):
        """Отменить все фоновые задачи."""
        for task in self._ticker_tasks:
            task.cancel()

    # ── Состояние ──

    @property
    def running(self) -> bool:
        return self._running

    @running.setter
    def running(self, value: bool):
        self._running = value

    def __repr__(self) -> str:
        interfaces = list(self._registry.keys())
        names = list(self._components.keys())
        return (
            f"Container("
            f"interfaces={len(interfaces)}, "
            f"named={len(names)}, "
            f"tasks={len(self._ticker_tasks)}, "
            f"phase={self._current_phase.name if self._current_phase else 'none'})"
        )
