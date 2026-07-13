"""
Провайдеры зависимостей.

Переопределены из container.py для удобного импорта.
"""

from core.di.container import (
    Provider,
    SingletonProvider,
    FactoryProvider,
    LazySingletonProvider,
)

__all__ = [
    "Provider",
    "SingletonProvider",
    "FactoryProvider",
    "LazySingletonProvider",
]
