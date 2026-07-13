"""
Workspace Core — App Registry.

Manages all workspace applications, their registration, ordering, and enable states.
"""

from __future__ import annotations

import logging
from typing import Any

from workspace.core import AppCategory, WorkspaceApp

logger = logging.getLogger(__name__)


_APPS: list[WorkspaceApp] = [
    WorkspaceApp(
        id="scanner",
        name="Scanner",
        description="Live signal stream from all strategies",
        icon="🔍",
        route="/scanner",
        category=AppCategory.SIGNALS,
        order=10,
        hotkey="1",
        tags=["signals", "live"],
    ),
    WorkspaceApp(
        id="opportunities",
        name="Opportunities",
        description="Active, pending and closed trading opportunities",
        icon="🎯",
        route="/opportunities",
        category=AppCategory.MARKET,
        order=20,
        hotkey="2",
        tags=["trades", "positions"],
    ),
    WorkspaceApp(
        id="strategies",
        name="Strategies",
        description="Strategy management: health, metrics, lifecycle",
        icon="🧠",
        route="/strategies",
        category=AppCategory.STRATEGIES,
        order=30,
        hotkey="3",
        tags=["strategies", "config"],
    ),
    WorkspaceApp(
        id="replay",
        name="Replay Studio",
        description="Deterministic backtest IDE with breakpoints",
        icon="▶️",
        route="/replay",
        category=AppCategory.ANALYSIS,
        order=40,
        hotkey="4",
        tags=["backtest", "debug"],
    ),
    WorkspaceApp(
        id="inspector",
        name="Inspector",
        description="Feature inspector: understand why decisions were made",
        icon="🔬",
        route="/inspector",
        category=AppCategory.ANALYSIS,
        order=50,
        hotkey="5",
        tags=["features", "explain"],
    ),
    WorkspaceApp(
        id="learning",
        name="Learning",
        description="ML model hub: accuracy, retrain, predictions",
        icon="🤖",
        route="/learning",
        category=AppCategory.LEARNING,
        order=60,
        hotkey="6",
        tags=["ml", "models"],
    ),
    WorkspaceApp(
        id="plugins",
        name="Plugin Store",
        description="Browse, install and manage plugins",
        icon="🧩",
        route="/plugins",
        category=AppCategory.PLUGINS,
        order=70,
        hotkey="7",
        tags=["marketplace", "extensions"],
    ),
    WorkspaceApp(
        id="monitor",
        name="System",
        description="Runtime: services, CPU, RAM, latency",
        icon="📊",
        route="/monitor",
        category=AppCategory.SYSTEM,
        order=80,
        hotkey="8",
        tags=["system", "runtime"],
    ),
    WorkspaceApp(
        id="api",
        name="API Explorer",
        description="Live API reference: test endpoints",
        icon="📡",
        route="/api",
        category=AppCategory.SYSTEM,
        order=90,
        hotkey="9",
        tags=["api", "developer"],
    ),
    WorkspaceApp(
        id="settings",
        name="Settings",
        description="Platform configuration",
        icon="⚙️",
        route="/settings",
        category=AppCategory.SYSTEM,
        order=100,
        hotkey="0",
        tags=["config"],
    ),
]


def get_apps() -> list[WorkspaceApp]:
    return sorted(_APPS, key=lambda a: a.order)


def get_app(app_id: str) -> WorkspaceApp | None:
    for a in _APPS:
        if a.id == app_id:
            return a
    return None


def get_apps_by_category() -> dict[str, list[WorkspaceApp]]:
    cats: dict[str, list[WorkspaceApp]] = {}
    for a in get_apps():
        cats.setdefault(a.category.value, []).append(a)
    return cats


def get_tags() -> list[str]:
    tags: set[str] = set()
    for a in _APPS:
        tags.update(a.tags)
    return sorted(tags)
