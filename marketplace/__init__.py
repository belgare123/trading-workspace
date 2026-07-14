"""Marketplace Platform — Phase 15.

Full ecosystem for trading strategies: registry, package manager,
dependency resolution, trust system, passports, benchmarks, community.
"""

from marketplace.models import (
    Package,
    PackageVersion,
    PackageIndex,
    TrustLevel,
    SignatureInfo,
    StrategyPassport,
    BenchmarkResult,
    CompatibilityReport,
    UpdateChannel,
    CommunityStats,
    InstallRecord,
)
from marketplace.registry import RegistryClient, RegistryServer, PackageIndexBuilder
from marketplace.package_manager import PackageManager
from marketplace.dependency import MarketplaceDependencyResolver
from marketplace.trust import TrustSystem, SignatureVerifier
from marketplace.passport import PassportBuilder
from marketplace.benchmark import BenchmarkRepository
from marketplace.compatibility import CompatibilityChecker
from marketplace.channels import ChannelManager

__all__ = [
    # Models
    "Package",
    "PackageVersion",
    "PackageIndex",
    "TrustLevel",
    "SignatureInfo",
    "StrategyPassport",
    "BenchmarkResult",
    "CompatibilityReport",
    "UpdateChannel",
    "CommunityStats",
    "InstallRecord",
    # Registry
    "RegistryClient",
    "RegistryServer",
    "PackageIndexBuilder",
    # Package Manager
    "PackageManager",
    "MarketplaceDependencyResolver",
    # Trust
    "TrustSystem",
    "SignatureVerifier",
    # Passport
    "PassportBuilder",
    # Benchmark
    "BenchmarkRepository",
    # Compatibility
    "CompatibilityChecker",
    # Channels
    "ChannelManager",
]
