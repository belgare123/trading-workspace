"""
[Deprecated] DI Container — перенесён в core/di/.

Пожалуйста, обновите импорты:
    from core.di import Container, Phase
вместо
    from core.di import Container, Phase
"""

from core.di import Container, Phase

__all__ = ["Container", "Phase"]
