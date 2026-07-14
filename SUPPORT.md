# Support

## Supported Python Versions

| Version | Status |
|---------|--------|
| **Python 3.11** | ✅ Primary target — all development and testing |
| Python 3.12 | ⚠️ Community-tested, no CI coverage |
| Python 3.10 | ❌ Not supported |

## Supported Operating Systems

| OS | Status |
|----|--------|
| **Windows 10/11** | ✅ Primary — RDP, Docker Desktop, WSL2 |
| **Linux (Ubuntu 22.04/24.04)** | ✅ CI-tested |
| macOS (Intel) | ⚠️ Community-tested |
| macOS (Apple Silicon) | ⚠️ Community-tested |

## Compatibility Policy

- **Minor versions** (v1.0 → v1.1): backwards-compatible public API. Deprecated
  symbols are kept for one minor version before removal.
- **Patch versions** (v1.0 → v1.0.1): fully backwards-compatible. Bug fixes only.
- **Database format**: SQLite schema migrations are automatic on startup.
  Rollbacks require explicit downgrade scripts.

## Bugfix Policy

- **Critical bugs** (data loss, crash on startup, security): patch release within 48h.
- **Major bugs** (feature broken, API misuse): patch release within one week.
- **Minor bugs**: addressed in the next patch release.
- **Regressions from test suite**: treated as blocking — PR cannot merge.

## Release Lifecycle

```
v0.16.x — Release Candidate (feature freeze, audits, validation)
v1.0.x  — Stable (production-ready, long-term support)
v1.1.x  — Multi-Exchange Runtime
v1.2.x  — Cloud Platform
v1.3.x  — Ecosystem
v2.0.x  — Simulation Lab
```

Each major/minor release receives:
- **Active support**: 6 months from release date (bugfixes)
- **Security support**: 12 months from release date (critical patches)
- **After that**: upgrade recommended

## Reporting Issues

- GitHub Issues: https://github.com/belgare123/trading-workspace/issues
- Security disclosures: contact maintainers directly (no public issues for CVEs)

## Getting Help

- **Documentation**: `docs/` — 15+ guides
- **Examples**: `examples/` — 8 runnable demos
- **API Reference**: `docs/api-reference.md`
- **Architecture**: `docs/architecture-guide.md`
