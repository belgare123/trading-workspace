"""
DI Container + Phased Bootstrap для Crypto Screener v2.

Container хранит все компоненты приложения в одном месте и управляет
их жизненным циклом (инициализация → старт → останов).
Регистрация по интерфейсам (Protocol) с авто-внедрением зависимостей.

Phase перенесён в core.app.phases, реэкспортируется для совместимости.
"""

from core.app.phases import Phase
from core.di.container import Container
from core.di.providers import (
    FactoryProvider,
    LazySingletonProvider,
    Provider,
    SingletonProvider,
)

__all__ = [
    "Container",
    "Phase",
    "Provider",
    "SingletonProvider",
    "FactoryProvider",
    "LazySingletonProvider",
]
