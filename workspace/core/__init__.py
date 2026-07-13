"""
Workspace Core — Data Models.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class AppCategory(str, Enum):
    MARKET = "market"
    SIGNALS = "signals"
    STRATEGIES = "strategies"
    ANALYSIS = "analysis"
    SYSTEM = "system"
    LEARNING = "learning"
    PLUGINS = "plugins"


@dataclass
class WorkspaceApp:
    """Metadata about a workspace application."""
    id: str
    name: str
    description: str
    icon: str  # emoji or icon class
    route: str
    category: AppCategory = AppCategory.MARKET
    badge: int = 0  # notification count
    enabled: bool = True
    order: int = 100  # display order
    tags: list[str] = field(default_factory=list)
    hotkey: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "icon": self.icon,
            "route": self.route,
            "category": self.category.value,
            "badge": self.badge,
            "enabled": self.enabled,
            "order": self.order,
            "tags": self.tags,
            "hotkey": self.hotkey,
        }


@dataclass
class SystemStatus:
    """System runtime status."""
    services: dict[str, str]  # service_name -> status
    cpu_percent: float = 0.0
    memory_mb: float = 0.0
    active_plugins: int = 0
    active_strategies: int = 0
    uptime_hours: float = 0.0
    ws_clients: int = 0
