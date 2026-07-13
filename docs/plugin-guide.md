# Trading Workspace — Plugin Guide

## Publishing a Package to Marketplace

This guide explains how to package your strategy for distribution via the Marketplace.

### Package Structure

A marketplace package is a directory with a `manifest.yaml`:

```
momentum-pro/
├── manifest.yaml           # Package metadata
├── strategy.py             # Main strategy implementation
├── README.md               # Documentation for users
├── requirements.txt        # (optional) Extra pip dependencies
├── screenshots/            # (optional) UI preview images
│   └── chart.png
└── tests/                  # (optional) Package tests
    └── test_strategy.py
```

### Manifest Reference

```yaml
# Package manifest — required for marketplace distribution

name: momentum-pro           # Unique package name (kebab-case)
display_name: "Momentum Pro" # Human-readable name
version: 2.1.0               # SemVer
description: "Advanced momentum strategy with dynamic ATR-based stops"
package_type: strategy       # strategy | indicator | feature | utility | tool
author:
  name: "Trading Workspace Team"
  email: "team@example.com"
  url: "https://github.com/example/momentum-pro"
license: MIT
repository: "https://github.com/example/momentum-pro"
keywords: [momentum, trend, atr]
categories: [momentum, trend-following]

# Strategy-specific metadata
strategy:
  type: momentum
  timeframes: [5m, 15m, 1h]
  exchanges: [bybit, binance]
  symbols: [BTCUSDT, ETHUSDT]

# Runtime requirements
engine:
  min_core_version: "0.14.0"
  python: ">=3.11"
  memory_mb: 128

# Dependencies
dependencies:
  strategies: []          # Other strategy packages required
  packages: []            # Python packages (in requirements.txt)
  features:               # Required FeatureGraph nodes
    required: [rsi, ema, atr]
    optional: [volume_profile, market_profile]

# Trust & signing
signatures:
  algorithm: ed25519
  author_id: "your-author-id"
  # signature_hex: <generated at publish time>
```

### Trust Levels

| Level | Badge | Requirement |
|-------|-------|-------------|
| **Official** | ✅ | Published by Trading Workspace team |
| **Verified** | 🔵 | Signed, 500+ installs, 4.0+ rating |
| **Community** | 🟢 | Standard community package |
| **Experimental** | 🟡 | < 30 days old, < 50 installs |
| **Deprecated** | ⚠️ | No longer maintained |
| **Unsafe** | 🔴 | Reported issues, removed from registry |

### Packaging Steps

#### 1. Create Package Directory

```bash
mkdir -p my-package
cd my-package

# Create manifest
touch manifest.yaml
# Create strategy
touch strategy.py
# Create README
touch README.md
```

#### 2. Write manifest.yaml

Use the template above. The `name` field must be unique.

#### 3. Test Locally

```bash
# Register with the local registry
tw install ./my-package

# Verify installation
tw list

# Check compatibility
tw check my-package

# Resolve dependencies
tw resolve my-package
```

#### 4. Generate Passport

```bash
# Generate a strategy passport with benchmark data
tw passport my-package --backtest results.json
```

### CLI Reference

#### `tw install`

```bash
# From registry
tw install momentum-pro

# From local path
tw install ./my-package

# Specific version
tw install momentum-pro==1.5.0

# With channel
tw install momentum-pro --channel beta
```

#### `tw search`

```bash
# Search by keyword
tw search momentum

# Search by category
tw search breakout --category trend-following

# Filter by trust
tw search --trust verified
```

#### `tw info`

```bash
# Package details
tw info momentum-pro

# With passport
tw info momentum-pro --passport

# With benchmarks
tw info momentum-pro --benchmarks
```

#### `tw update`

```bash
# Update to latest version
tw update momentum-pro

# Update all packages
tw update --all

# Update to specific channel
tw update momentum-pro --channel beta
```

#### `tw resolve`

```bash
# Show dependency tree
tw resolve momentum-pro
```

#### `tw compare`

```bash
# Compare two strategies
tw compare momentum-pro ict-concepts
```

#### `tw channels`

```bash
# List available channels
tw channels

# Switch channel for a package
# (Coming soon)
```

### Update Channels

| Channel | Stability | Use Case |
|---------|-----------|----------|
| **stable** | 🟢 Production-ready | Default for all users |
| **beta** | 🟡 Pre-release | Testing new features |
| **nightly** | 🟠 Daily builds | Latest development |
| **developer** | 🔴 Cutting edge | Active development |

### Signing Your Package

```bash
# Generate a key pair
python -c "
from marketplace.trust import SignatureVerifier
data = open('my-package/strategy.py', 'rb').read()
sig = SignatureVerifier.create_signature(data, 'your-author-secret')
print(f'Signature: {sig.signature_hex}')
print(f'Algorithm: {sig.algorithm}')
"
```

### Versioning

Follow SemVer strictly:
- **Major** (1.x → 2.x): Breaking changes to strategy logic or manifest
- **Minor** (1.0 → 1.1): New features, backward compatible
- **Patch** (1.0.0 → 1.0.1): Bug fixes, performance improvements

### Community Best Practices

1. **README** — Include description, setup instructions, and example output
2. **Tests** — Package tests run during `tw install`
3. **Changelog** — Keep `CHANGELOG.md` per version
4. **Screenshots** — Visual examples help users understand
5. **Keywords** — Use relevant tags for searchability
6. **Support** — Provide a way to report issues (GitHub, Telegram)
