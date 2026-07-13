"""
Analytics Engine — Session Analysis (Phase 11.5).
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from core.analytics.models import SessionType

logger = logging.getLogger(__name__)

# UTC часы для сессий
SESSION_RANGES: list[tuple[int, int, SessionType]] = [
    (0, 2, SessionType.ASIA),
    (2, 8, SessionType.ASIA),
    (8, 9, SessionType.OVERLAP_ASIA_LONDON),
    (9, 12, SessionType.LONDON),
    (12, 13, SessionType.OVERLAP_LONDON_NY),
    (13, 16, SessionType.LONDON),
    (16, 21, SessionType.NEW_YORK),
    (21, 24, SessionType.CLOSED),
]


def get_current_session(now: datetime | None = None) -> SessionType:
    """Определить текущую торговую сессию по времени UTC.

    Asia:    00:00 - 08:00 UTC
    London:  08:00 - 16:00 UTC
    NY:      13:00 - 21:00 UTC
    """
    if now is None:
        now = datetime.now(timezone.utc)
    hour = now.hour
    for start, end, session in SESSION_RANGES:
        if start <= hour < end:
            return session
    return SessionType.CLOSED


def is_session_active(session: SessionType, now: datetime | None = None) -> bool:
    """Проверить активна ли сессия сейчас."""
    return get_current_session(now) == session
