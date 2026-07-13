"""
Trading Workspace Platform — официальная точка входа.

Usage:
    python run.py

Использует Application.launch() — единый lifecycle:
    bootstrap() → register all components
    start()     → start all services
    run()       → main loop until SIGINT/SIGTERM
"""

import asyncio
import logging

from core.app import Application

logger = logging.getLogger(__name__)


def setup_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    logging.getLogger("websockets").setLevel(logging.WARNING)
    logging.getLogger("asyncio").setLevel(logging.WARNING)


async def main() -> None:
    setup_logging()
    logger.info("=" * 60)
    logger.info("Crypto Screener v2 starting...")
    logger.info("=" * 60)

    app = Application()
    await app.launch()


if __name__ == "__main__":
    asyncio.run(main())
