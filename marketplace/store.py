"""
Marketplace Platform — Integration with Workspace.

Extends the existing Plugin Store app with marketplace browsing,
install/remove from UI, passport display, and benchmarks.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from marketplace.package_manager import PackageManager
from marketplace.registry import RegistryClient
from marketplace.passport import PassportBuilder
from marketplace.benchmark import BenchmarkRepository
from marketplace.compatibility import CompatibilityChecker
from marketplace.channels import ChannelManager
from marketplace.trust import TrustSystem

logger = logging.getLogger(__name__)


def create_marketplace_api() -> dict[str, Any]:
    """Create API handlers for the workspace Plugin Store app.

    Returns dict of {endpoint_name: handler_function}
    for registration in workspace.main.py.
    """
    pm = PackageManager()
    registry = RegistryClient()
    passport = PassportBuilder()
    benchmark = BenchmarkRepository()
    compatibility = CompatibilityChecker()
    channels = ChannelManager()
    trust = TrustSystem()

    def get_trending(limit: int = 6) -> list[dict]:
        """Get trending packages for the store front page."""
        pkgs = registry.get_trending(limit)
        return [_pkg_summary(p) for p in pkgs]

    def get_all_categories() -> list[dict]:
        """Get all package categories with counts."""
        idx = registry.fetch_index()
        categories: dict[str, int] = {}
        for pkg in idx.packages.values():
            for cat in pkg.categories:
                categories[cat] = categories.get(cat, 0) + 1
        return sorted(
            [{'name': k, 'count': v} for k, v in categories.items()],
            key=lambda c: -c['count'],
        )

    def get_by_category(category: str) -> list[dict]:
        """Get packages in a category."""
        pkgs = registry.get_by_category(category)
        return [_pkg_summary(p) for p in pkgs]

    def get_package_detail(name: str) -> dict | str:
        """Get full package detail including passport and benchmarks."""
        pkg = registry.get_package(name)
        if not pkg:
            return {"error": "not found"}

        detail = {
            'name': pkg.name,
            'display_name': pkg.display_name,
            'description': pkg.description,
            'package_type': pkg.package_type,
            'author': pkg.author,
            'license': pkg.license,
            'tags': pkg.tags,
            'categories': pkg.categories,
            'icon': pkg.icon,
            'trust': TrustSystem().get_trust_display(pkg.trust_level),
            'latest_version': pkg.latest_version,
            'versions': list(pkg.versions.keys()),
            'community': pkg.community.to_dict() if pkg.community else None,
            'channels': ChannelManager().get_channel_versions(pkg),
        }

        # Add passport if available
        if pkg.passport:
            detail['passport'] = pkg.passport.to_dict()

        # Add benchmarks
        benchmarks_list = benchmark.get_for_strategy(name)
        detail['benchmarks'] = [b.to_dict() for b in benchmarks_list]

        # Add compatibility
        detail['compatibility'] = compatibility.check_package(pkg).to_dict()

        # Installed status
        installed = pm.list_installed()
        detail['installed'] = any(i['name'] == name for i in installed)

        return detail

    def install_package(name: str, version: str | None = None) -> dict:
        """Install a package via the package manager."""
        return pm.install(name, version)

    def remove_package(name: str) -> dict:
        """Remove an installed package."""
        return pm.remove(name)

    def list_installed() -> list[dict]:
        """List installed packages with marketplace info."""
        installed = pm.list_installed()
        enriched = []
        for item in installed:
            info = pm.info(item['name'])
            if info:
                item.update({
                    'trust_level': info.get('trust_level', 'community'),
                    'display_name': info.get('display_name', item['name']),
                    'description': info.get('description', ''),
                })
            enriched.append(item)
        return enriched

    def compare_strategies(name_a: str, name_b: str) -> dict:
        """Compare two strategies."""
        return benchmark.compare(name_a, name_b)

    return {
        'get_trending': get_trending,
        'get_all_categories': get_all_categories,
        'get_by_category': get_by_category,
        'get_package_detail': get_package_detail,
        'install_package': install_package,
        'remove_package': remove_package,
        'list_installed': list_installed,
        'compare_strategies': compare_strategies,
    }


def _pkg_summary(pkg) -> dict:
    """Create a summary dict for a package."""
    return {
        'name': pkg.name,
        'display_name': pkg.display_name,
        'description': pkg.description[:120] + '...' if len(pkg.description) > 120 else pkg.description,
        'package_type': pkg.package_type,
        'author': pkg.author,
        'icon': pkg.icon,
        'trust_level': pkg.trust_level.value,
        'latest_version': pkg.latest_version,
        'rating': pkg.community.rating if pkg.community else 0,
        'rating_count': pkg.community.rating_count if pkg.community else 0,
        'install_count': pkg.install_count,
        'stars_display': pkg.community.stars_display() if pkg.community else '',
    }
