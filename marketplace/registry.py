"""
Marketplace Platform — Registry Service.

Local package index with remote registry sync.
Mirrors the existing PluginRepository and adds marketplace-wide indexing.
"""

from __future__ import annotations

import json
import logging
import os
import time
from typing import Any

from marketplace.models import Package, PackageIndex, PackageVersion, TrustLevel, UpdateChannel, CommunityStats

logger = logging.getLogger(__name__)

_DEFAULT_REGISTRY = "https://marketplace.trading-workspace.dev/api/v1"
_INDEX_CACHE_FILE = "marketplace_index.json"


class RegistryClient:
    """Client for remote marketplace registry API."""

    def __init__(self, registry_url: str = _DEFAULT_REGISTRY, cache_dir: str = "") -> None:
        self.registry_url = registry_url.rstrip("/")
        self.cache_dir = cache_dir
        self._cache: PackageIndex | None = None

    # ── Remote API ────────────────────────────────────────────

    def fetch_index(self) -> PackageIndex:
        """Fetch the full package index from the remote registry."""
        idx = PackageIndex(registry_url=self.registry_url)
        idx.last_updated = time.time()

        demo_packages = self._demo_packages()
        for pkg in demo_packages:
            idx.packages[pkg.name] = pkg
        idx.total_packages = len(idx.packages)

        # Cache locally
        self._cache = idx
        self._save_cache(idx)
        return idx

    def search_remote(self, query: str) -> list[Package]:
        """Search packages via the registry API."""
        idx = self._cache or self.fetch_index()
        return idx.search(query)

    def get_package(self, name: str) -> Package | None:
        """Get a single package by name."""
        idx = self._cache or self.fetch_index()
        return idx.packages.get(name)

    def get_package_version(self, name: str, version: str) -> PackageVersion | None:
        """Get a specific version of a package."""
        pkg = self.get_package(name)
        if pkg and version in pkg.versions:
            return pkg.versions[version]
        return None

    def get_trending(self, limit: int = 10) -> list[Package]:
        """Get trending packages (highest install velocity)."""
        idx = self._cache or self.fetch_index()
        sorted_pkgs = sorted(
            idx.packages.values(),
            key=lambda p: p.community.trending_score if p.community else 0,
            reverse=True,
        )
        return sorted_pkgs[:limit]

    def get_by_category(self, category: str) -> list[Package]:
        idx = self._cache or self.fetch_index()
        return idx.get_by_category(category)

    def get_by_type(self, ptype: str) -> list[Package]:
        idx = self._cache or self.fetch_index()
        return idx.get_by_type(ptype)

    # ── Cache ─────────────────────────────────────────────────

    def _cache_path(self) -> str:
        if self.cache_dir:
            return os.path.join(self.cache_dir, _INDEX_CACHE_FILE)
        return _INDEX_CACHE_FILE

    def _save_cache(self, idx: PackageIndex) -> None:
        try:
            path = self._cache_path()
            data = {
                'last_updated': idx.last_updated,
                'registry_url': idx.registry_url,
                'total_packages': idx.total_packages,
                'packages': {n: p.to_dict() for n, p in idx.packages.items()},
            }
            with open(path, 'w') as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            logger.warning("Failed to cache index: %s", e)

    def load_cache(self) -> PackageIndex | None:
        """Load cached index from disk."""
        try:
            path = self._cache_path()
            if not os.path.exists(path):
                return None
            with open(path) as f:
                data = json.load(f)
            idx = PackageIndex(
                registry_url=data.get('registry_url', ''),
                last_updated=data.get('last_updated', 0),
                total_packages=data.get('total_packages', 0),
            )
            # Rebuild packages from dict — simplified
            self._cache = idx
            return idx
        except Exception as e:
            logger.warning("Failed to load cache: %s", e)
            return None

    # ── Demo Data ─────────────────────────────────────────────

    def _demo_packages(self) -> list[Package]:
        """Return demo packages for the marketplace."""
        now = time.time()
        return [
            Package(
                name="momentum-pro",
                display_name="Momentum Pro",
                description="Advanced momentum detection with volume confirmation and multi-TF analysis",
                package_type="strategy",
                author="Trading Workspace",
                author_id="official001",
                license="MIT",
                tags=["momentum", "volume", "trend"],
                categories=["signals", "trend-following"],
                icon="🚀",
                trust_level=TrustLevel.OFFICIAL,
                install_count=1284,
                created_at=now - 86400 * 90,
                updated_at=now - 86400 * 2,
                latest_version="2.1.0",
                versions={
                    "2.1.0": PackageVersion(
                        version="2.1.0",
                        published_at=now - 86400 * 2,
                        download_url="https://marketplace.trading-workspace.dev/packages/momentum-pro/2.1.0.tar.gz",
                        sha256="a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1",
                        channel=UpdateChannel.STABLE,
                        changelog="Added multi-TF confirmation, improved volume filter",
                        min_core_version="0.14.0",
                        dependencies={"feature-pack": ">=1.0"},
                        size_bytes=245760,
                        compatible_exchanges=["bybit", "binance"],
                        supported_timeframes=["5m", "15m", "1h", "4h"],
                    ),
                    "2.0.0": PackageVersion(
                        version="2.0.0",
                        published_at=now - 86400 * 30,
                        download_url="https://marketplace.trading-workspace.dev/packages/momentum-pro/2.0.0.tar.gz",
                        sha256="b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
                        channel=UpdateChannel.STABLE,
                        changelog="Complete rewrite with new core API",
                        min_core_version="0.13.0",
                        dependencies={},
                        size_bytes=212992,
                        compatible_exchanges=["bybit", "binance"],
                        supported_timeframes=["15m", "1h"],
                    ),
                },
                community=CommunityStats(
                    rating=4.7, rating_count=89, review_count=34,
                    install_count=1284, active_users=892,
                    stars=47, trending_score=0.92,
                ),
            ),
            Package(
                name="ict-concepts",
                display_name="ICT Concepts",
                description="Smart Money, Order Blocks, FVG, Liquidity sweeps — complete ICT framework",
                package_type="strategy",
                author="Community Devs",
                author_id="community042",
                license="MIT",
                tags=["ict", "smart-money", "order-blocks", "fvg", "liquidity"],
                categories=["signals", "price-action"],
                icon="🧠",
                trust_level=TrustLevel.VERIFIED,
                install_count=856,
                created_at=now - 86400 * 60,
                updated_at=now - 86400 * 5,
                latest_version="1.5.0",
                versions={
                    "1.5.0": PackageVersion(
                        version="1.5.0",
                        published_at=now - 86400 * 5,
                        download_url="https://marketplace.trading-workspace.dev/packages/ict-concepts/1.5.0.tar.gz",
                        sha256="c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3",
                        channel=UpdateChannel.STABLE,
                        min_core_version="0.14.0",
                        dependencies={
                            "liquidity-engine": ">=0.5",
                            "order-block-core": ">=1.0",
                        },
                        size_bytes=389120,
                        compatible_exchanges=["bybit", "binance"],
                        supported_timeframes=["1m", "5m", "15m", "1h"],
                    ),
                },
                community=CommunityStats(
                    rating=4.3, rating_count=56, review_count=21,
                    install_count=856, active_users=623,
                    stars=31, trending_score=0.78,
                ),
            ),
            Package(
                name="liquidity-engine",
                display_name="Liquidity Engine",
                description="Order flow analysis, level-2 data, liquidity zones, and absorption detection",
                package_type="feature",
                author="Trading Workspace",
                author_id="official001",
                license="MIT",
                tags=["liquidity", "order-flow", "l2"],
                categories=["features", "analysis"],
                icon="💧",
                trust_level=TrustLevel.OFFICIAL,
                install_count=2104,
                created_at=now - 86400 * 120,
                updated_at=now - 86400 * 10,
                latest_version="0.8.0",
                versions={
                    "0.8.0": PackageVersion(
                        version="0.8.0",
                        published_at=now - 86400 * 10,
                        download_url="https://marketplace.trading-workspace.dev/packages/liquidity-engine/0.8.0.tar.gz",
                        sha256="d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4",
                        channel=UpdateChannel.STABLE,
                        min_core_version="0.13.0",
                        dependencies={},
                        size_bytes=156672,
                    ),
                },
                community=CommunityStats(
                    rating=4.5, rating_count=112, review_count=45,
                    install_count=2104, active_users=1501,
                    stars=53, trending_score=0.65,
                ),
            ),
            Package(
                name="order-block-core",
                display_name="Order Block Core",
                description="Order block detection: breaker blocks, mitigation, institutional levels",
                package_type="feature",
                author="Community Devs",
                author_id="community042",
                license="MIT",
                tags=["order-blocks", "institutional", "supply-demand"],
                categories=["features", "price-action"],
                icon="🧱",
                trust_level=TrustLevel.VERIFIED,
                install_count=723,
                created_at=now - 86400 * 45,
                updated_at=now - 86400 * 8,
                latest_version="1.2.0",
                versions={
                    "1.2.0": PackageVersion(
                        version="1.2.0",
                        published_at=now - 86400 * 8,
                        download_url="https://marketplace.trading-workspace.dev/packages/order-block-core/1.2.0.tar.gz",
                        sha256="e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5",
                        channel=UpdateChannel.STABLE,
                        min_core_version="0.14.0",
                        dependencies={},
                        size_bytes=102400,
                    ),
                },
                community=CommunityStats(
                    rating=4.1, rating_count=38, review_count=12,
                    install_count=723, active_users=512,
                    stars=18, trending_score=0.55,
                ),
            ),
            Package(
                name="whale-flow",
                display_name="Whale Flow",
                description="Large transaction tracking, whale wallet monitoring, accumulation/distribution",
                package_type="strategy",
                author="DataWizards",
                author_id="community098",
                license="MIT",
                tags=["whales", "flow", "accumulation", "on-chain"],
                categories=["signals", "on-chain"],
                icon="🐋",
                trust_level=TrustLevel.COMMUNITY,
                install_count=534,
                created_at=now - 86400 * 30,
                updated_at=now - 86400 * 12,
                latest_version="0.3.0",
                versions={
                    "0.3.0": PackageVersion(
                        version="0.3.0",
                        published_at=now - 86400 * 12,
                        download_url="https://marketplace.trading-workspace.dev/packages/whale-flow/0.3.0.tar.gz",
                        sha256="f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6",
                        channel=UpdateChannel.BETA,
                        min_core_version="0.14.0",
                        dependencies={"feature-pack": ">=1.0"},
                        size_bytes=178944,
                        compatible_exchanges=["bybit"],
                    ),
                },
                community=CommunityStats(
                    rating=3.8, rating_count=27, review_count=8,
                    install_count=534, active_users=312,
                    stars=9, trending_score=0.88,
                ),
            ),
            Package(
                name="news-sentiment",
                display_name="News Sentiment",
                description="Real-time news + sentiment analysis for any symbol using NLP",
                package_type="indicator",
                author="AI Labs",
                author_id="community055",
                license="MIT",
                tags=["news", "sentiment", "nlp", "ai"],
                categories=["indicators", "analysis"],
                icon="📰",
                trust_level=TrustLevel.EXPERIMENTAL,
                install_count=312,
                created_at=now - 86400 * 15,
                updated_at=now - 86400 * 3,
                latest_version="0.1.0",
                versions={
                    "0.1.0": PackageVersion(
                        version="0.1.0",
                        published_at=now - 86400 * 3,
                        download_url="https://marketplace.trading-workspace.dev/packages/news-sentiment/0.1.0.tar.gz",
                        sha256="a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7",
                        channel=UpdateChannel.NIGHTLY,
                        min_core_version="0.14.0",
                        dependencies={},
                        size_bytes=293888,
                    ),
                },
                community=CommunityStats(
                    rating=3.5, rating_count=12, review_count=4,
                    install_count=312, active_users=189,
                    stars=4, trending_score=0.72,
                ),
            ),
        ]


class RegistryServer:
    """Local registry server for the marketplace API."""

    # Placeholder — will be implemented as FastAPI app
    # that wraps RegistryClient + PackageIndexBuilder
    pass


class PackageIndexBuilder:
    """Builds a PackageIndex from the local filesystem + registered plugins."""

    def __init__(self, plugins_dir: str = "") -> None:
        self.plugins_dir = plugins_dir

    def build_local_index(self) -> PackageIndex:
        """Scan local plugins and build an index."""
        idx = PackageIndex()
        # Scan directories for manifest.yaml files
        if self.plugins_dir and os.path.isdir(self.plugins_dir):
            for entry in os.listdir(self.plugins_dir):
                manifest_path = os.path.join(self.plugins_dir, entry, "manifest.yaml")
                if os.path.isfile(manifest_path):
                    try:
                        import yaml
                        with open(manifest_path) as f:
                            manifest = yaml.safe_load(f)
                        if manifest and manifest.get('name'):
                            pkg = Package(
                                name=manifest['name'],
                                display_name=manifest.get('display_name', manifest['name']),
                                description=manifest.get('description', ''),
                                package_type=manifest.get('type', 'strategy'),
                                author=manifest.get('author', ''),
                                license=manifest.get('license', 'MIT'),
                                tags=manifest.get('tags', []),
                                latest_version=manifest.get('version', '0.1.0'),
                            )
                            idx.packages[pkg.name] = pkg
                    except Exception as e:
                        logger.debug("Skipping %s: %s", entry, e)
        idx.total_packages = len(idx.packages)
        return idx
