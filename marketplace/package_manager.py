"""
Marketplace Platform — Package Manager.

CLI and programmatic interface for package lifecycle:
install, update, remove, list, search, info.
"""

from __future__ import annotations

import json
import logging
import os
import shutil
import time
from typing import Any

from marketplace.models import (
    Package,
    PackageVersion,
    InstallRecord,
    UpdateChannel,
    TrustLevel,
    INSTALL_EVENT,
    UPDATE_EVENT,
    REMOVE_EVENT,
)
from marketplace.registry import RegistryClient
from marketplace.trust import TrustSystem

logger = logging.getLogger(__name__)


class PackageManager:
    """Full package lifecycle manager — install, update, remove, list, search."""

    def __init__(self,
                 plugins_dir: str = "",
                 registry: RegistryClient | None = None,
                 trust: TrustSystem | None = None) -> None:
        self.plugins_dir = plugins_dir or os.path.join(os.getcwd(), "plugins")
        self.registry = registry or RegistryClient()
        self.trust = trust or TrustSystem()
        self._installed: dict[str, dict] = {}  # {name: {version, channel, installed_at}}
        self._load_installed()

    # ── Core Operations ────────────────────────────────────────

    def install(self, name: str, version: str | None = None,
                channel: str = "stable") -> dict:
        """Install a package from the marketplace."""
        pkg = self.registry.get_package(name)
        if not pkg:
            return {"success": False, "error": f"Package '{name}' not found"}

        ver = version or pkg.latest_version
        if not ver or ver not in pkg.versions:
            return {"success": False, "error": f"Version '{ver}' not found for {name}"}

        pv = pkg.versions[ver]

        # Check trust
        trust_info = TrustSystem().get_trust_display(pkg.trust_level)
        if pkg.trust_level == TrustLevel.UNSAFE:
            return {"success": False, "error": f"Package {name} is marked as UNSAFE"}

        # Simulate install
        install_path = os.path.join(self.plugins_dir, name)
        os.makedirs(install_path, exist_ok=True)

        # Write metadata
        meta = {
            'name': name,
            'version': ver,
            'channel': channel,
            'installed_at': __import__('time').time(),
            'trust_level': pkg.trust_level.value,
        }
        with open(os.path.join(install_path, '.marketplace.json'), 'w') as f:
            import json
            json.dump(meta, f, indent=2)

        self._installed[name] = {
            'version': ver,
            'channel': channel,
            'installed_at': meta['installed_at'],
        }

        logger.info("Installed %s@%s (trust: %s)", name, ver, pkg.trust_level.value)
        return {
            "success": True,
            "package": name,
            "version": ver,
            "trust_level": pkg.trust_level.value,
            "path": install_path,
        }

    def update(self, name: str, channel: str | None = None) -> dict:
        """Update a package to the latest version."""
        if name not in self._installed:
            return {"success": False, "error": f"Package '{name}' not installed"}

        pkg = self._get_registry_package(name)
        if not pkg:
            return {"success": False, "error": f"Package '{name}' not found in registry"}

        current = self._installed[name]
        target_channel = channel or current.get('channel', 'stable')

        # Find latest version in the target channel
        latest_ver = None
        for ver, pv in pkg.versions.items():
            if pv.channel.value == target_channel:
                if latest_ver is None or self._compare_versions(ver, latest_ver) > 0:
                    latest_ver = ver

        if not latest_ver:
            return {"success": False, "error": f"No version found for channel '{target_channel}'"}

        if latest_ver == current.get('version'):
            return {"success": True, "message": f"{name} is already up-to-date ({latest_ver})"}

        # Perform update
        result = self.install(name, latest_ver, target_channel)
        if result.get('success'):
            result['updated_from'] = current.get('version')
        return result

    def remove(self, name: str) -> dict:
        """Remove an installed package."""
        if name not in self._installed:
            return {"success": False, "error": f"Package '{name}' not installed"}

        install_path = os.path.join(self.plugins_dir, name)
        if os.path.isdir(install_path):
            shutil.rmtree(install_path)

        del self._installed[name]
        logger.info("Removed package: %s", name)
        return {"success": True, "package": name}

    def list_installed(self) -> list[dict]:
        """List all installed packages."""
        return [
            {
                'name': name,
                'version': info.get('version', '?'),
                'channel': info.get('channel', 'stable'),
                'installed_at': info.get('installed_at', 0),
            }
            for name, info in self._installed.items()
        ]

    def search(self, query: str) -> list[dict]:
        """Search the marketplace for packages."""
        results = self.registry.search_remote(query)
        return [
            {
                'name': p.name,
                'display_name': p.display_name,
                'description': p.description,
                'package_type': p.package_type,
                'author': p.author,
                'trust_level': p.trust_level.value,
                'latest_version': p.latest_version,
                'install_count': p.install_count,
                'rating': p.community.rating if p.community else 0,
                'installed': p.name in self._installed,
            }
            for p in results
        ]

    def info(self, name: str) -> dict | None:
        """Get detailed info about a package."""
        pkg = self.registry.get_package(name)
        if not pkg:
            return None

        installed = self._installed.get(name, {})
        return {
            'name': pkg.name,
            'display_name': pkg.display_name,
            'description': pkg.description,
            'package_type': pkg.package_type,
            'author': pkg.author,
            'license': pkg.license,
            'tags': pkg.tags,
            'categories': pkg.categories,
            'trust_level': pkg.trust_level.value,
            'latest_version': pkg.latest_version,
            'installed_version': installed.get('version'),
            'install_count': pkg.install_count,
            'rating': pkg.community.rating if pkg.community else 0,
            'rating_count': pkg.community.rating_count if pkg.community else 0,
            'versions': list(pkg.versions.keys()),
        }

    # ── Internal ──────────────────────────────────────────────

    def _get_registry_package(self, name: str) -> Package | None:
        """Fetch a package from the registry."""
        return self.registry.get_package(name)

    @staticmethod
    def _compare_versions(a: str, b: str) -> int:
        """Compare two SemVer strings. Returns -1, 0, or 1."""
        try:
            va = [int(x) for x in a.split('.')]
            vb = [int(x) for x in b.split('.')]
            # Pad to same length
            while len(va) < 3:
                va.append(0)
            while len(vb) < 3:
                vb.append(0)
            if va > vb:
                return 1
            if va < vb:
                return -1
            return 0
        except (ValueError, AttributeError):
            return 0

    def _load_installed(self) -> None:
        """Scan plugins directory for installed packages."""
        self._installed = {}
        if not os.path.isdir(self.plugins_dir):
            return
        for entry in os.listdir(self.plugins_dir):
            meta_path = os.path.join(self.plugins_dir, entry, '.marketplace.json')
            if os.path.isfile(meta_path):
                try:
                    import json
                    with open(meta_path) as f:
                        meta = json.load(f)
                    self._installed[entry] = meta
                except Exception:
                    pass
