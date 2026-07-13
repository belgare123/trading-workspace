"""
⚠️ Устарел. Используйте core/services/base.py вместо этого.

Re-export для обратной совместимости.
"""

from __future__ import annotations

import warnings
from typing import Any, Protocol

from core.services.base import IService as _IService

warnings.warn(
    "core.app.interfaces is deprecated. "
    "Use from core.services import IService instead.",
    DeprecationWarning,
    stacklevel=2,
)


class IService(Protocol):
    """⚠️ Устарел. Используйте IService из core.services.

    Оставлен для обратной совместимости.
    """

    async def start(self) -> None:
        ...

    async def stop(self) -> None:
        ...

    async def health(self) -> dict[str, Any]:
        ...
