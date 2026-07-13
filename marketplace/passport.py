"""
Marketplace Platform — Strategy Passport Builder.

Builds rich strategy passports from manifest files and benchmark data.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any

from marketplace.models import StrategyPassport, TrustLevel

logger = logging.getLogger(__name__)


class PassportBuilder:
    """Builds and manages Strategy Passports."""

    def __init__(self, plugins_dir: str = "") -> None:
        self.plugins_dir = plugins_dir

    def from_manifest(self, manifest_path: str) -> StrategyPassport | None:
        """Build a passport from a manifest.yaml file."""
        if not os.path.isfile(manifest_path):
            return None

        try:
            import yaml
            with open(manifest_path) as f:
                data = yaml.safe_load(f) or {}
        except Exception:
            return None

        passport = StrategyPassport(
            name=data.get('name', 'unknown'),
            display_name=data.get('display_name', data.get('name', 'unknown')),
            version=data.get('version', '0.1.0'),
            author=data.get('author', ''),
            description=data.get('description', ''),
            strategy_type=data.get('strategy_type', ''),
            timeframes=data.get('timeframes', []),
            exchanges=data.get('exchanges', []),
            min_core_version=data.get('min_core_version', '0.14.0'),
            required_capabilities=data.get('capabilities', []),
            features_used=data.get('features', []),
            indicators=data.get('indicators', []),
            default_params=data.get('params', {}),
            tunable_params=list(data.get('params', {}).keys()),
            tags=data.get('tags', []),
            license=data.get('license', 'MIT'),
            homepage=data.get('homepage', ''),
            documentation=data.get('documentation', ''),
            rating=data.get('rating', 0.0),
            rating_count=data.get('rating_count', 0),
        )
        return passport

    def from_directory(self, directory: str) -> StrategyPassport | None:
        """Find and build a passport from a strategy directory."""
        manifest_path = os.path.join(directory, "manifest.yaml")
        passport = self.from_manifest(manifest_path)
        if not passport:
            manifest_path = os.path.join(directory, "manifest.yml")
            passport = self.from_manifest(manifest_path)
        if not passport:
            # Try package.json fallback
            pkg_path = os.path.join(directory, "package.json")
            if os.path.isfile(pkg_path):
                try:
                    import json
                    with open(pkg_path) as f:
                        data = json.load(f)
                    passport = StrategyPassport(
                        name=data.get('name', os.path.basename(directory)),
                        display_name=data.get('display_name', data.get('name', '')),
                        version=data.get('version', '0.1.0'),
                        author=data.get('author', ''),
                        description=data.get('description', ''),
                    )
                except Exception:
                    pass
        return passport

    def to_dict(self, passport: StrategyPassport) -> dict:
        """Serialize passport to dict for API/display."""
        return passport.to_dict()

    def to_json(self, passport: StrategyPassport, indent: int = 2) -> str:
        """Serialize passport to JSON string."""
        import json
        return json.dumps(passport.to_dict(), indent=indent, ensure_ascii=False)

    def enrich_with_benchmarks(self, passport: StrategyPassport,
                               benchmarks: list) -> StrategyPassport:
        """Attach benchmark data to a passport."""
        if not benchmarks:
            return passport

        best = benchmarks[0]  # Use first benchmark as primary
        passport.benchmark_winrate = best.winrate
        passport.benchmark_profit_factor = best.profit_factor
        passport.benchmark_max_dd = best.max_drawdown
        passport.benchmark_sharpe = best.sharpe_ratio
        passport.benchmark_trades = best.total_trades
        passport.benchmark_period = best.period
        return passport
