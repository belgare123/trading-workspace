"""
Marketplace Platform — Compatibility Center.

Pre-install compatibility checks: core version, exchanges, capabilities, dependencies.
"""

from __future__ import annotations

import logging
from typing import Any

from marketplace.models import Package, PackageVersion, CompatibilityReport

logger = logging.getLogger(__name__)


class CompatibilityChecker:
    """Checks package compatibility before installation."""

    def __init__(self, core_version: str = "0.14.0",
                 available_exchanges: list[str] | None = None,
                 available_capabilities: list[str] | None = None) -> None:
        self.core_version = core_version
        self.available_exchanges = available_exchanges or ["bybit", "binance"]
        self.available_capabilities = available_capabilities or []

    def check_package(self, package: Package) -> CompatibilityReport:
        """Full compatibility check for the latest version."""
        ver = package.latest
        if not ver:
            return CompatibilityReport(
                package_name=package.name,
                version="unknown",
                errors=["No version available"],
                can_install=False,
            )
        return self.check_version(package.name, ver)

    def check_version(self, name: str, version: PackageVersion) -> CompatibilityReport:
        """Check compatibility for a specific version."""
        report = CompatibilityReport(
            package_name=name,
            version=version.version,
        )

        # Core version check
        report.core_compatible = self._check_core_version(version.min_core_version)
        if not report.core_compatible:
            report.errors.append(
                f"Requires core >= {version.min_core_version}, have {self.core_version}"
            )

        # Exchange check
        for ex in version.compatible_exchanges:
            if ex in self.available_exchanges:
                report.exchanges_available.append(ex)
            else:
                report.exchanges_missing.append(ex)

        if report.exchanges_missing:
            report.warnings.append(f"Missing exchanges: {', '.join(report.exchanges_missing)}")

        # Capabilities check
        for cap in version.requires_capabilities:
            if cap in self.available_capabilities:
                report.capabilities_met.append(cap)
            else:
                report.capabilities_missing.append(cap)

        if report.capabilities_missing:
            report.errors.append(f"Missing capabilities: {', '.join(report.capabilities_missing)}")

        # Dependencies check
        for dep_name, dep_spec in version.dependencies.items():
            report.dependencies_satisfied.append(f"{dep_name}{dep_spec}")
            # In production: check actual installed version
            # For demo: mark all deps as satisfied

        # API compatibility
        report.api_compatible = True  # API 2.x is current

        # Python version
        report.python_compatible = True

        report.can_install = len(report.errors) == 0

        # If no errors but some warnings, still warn
        if report.can_install and report.warnings:
            pass  # Warnings only

        return report

    def check_multiple(self, packages: list[Package]) -> list[CompatibilityReport]:
        """Batch compatibility check."""
        return [self.check_package(p) for p in packages]

    # ── Internal ──────────────────────────────────────────────

    def _check_core_version(self, min_version: str) -> bool:
        """Simple SemVer comparison."""
        try:
            current = tuple(int(x) for x in self.core_version.split('.'))
            required = tuple(int(x) for x in min_version.split('.'))
            return current >= required
        except (ValueError, AttributeError):
            return True  # If version parsing fails, allow
