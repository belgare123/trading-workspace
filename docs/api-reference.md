# Trading Workspace — API Reference

## SDK Reference (`screener_sdk`)

The SDK is the public API for strategy authors. Import everything from `screener_sdk`:

```python
from screener_sdk import (
    # Core
    BaseStrategy,
    StrategyContext,
    StrategyConfig,
    # Signal models
    Signal,
    SignalBundle,
    SignalDirection,
    Opportunity,
    PriceTarget,
    RiskAssessment,
    # Descriptor
    StrategyDescriptor,
    StrategyCategory,
    ManifestError,
    # Utilities
    SDK_VERSION,
    SDK_MIN_CORE,
    version_info,
)
```

---

### `BaseStrategy`

Abstract base for all trading strategies.

```python
class BaseStrategy(ABC):
    name: str                           # Unique strategy name
    logger: logging.Logger              # Per-strategy logger
    config: dict[str, Any]              # Strategy-specific config

    @classmethod
    @abstractmethod
    def create(cls, descriptor: StrategyDescriptor) -> Self
    def __init__(self, descriptor: StrategyDescriptor) -> None
    async def on_start(self, context: StrategyContext) -> None
    async def on_stop(self, context: StrategyContext) -> None
    async def analyze(self, symbol: str, context: StrategyContext) -> SignalBundle | None
    @property
    def descriptor(self) -> StrategyDescriptor
    def get_config(self, key: str, default: Any = None) -> Any
```

---

### `StrategyContext`

Per-symbol context provided to strategies.

```python
class StrategyContext:
    symbol: str                         # Current trading pair
    price: float                        # Current price
    timestamp: float                    # Current time (unix)
    timeframe: str                      # Current candle timeframe
    candles: DataFrame | None           # Historical candles
    features: dict[str, Any]            # Computed features dict

    def get_feature(self, name: str) -> Any | None
    def get_profile(self) -> MarketProfile | None
    def get_regime(self) -> RegimeType | None
    def get_session(self) -> SessionType | None
    def get_correlation(self) -> CorrelationSnapshot | None
    def has_feature(self, name: str) -> bool
```

---

### Signal Models

#### `Signal`

```python
@dataclass
class Signal:
    symbol: str                         # Trading pair
    direction: SignalDirection          # LONG | SHORT | NEUTRAL
    confidence: float                   # 0.0–1.0
    price: float                        # Entry price
    timestamp: float                    # Signal creation time
    source: str                         # Strategy name
    metadata: dict[str, Any] = field(default_factory=dict)
    id: str = field(default_factory=lambda: str(uuid4()))
```

#### `SignalBundle`

```python
@dataclass
class SignalBundle:
    strategy: str                       # Strategy name
    symbol: str                         # Trading pair
    signals: list[Signal]               # Signal list
    timestamp: float                    # Bundle creation time
    metadata: dict[str, Any] = field(default_factory=dict)
```

#### `SignalDirection`

```python
class SignalDirection(Enum):
    LONG = "long"
    SHORT = "short"
    NEUTRAL = "neutral"
    EXIT = "exit"
```

#### `Opportunity`

```python
@dataclass
class Opportunity:
    id: str
    strategy: str
    signal: Signal
    direction: SignalDirection
    entry_price: float
    current_price: float
    confidence: float
    status: OpportunityStatus
    created_at: float
    expires_at: float | None
```

---

### `StrategyDescriptor`

Immutable metadata descriptor for a strategy.

```python
@dataclass(frozen=True)
class StrategyDescriptor:
    name: str
    display_name: str
    version: str
    description: str
    author: str
    strategy_type: str
    timeframes: list[str]
    exchanges: list[str]
    symbols: list[str]
    features: dict[str, list[str]]
    config_schema: dict[str, Any]
    manifest_dir: str
    manifest_path: str
```

---

### `VersionInfo`

```python
def version_info() -> dict[str, str]:
    """Returns SDK version, min core requirement, and detected core version."""
    # Returns: {"sdk_version": "2.0.0", "sdk_min_core": "0.12.0", "core_version": "0.15.0"}
```

---

## CLI Reference (`tw`)

### Installation

```bash
pip install trading-workspace
# or
pip install -e .  # from source
```

### Commands

| Command | Description | Usage |
|---------|-------------|-------|
| `install` | Install a package | `tw install <name> [version]` |
| `update` | Update a package | `tw update <name>` |
| `remove` | Uninstall a package | `tw remove <name>` |
| `list` | List installed packages | `tw list` |
| `search` | Search registry | `tw search <query>` |
| `info` | Show package details | `tw info <name>` |
| `resolve` | Show dependency tree | `tw resolve <name>` |
| `compare` | Compare two strategies | `tw compare <a> <b>` |
| `channels` | List update channels | `tw channels` |
| `check` | Check compatibility | `tw check <name>` |

### Example Output

```bash
$ tw search momentum
Name                      Type         Trust        Rating   Installs
----------------------------------------------------------------------
momentum-pro              strategy     official     4.7★     1284
momentum-scalper          strategy     verified     4.3★     856
```

```bash
$ tw resolve momentum-pro
{
  "success": true,
  "package": "momentum-pro",
  "version": "latest",
  "dependencies": [],
  "install_order": ["momentum-pro"],
  "conflicts": [],
  "missing": []
}
```

---

## Programmatic API

### Package Manager

```python
from marketplace import PackageManager, RegistryClient

pm = PackageManager()
registry = RegistryClient()

# Install
result = pm.install("momentum-pro")

# Search
results = registry.search_remote("breakout")

# Get package details
pkg = registry.get_package("ict-concepts")
print(pkg.display_name, pkg.latest_version)

# List installed
installed = pm.list_installed()

# Install metrics
community = pkg.community
print(f"Rating: {community.rating}★ ({community.rating_count} reviews)")
print(f"Installs: {community.install_count}")
```

### Passport

```python
from marketplace import PassportBuilder, BenchmarkRepository

builder = PassportBuilder()
passport = builder.from_directory("strategies/MyStrategy")
if passport:
    print(passport.to_json())

benchmarks = BenchmarkRepository()
results = benchmarks.get_for_strategy("momentum-pro")
for bm in results:
    print(f"{bm.period}: {bm.winrate:.1f}% WR, {bm.profit_factor:.2f} PF")
```

### Trust System

```python
from marketplace import TrustSystem, SignatureVerifier

trust = TrustSystem()
level = trust.evaluate_trust(
    install_count=600,
    rating=4.5,
    age_days=60,
    has_signature=True,
)
print(f"Trust level: {level.value}")  # "verified"

display = trust.get_trust_display(level)
print(f"Label: {display['label']}, Color: {display['color']}")
```

### Compatibility

```python
from marketplace import CompatibilityChecker

checker = CompatibilityChecker()
report = checker.check_package(pkg)
if report.can_install:
    print("✅ Compatible")
else:
    print(f"❌ Blocked: {report.errors}")
    print(f"  Core: {'✅' if report.core_compatible else '❌'}")
    print(f"  Exchanges: {report.exchanges_missing}")
```

---

## Core API (Internal)

> ⚠️ These are internal APIs. Strategy authors should use `screener_sdk`.

### `core/strategy/engine.py` — StrategyEngine

```python
class StrategyEngine:
    async def start(self) -> None
    async def stop(self) -> None
    async def analyze(self, symbol: str, context: StrategyContext) -> list[SignalBundle]
    async def discover(self, path: str) -> list[StrategyDescriptor]
    async def get_health(self) -> dict[str, Any]
```

### `core/decision/engine.py` — DecisionEngine

```python
class DecisionEngine:
    async def process(self, bundles: list[SignalBundle]) -> list[Opportunity]
    async def get_consensus(self, signals: list[NormalizedSignal]) -> ConsensusResult
```

### `core/lifecycle/engine.py` — LifecycleEngine

```python
class LifecycleEngine:
    async def create_opportunity(self, signal: Signal) -> Opportunity
    async def tick(self) -> list[OpportunityEvent]
    def get_active(self) -> list[Opportunity]
    def get_history(self) -> list[Opportunity]
```

### `core/quality/engine.py` — QualityEngine

```python
class QualityEngine:
    async def evaluate(self, signal: Signal) -> QualityReport
    def get_metrics(self) -> dict[str, float]
```

### `core/analytics/engine.py` — AnalyticsEngine

```python
class AnalyticsEngine:
    async def get_regime(self, symbol: str) -> RegimeType
    async def get_profile(self, symbol: str) -> MarketProfile
    async def get_session(self) -> str
```

### `core/portfolio/engine.py` — PortfolioEngine

```python
class PortfolioEngine:
    async def allocate(self, opportunities: list[Opportunity]) -> list[Allocation]
    async def get_weight(self, strategy: str) -> float
```

### `core/learning/engine.py` — LearningEngine

```python
class LearningEngine:
    async def train(self, dataset: Dataset) -> LearningResult
    async def predict(self, features: dict[str, float]) -> Prediction
    async def detect_anomaly(self, signal: Signal) -> bool
```
