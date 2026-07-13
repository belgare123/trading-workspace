"""
Strategy Platform — модуль для создания, загрузки и управления стратегиями.

Архитектура строится сверху вниз:
  4.0 — Strategy Lifecycle       — как стратегия живёт
  4.1 — Strategy Descriptor      — имя, версия, capabilities
  4.2 — Signal Model             — что возвращает стратегия
  4.3 — IStrategy + Context      — контракт стратегии
  4.4 — BaseStrategy             — готовая реализация
  4.5 — Strategy Engine          — оркестратор + pipeline
  4.6 — Builtin Strategies       — перенос существующих
"""

from __future__ import annotations

from core.strategy.context import (
    ExchangeAPI,
    FeatureAPI,
    MarketAPI,
    SessionInfo,
    StateAPI,
    StrategyConfig,
    StrategyContext,
)
from core.strategy.dependency import (
    CircularDependencyError,
    DependencyError,
    DependencyGraph,
    DependencyGraphNode,
    DependencyResolver,
    MissingDependencyError,
    ResolveReport,
    VersionMismatchError,
)
from core.strategy.descriptor import (
    # v2 types
    StrategyProfile,
    StrategyStyle,
    HoldingTime,
    SignalFrequency,
    RiskLevel,
    MarketRegime,
    Permission,
    PluginDependency,
    # Core descriptor
    StrategyDescriptor,
    StrategyCategory,
    ManifestError,
    ManifestSchema,
    ManifestLoader,
    Capability,
    capability_by_name,
    register_capability,
    CAP_CANDLES,
    CAP_EMA,
    CAP_RSI,
    CAP_ATR,
    CAP_MACD,
    CAP_BOLLINGER,
    CAP_VOLUME,
    CAP_ORDERBOOK,
    CAP_TRADES,
    CAP_WHALES,
    CAP_SENTIMENT,
    CAP_FUNDING,
    CAP_OI,
    CAP_LIQUIDATIONS,
)
from core.strategy.lifecycle import (
    InvalidTransitionError,
    StatusTransition,
    StrategyState,
)
from core.strategy.base import (
    BaseStrategy,
    StrategyInfo,
    StrategyMetrics,
    StrategyBenchmark,
)
from core.strategy.engine import (
    EngineConfig,
    MockExchangeAPI,
    MockFeatureAPI,
    MockMarketAPI,
    MockStateAPI,
    PluginInfo,
    PluginLoader,
    StrategyEngine,
)
from core.strategy.protocol import IStrategy
from core.strategy.signal import (
    Opportunity,
    PriceTarget,
    RiskAssessment,
    Signal,
    SignalBundle,
    SignalDirection,
)
from core.strategy.config_schema import ConfigSchema, ParamSchema
from core.strategy.certificate import PluginCertificate
from core.strategy.capability_db import CapabilityRegistry, CapabilityCost, CapabilityInfo, DependencyError
from core.strategy.discovery import (
    DiscoveryEngine,
    DiscoverySource,
    DiscoveryError,
    PluginDiscovery,
    SourceType,
)
from core.strategy.plugin_registry import PluginRegistry, PluginRecord, PluginRegistryError
from core.strategy.feature_graph import (
    FeatureConflict,
    FeatureConflictError,
    FeatureDeclaration,
    FeatureGraph,
    FeatureGraphError,
    FeatureMissingError,
    FeatureResolution,
)
from core.strategy.health_monitor import (
    PluginHealth,
    PluginHealthMonitor,
    PluginHealthResult,
    PluginHealthSnapshot,
)
from core.strategy.repository import (
    PluginRepository,
    RepositoryPlugin,
    RepositorySource,
    SourceType,
)
from core.strategy.validator import (
    Severity,
    StrategyValidator,
    ValidationReport,
    ValidationResult,
)
from core.strategy.sandbox import MemoryTracker, SandboxConfig, SandboxContext, SandboxResult, StrategySandbox
from core.strategy.permissions import (
    Permission,
    PermissionPolicy,
    PermissionRule,
    PermissionSet,
    PluginPermissions,
)
from core.strategy.plugin_api import (
    APICallRecord,
    PermissionChecker,
    PluginAPI,
    PluginAPIFactory,
    PluginAPIVersion,
)

__all__ = [
    # Lifecycle
    "StrategyState",
    "StatusTransition",
    "InvalidTransitionError",
    # Descriptor
    "StrategyDescriptor",
    "StrategyCategory",
    "Capability",
    "ManifestLoader",
    "ManifestSchema",
    "ManifestError",
    "capability_by_name",
    "register_capability",
    "CAP_CANDLES",
    "CAP_EMA",
    "CAP_RSI",
    "CAP_ATR",
    "CAP_MACD",
    "CAP_BOLLINGER",
    "CAP_VOLUME",
    "CAP_ORDERBOOK",
    "CAP_TRADES",
    "CAP_WHALES",
    "CAP_SENTIMENT",
    "CAP_FUNDING",
    "CAP_OI",
    "CAP_LIQUIDATIONS",
    # Manifest v2
    "StrategyProfile",
    "StrategyStyle",
    "HoldingTime",
    "SignalFrequency",
    "RiskLevel",
    "MarketRegime",
    "Permission",
    "PluginDependency",
    # Signal
    "SignalDirection",
    "Signal",
    "SignalBundle",
    "Opportunity",
    "PriceTarget",
    "RiskAssessment",
    # IStrategy
    "IStrategy",
    "BaseStrategy",
    "StrategyInfo",
    "StrategyMetrics",
    "StrategyBenchmark",
    # Engine
    "StrategyEngine",
    "EngineConfig",
    "PluginLoader",
    "PluginInfo",
    "MockFeatureAPI",
    "MockMarketAPI",
    "MockStateAPI",
    "MockExchangeAPI",
    # Context
    "StrategyContext",
    "StrategyConfig",
    "SessionInfo",
    "FeatureAPI",
    "MarketAPI",
    "StateAPI",
    "ExchangeAPI",
    # Config Schema
    "ConfigSchema",
    "ParamSchema",
    # Validation
    "Severity",
    "StrategyValidator",
    "ValidationReport",
    "ValidationResult",
    "PluginCertificate",
    # Capability DB
    "CapabilityRegistry",
    "CapabilityCost",
    "CapabilityInfo",
    "DependencyError",
    # Discovery
    "DiscoveryEngine",
    "DiscoverySource",
    "DiscoveryError",
    "PluginDiscovery",
    "SourceType",
    # Plugin Registry
    "PluginRegistry",
    "PluginRecord",
    "PluginRegistryError",
    # Sandbox
    'SandboxConfig',
    'SandboxContext',
    'SandboxResult',
    'StrategySandbox',
    'MemoryTracker',
    # Permissions
    'Permission',
    'PermissionSet',
    'PermissionPolicy',
    'PermissionRule',
    'PluginPermissions',
    # Plugin API
    'PluginAPIVersion',
    'PluginAPI',
    'PluginAPIFactory',
    'APICallRecord',
    'PermissionChecker',
    # Dependency
    'CircularDependencyError',
    'DependencyError',
    'DependencyGraph',
    'DependencyGraphNode',
    'DependencyResolver',
    'MissingDependencyError',
    'ResolveReport',
    'VersionMismatchError',
    # Feature Graph
    'FeatureGraph',
    'FeatureConflict',
    'FeatureConflictError',
    'FeatureDeclaration',
    'FeatureGraphError',
    'FeatureMissingError',
    'FeatureResolution',
    # Health Monitor
    'PluginHealth',
    'PluginHealthMonitor',
    'PluginHealthResult',
    'PluginHealthSnapshot',
    # Repository
    'PluginRepository',
    'RepositoryPlugin',
    'RepositorySource',
    'SourceType',
]
