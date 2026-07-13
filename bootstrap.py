"""
⚠️ bootstrap.py — устарел.

Используйте run.py вместо него.

Roadmap удаления:
    v0.11.x — DeprecationWarning
    v0.12.x — предупреждение в лог + stdout
    v1.0.0  — файл удаляется
"""

import asyncio
import logging
import warnings

from core.app import Application

logger = logging.getLogger(__name__)


def main():
    ...


if __name__ == "__main__":
    warnings.warn(
        "bootstrap.py is deprecated. Use run.py instead.",
        DeprecationWarning,
        stacklevel=2,
    )
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    logger.warning("bootstrap.py is deprecated — use run.py instead")

    asyncio.run(Application().launch())
