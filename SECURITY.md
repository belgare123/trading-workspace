# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Trading Workspace Platform, please report it privately.

**Do not** open a public GitHub issue. Instead, email the maintainer:
**thejeremii@gmail.com**

You should receive a response within 48 hours. If not, follow up.

## Scope

- Core engine: strategy, decision, lifecycle, replay, event store
- Marketplace: package installation, dependency resolution, trust verification
- Web UI: authentication, session handling, API endpoints
- SDK: strategy execution, plugin API

## Out of Scope

- Exchange API keys stored externally (user-managed)
- Third-party plugin code (plugins are sandboxed but reviewed)
- Deployment-specific infrastructure (Docker, reverse proxy configuration)

## Supported Versions

| Version | Supported |
|---------|-----------|
| >= 1.0  | ✅ Full support |
| < 1.0   | ❌ No longer supported |

## Process

1. Report received → triaged within 48h
2. Fix developed → released within 7 days for critical issues
3. Public disclosure → coordinated release + advisory
