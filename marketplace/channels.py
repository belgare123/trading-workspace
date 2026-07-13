"""
Marketplace Platform — Update Channels.

Manage update distribution channels: stable, beta, nightly, developer.
"""

from __future__ import annotations

import logging
from typing import Any

from marketplace.models import Package, PackageVersion, UpdateChannel

logger = logging.getLogger(__name__)


class ChannelManager:
    """Manages update channels for packages."""

    CHANNEL_PRIORITY = {
        UpdateChannel.STABLE: 0,
        UpdateChannel.BETA: 1,
        UpdateChannel.NIGHTLY: 2,
        UpdateChannel.DEVELOPER: 3,
    }

    def __init__(self) -> None:
        self._release_notes: dict[str, str] = {}

    def get_channel_versions(self, package: Package) -> dict[str, list[str]]:
        """Get versions grouped by channel."""
        channels: dict[str, list[str]] = {c.value: [] for c in UpdateChannel}
        for ver_str, pv in package.versions.items():
            channel_name = pv.channel.value
            if channel_name in channels:
                channels[channel_name].append(ver_str)
        for ch in channels:
            channels[ch].sort(key=lambda v: [int(x) if x.isdigit() else 0 for x in v.replace('-', '.').split('.')], reverse=True)
        return channels

    def suggest_channel(self, package: Package, current_channel: str = "stable") -> str | None:
        """Suggest an upgrade channel if available."""
        channels = self.get_channel_versions(package)
        current_priority = self.CHANNEL_PRIORITY.get(
            UpdateChannel(current_channel), 0
        )

        best_channel = None
        best_priority = current_priority

        for ch_name, versions in channels.items():
            if versions:  # Has versions in this channel
                ch_priority = self.CHANNEL_PRIORITY.get(UpdateChannel(ch_name), 0)
                if ch_priority > best_priority:
                    best_priority = ch_priority
                    best_channel = ch_name

        return best_channel

    def get_latest_for_channel(self, package: Package, channel: str = "stable") -> PackageVersion | None:
        """Get the latest version in a specific channel."""
        ch = UpdateChannel(channel) if isinstance(channel, str) else channel
        candidates = [
            pv for pv in package.versions.values()
            if pv.channel == ch
        ]
        if not candidates:
            return None
        candidates.sort(key=lambda pv: [int(x) for x in pv.version.split('.')], reverse=True)
        return candidates[0]

    def set_release_notes(self, package_name: str, version: str, notes: str) -> None:
        """Store release notes for a version."""
        key = f"{package_name}@{version}"
        self._release_notes[key] = notes
        logger.info("Release notes set for %s", key)

    def get_release_notes(self, package_name: str, version: str) -> str:
        """Get release notes for a version."""
        key = f"{package_name}@{version}"
        return self._release_notes.get(key, "")

    def all_channels(self) -> list[dict]:
        """Get info about all available channels."""
        return [
            {
                'name': ch.value,
                'display': ch.value.capitalize(),
                'description': desc,
                'priority': self.CHANNEL_PRIORITY[ch],
            }
            for ch, desc in [
                (UpdateChannel.STABLE, "Production-ready releases"),
                (UpdateChannel.BETA, "Pre-release testing"),
                (UpdateChannel.NIGHTLY, "Daily builds, may be unstable"),
                (UpdateChannel.DEVELOPER, "Latest development code"),
            ]
        ]
