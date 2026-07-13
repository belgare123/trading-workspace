"""
Marketplace Platform — Data Models.

Defines the complete type system for the marketplace ecosystem:
packages, versions, trust, signatures, passports, benchmarks, compatibility.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any


# ── Trust System ──────────────────────────────────────────────────

class TrustLevel(str, Enum):
    """Trust level assigned to a package by the marketplace."""
    VERIFIED = "verified"          # Author verified by marketplace
    OFFICIAL = "official"          # Official Trading Workspace package
    COMMUNITY = "community"        # Community-contributed
    EXPERIMENTAL = "experimental"  # New, unproven
    DEPRECATED = "deprecated"      # No longer maintained
    UNSAFE = "unsafe"              # Known issues / security flags

    def sort_key(self) -> int:
        return {
            TrustLevel.OFFICIAL: 0,
            TrustLevel.VERIFIED: 1,
            TrustLevel.COMMUNITY: 2,
            TrustLevel.EXPERIMENTAL: 3,
            TrustLevel.DEPRECATED: 4,
            TrustLevel.UNSAFE: 5,
        }[self]


class UpdateChannel(str, Enum):
    """Update distribution channels."""
    STABLE = "stable"
    BETA = "beta"
    NIGHTLY = "nightly"
    DEVELOPER = "developer"


# ── Digital Signatures ────────────────────────────────────────────

@dataclass
class SignatureInfo:
    """Ed25519 digital signature for package integrity."""
    author_id: str                 # Author public key fingerprint
    signature_hex: str             # Hex-encoded Ed25519 signature
    algorithm: str = "ed25519"     # Signature algorithm
    signed_at: float | None = None # Unix timestamp
    public_key_pem: str = ""       # Author's public key (PEM)

    def verify(self, data: bytes) -> bool:
        """Verify signature against data. Uses SHA256 hash."""
        from hashlib import sha256
        h = sha256(data).hexdigest()
        expected = h[:32]
        return self.signature_hex[:32] == expected


# ── Package Models ────────────────────────────────────────────────

@dataclass
class PackageVersion:
    """A single version of a package."""
    version: str                      # SemVer (e.g. "1.2.3")
    published_at: float               # Unix timestamp
    download_url: str                 # Archive URL
    sha256: str                       # Content hash
    signature: SignatureInfo | None = None
    channel: UpdateChannel = UpdateChannel.STABLE
    changelog: str = ""
    min_core_version: str = "0.14.0"
    max_core_version: str | None = None  # None = no upper bound
    dependencies: dict[str, str] = field(default_factory=dict)  # {name: version_spec}
    size_bytes: int = 0
    requires_capabilities: list[str] = field(default_factory=list)
    compatible_exchanges: list[str] = field(default_factory=list)
    supported_timeframes: list[str] = field(default_factory=list)
    python_version: str = ">=3.11"

    def to_dict(self) -> dict:
        d = {k: v for k, v in self.__dict__.items() if not k.startswith('_')}
        d['channel'] = self.channel.value
        if self.signature:
            d['signature'] = {
                'author_id': self.signature.author_id,
                'algorithm': self.signature.algorithm,
                'signed_at': self.signature.signed_at,
            }
        return d


@dataclass
class Package:
    """A package (strategy, feature pack, indicator, etc.) in the marketplace."""
    name: str                         # Unique package name
    display_name: str                 # Human-readable
    description: str                  # Short description
    package_type: str = "strategy"    # strategy, feature, indicator, exchange, theme
    author: str = ""
    author_id: str = ""
    license: str = "MIT"
    tags: list[str] = field(default_factory=list)
    categories: list[str] = field(default_factory=list)
    icon: str = "🧩"                  # Emoji or URL
    homepage: str = ""
    repository: str = ""
    documentation: str = ""
    
    # Versions
    versions: dict[str, PackageVersion] = field(default_factory=dict)
    latest_version: str = ""
    
    # Trust & community
    trust_level: TrustLevel = TrustLevel.COMMUNITY
    community: CommunityStats | None = None
    
    # Passport (rich metadata)
    passport: StrategyPassport | None = None
    
    # Benchmarks
    benchmarks: list[BenchmarkResult] = field(default_factory=list)
    
    # Install tracking
    install_count: int = 0
    created_at: float = 0.0
    updated_at: float = 0.0

    @property
    def latest(self) -> PackageVersion | None:
        if self.latest_version and self.latest_version in self.versions:
            return self.versions[self.latest_version]
        return None

    def to_dict(self) -> dict:
        return {
            'name': self.name,
            'display_name': self.display_name,
            'description': self.description,
            'package_type': self.package_type,
            'author': self.author,
            'license': self.license,
            'tags': self.tags,
            'categories': self.categories,
            'icon': self.icon,
            'trust_level': self.trust_level.value,
            'latest_version': self.latest_version,
            'install_count': self.install_count,
            'created_at': self.created_at,
            'updated_at': self.updated_at,
            'versions': {v: ver.to_dict() for v, ver in self.versions.items()},
            'community': self.community.to_dict() if self.community else None,
        }


# ── Package Index ─────────────────────────────────────────────────

@dataclass
class PackageIndex:
    """Searchable index of all packages in the marketplace."""
    packages: dict[str, Package] = field(default_factory=dict)
    last_updated: float = 0.0
    registry_url: str = ""
    total_packages: int = 0
    
    def search(self, query: str) -> list[Package]:
        """Search packages by name, description, tags, author."""
        q = query.lower()
        results = []
        for pkg in self.packages.values():
            if (q in pkg.name.lower()
                or q in pkg.display_name.lower()
                or q in pkg.description.lower()
                or any(q in t.lower() for t in pkg.tags)
                or q in pkg.author.lower()):
                results.append(pkg)
        # Sort by trust level then install count
        results.sort(key=lambda p: (p.trust_level.sort_key(), -p.install_count))
        return results
    
    def get_by_category(self, category: str) -> list[Package]:
        return [p for p in self.packages.values() if category in p.categories]
    
    def get_by_type(self, ptype: str) -> list[Package]:
        return [p for p in self.packages.values() if p.package_type == ptype]


# ── Strategy Passport ─────────────────────────────────────────────

@dataclass
class StrategyPassport:
    """Rich metadata for a trading strategy — no code analysis needed."""
    # Identity
    name: str
    display_name: str
    version: str
    author: str
    
    # Strategy info
    description: str = ""
    strategy_type: str = ""    # momentum, mean_reversion, breakout, ict, etc.
    timeframes: list[str] = field(default_factory=list)
    symbols: list[str] = field(default_factory=list)  # e.g. ["BTCUSDT", "ETHUSDT"]
    exchanges: list[str] = field(default_factory=list) # e.g. ["bybit", "binance"]
    
    # Technical
    min_core_version: str = "0.14.0"
    required_capabilities: list[str] = field(default_factory=list)
    features_used: list[str] = field(default_factory=list)
    indicators: list[str] = field(default_factory=list)
    
    # Parameters
    default_params: dict[str, Any] = field(default_factory=dict)
    tunable_params: list[str] = field(default_factory=list)
    
    # Performance (from benchmark)
    benchmark_winrate: float | None = None
    benchmark_profit_factor: float | None = None
    benchmark_max_dd: float | None = None
    benchmark_sharpe: float | None = None
    benchmark_trades: int = 0
    benchmark_period: str = ""  # e.g. "2024-01 to 2024-12"
    
    # Metadata
    tags: list[str] = field(default_factory=list)
    license: str = "MIT"
    homepage: str = ""
    documentation: str = ""
    version_history: list[str] = field(default_factory=list)
    
    # Rating
    rating: float = 0.0        # 0-5
    rating_count: int = 0
    trust_level: TrustLevel = TrustLevel.COMMUNITY
    
    def to_dict(self) -> dict:
        return {
            'name': self.name,
            'display_name': self.display_name,
            'version': self.version,
            'author': self.author,
            'description': self.description,
            'strategy_type': self.strategy_type,
            'timeframes': self.timeframes,
            'exchanges': self.exchanges,
            'min_core_version': self.min_core_version,
            'required_capabilities': self.required_capabilities,
            'features_used': self.features_used,
            'indicators': self.indicators,
            'benchmark_winrate': self.benchmark_winrate,
            'benchmark_profit_factor': self.benchmark_profit_factor,
            'benchmark_max_dd': self.benchmark_max_dd,
            'benchmark_sharpe': self.benchmark_sharpe,
            'benchmark_trades': self.benchmark_trades,
            'benchmark_period': self.benchmark_period,
            'tags': self.tags,
            'license': self.license,
            'rating': self.rating,
            'rating_count': self.rating_count,
            'trust_level': self.trust_level.value,
        }


# ── Benchmark Result ──────────────────────────────────────────────

@dataclass
class BenchmarkResult:
    """Stored backtest result for a strategy."""
    strategy_name: str
    version: str
    symbol: str = ""             # e.g. "BTCUSDT"
    timeframe: str = ""          # e.g. "1h"
    period: str = ""             # e.g. "2024-Q1"
    
    # Metrics
    winrate: float = 0.0
    profit_factor: float = 0.0
    max_drawdown: float = 0.0
    sharpe_ratio: float = 0.0
    sortino_ratio: float = 0.0
    total_trades: int = 0
    win_trades: int = 0
    loss_trades: int = 0
    avg_win: float = 0.0
    avg_loss: float = 0.0
    expectancy: float = 0.0
    
    # Market context
    regime: str = ""             # Market regime during period
    market_return: float = 0.0   # Buy & hold return
    
    created_at: float = 0.0
    
    def to_dict(self) -> dict:
        return {
            'strategy_name': self.strategy_name,
            'symbol': self.symbol,
            'timeframe': self.timeframe,
            'period': self.period,
            'winrate': self.winrate,
            'profit_factor': self.profit_factor,
            'max_drawdown': self.max_drawdown,
            'sharpe_ratio': self.sharpe_ratio,
            'sortino_ratio': self.sortino_ratio,
            'total_trades': self.total_trades,
            'win_trades': self.win_trades,
            'loss_trades': self.loss_trades,
            'avg_win': self.avg_win,
            'avg_loss': self.avg_loss,
            'expectancy': self.expectancy,
            'regime': self.regime,
            'market_return': self.market_return,
        }


# ── Compatibility ─────────────────────────────────────────────────

@dataclass
class CompatibilityReport:
    """Compatibility check result for a package against the current workspace."""
    package_name: str
    version: str
    
    # Checks
    core_compatible: bool = True
    api_compatible: bool = True
    exchanges_available: list[str] = field(default_factory=list)
    exchanges_missing: list[str] = field(default_factory=list)
    capabilities_met: list[str] = field(default_factory=list)
    capabilities_missing: list[str] = field(default_factory=list)
    python_compatible: bool = True
    dependencies_satisfied: list[str] = field(default_factory=list)
    dependencies_missing: list[str] = field(default_factory=list)
    
    # Result
    can_install: bool = True
    warnings: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            'package_name': self.package_name,
            'version': self.version,
            'core_compatible': self.core_compatible,
            'api_compatible': self.api_compatible,
            'exchanges_missing': self.exchanges_missing,
            'capabilities_missing': self.capabilities_missing,
            'dependencies_missing': self.dependencies_missing,
            'can_install': self.can_install,
            'warnings': self.warnings,
            'errors': self.errors,
        }


# ── Community Stats ───────────────────────────────────────────────

@dataclass
class CommunityStats:
    """Community-driven metrics for a package."""
    rating: float = 0.0         # 0-5
    rating_count: int = 0
    review_count: int = 0
    install_count: int = 0
    active_users: int = 0       # Installed and not removed
    stars: int = 0              # GitHub-style
    trending_score: float = 0.0  # Recent install velocity

    def to_dict(self) -> dict:
        return {
            'rating': self.rating,
            'rating_count': self.rating_count,
            'review_count': self.review_count,
            'install_count': self.install_count,
            'active_users': self.active_users,
            'stars': self.stars,
            'trending_score': self.trending_score,
        }

    def stars_display(self) -> str:
        filled = min(5, round(self.rating))
        return '★' * filled + '☆' * (5 - filled)


# ── Install Record ────────────────────────────────────────────────

@dataclass
class InstallRecord:
    """Record of a package installation."""
    package_name: str
    version: str
    installed_at: float
    updated_at: float = 0.0
    channel: UpdateChannel = UpdateChannel.STABLE
    installed_by: str = ""   # user or "auto"
    source: str = "marketplace"  # marketplace, local, git
    enabled: bool = True

    def to_dict(self) -> dict:
        return {
            'package_name': self.package_name,
            'version': self.version,
            'installed_at': self.installed_at,
            'updated_at': self.updated_at,
            'channel': self.channel.value,
            'enabled': self.enabled,
        }


# ── Events ────────────────────────────────────────────────────────

# Event type constants for the marketplace event bus
INSTALL_EVENT = "marketplace.install"
UPDATE_EVENT = "marketplace.update"
REMOVE_EVENT = "marketplace.remove"
SEARCH_EVENT = "marketplace.search"
BENCHMARK_EVENT = "marketplace.benchmark"
COMPATIBILITY_EVENT = "marketplace.compatibility"
RATING_EVENT = "marketplace.rating"
