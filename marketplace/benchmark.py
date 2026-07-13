"""
Marketplace Platform — Benchmark Repository.

Stores and retrieves backtest results for strategy comparison.
"""

from __future__ import annotations

import json
import logging
import os
import time
from typing import Any

from marketplace.models import BenchmarkResult

logger = logging.getLogger(__name__)


class BenchmarkRepository:
    """Repository of strategy benchmark results."""

    def __init__(self, data_dir: str = "") -> None:
        self.data_dir = data_dir or os.path.join(os.getcwd(), "data", "benchmarks")
        os.makedirs(self.data_dir, exist_ok=True)
        self._cache: list[BenchmarkResult] = []
        self._load_cache()

    def add(self, result: BenchmarkResult) -> None:
        """Add a benchmark result."""
        result.created_at = time.time()
        self._cache.append(result)
        self._save_to_disk(result)
        logger.info("Benchmark added: %s@%s on %s %s",
                     result.strategy_name, result.version,
                     result.symbol, result.timeframe)

    def get_for_strategy(self, name: str, version: str | None = None) -> list[BenchmarkResult]:
        """Get all benchmarks for a strategy."""
        results = [r for r in self._cache if r.strategy_name == name]
        if version:
            results = [r for r in results if r.version == version]
        results.sort(key=lambda r: r.created_at, reverse=True)
        return results

    def compare(self, name_a: str, name_b: str,
                symbol: str = "", timeframe: str = "") -> dict:
        """Compare two strategies' benchmarks."""
        bench_a = self.get_for_strategy(name_a)
        bench_b = self.get_for_strategy(name_b)

        if symbol:
            bench_a = [r for r in bench_a if r.symbol == symbol]
            bench_b = [r for r in bench_b if r.symbol == symbol]
        if timeframe:
            bench_a = [r for r in bench_a if r.timeframe == timeframe]
            bench_b = [r for r in bench_b if r.timeframe == timeframe]

        def best(results: list[BenchmarkResult]) -> BenchmarkResult | None:
            return max(results, key=lambda r: r.profit_factor) if results else None

        def worst(results: list[BenchmarkResult]) -> BenchmarkResult | None:
            return max(results, key=lambda r: r.max_drawdown) if results else None

        ba = best(bench_a)
        bb = best(bench_b)

        return {
            'strategy_a': {
                'name': name_a,
                'best': ba.to_dict() if ba else None,
                'count': len(bench_a),
            },
            'strategy_b': {
                'name': name_b,
                'best': bb.to_dict() if bb else None,
                'count': len(bench_b),
            },
            'comparison': {
                'winrate': {'a': ba.winrate if ba else 0, 'b': bb.winrate if bb else 0},
                'profit_factor': {'a': ba.profit_factor if ba else 0, 'b': bb.profit_factor if bb else 0},
                'max_drawdown': {'a': ba.max_drawdown if ba else 0, 'b': bb.max_drawdown if bb else 0},
                'sharpe_ratio': {'a': ba.sharpe_ratio if ba else 0, 'b': bb.sharpe_ratio if bb else 0},
            } if ba and bb else {},
        }

    def list_all(self) -> list[dict]:
        """List all benchmark entries (summary)."""
        return [
            {
                'strategy_name': r.strategy_name,
                'version': r.version,
                'symbol': r.symbol,
                'timeframe': r.timeframe,
                'period': r.period,
                'winrate': r.winrate,
                'profit_factor': r.profit_factor,
                'max_drawdown': r.max_drawdown,
                'total_trades': r.total_trades,
                'created_at': r.created_at,
            }
            for r in sorted(self._cache, key=lambda r: r.created_at, reverse=True)[:100]
        ]

    def summary(self, name: str) -> dict | None:
        """Aggregate summary of all benchmarks for a strategy."""
        results = self.get_for_strategy(name)
        if not results:
            return None
        return {
            'strategy_name': name,
            'total_benchmarks': len(results),
            'avg_winrate': sum(r.winrate for r in results) / len(results),
            'avg_profit_factor': sum(r.profit_factor for r in results) / len(results),
            'avg_max_drawdown': min(r.max_drawdown for r in results),
            'avg_sharpe': sum(r.sharpe_ratio for r in results) / len(results) if results[0].sharpe_ratio else 0,
            'last_updated': max(r.created_at for r in results),
        }

    # ── Persistence ───────────────────────────────────────────

    def _save_to_disk(self, result: BenchmarkResult) -> None:
        """Save a benchmark result to disk."""
        try:
            ts = int(result.created_at)
            filename = f"{result.strategy_name}_{result.symbol}_{ts}.json"
            path = os.path.join(self.data_dir, filename.replace('/', '_'))
            with open(path, 'w') as f:
                json.dump(result.to_dict(), f, indent=2)
        except Exception as e:
            logger.warning("Failed to save benchmark: %s", e)

    def _load_cache(self) -> None:
        """Load all benchmark files from disk."""
        if not os.path.isdir(self.data_dir):
            return
        for filename in os.listdir(self.data_dir):
            if filename.endswith('.json'):
                try:
                    with open(os.path.join(self.data_dir, filename)) as f:
                        data = json.load(f)
                    result = BenchmarkResult(
                        strategy_name=data.get('strategy_name', 'unknown'),
                        version=data.get('version', ''),
                        symbol=data.get('symbol', ''),
                        timeframe=data.get('timeframe', ''),
                        period=data.get('period', ''),
                        winrate=data.get('winrate', 0.0),
                        profit_factor=data.get('profit_factor', 0.0),
                        max_drawdown=data.get('max_drawdown', 0.0),
                        sharpe_ratio=data.get('sharpe_ratio', 0.0),
                        sortino_ratio=data.get('sortino_ratio', 0.0),
                        total_trades=data.get('total_trades', 0),
                        win_trades=data.get('win_trades', 0),
                        loss_trades=data.get('loss_trades', 0),
                        avg_win=data.get('avg_win', 0.0),
                        avg_loss=data.get('avg_loss', 0.0),
                        expectancy=data.get('expectancy', 0.0),
                        regime=data.get('regime', ''),
                        market_return=data.get('market_return', 0.0),
                        created_at=data.get('created_at', 0.0),
                    )
                    self._cache.append(result)
                except Exception as e:
                    logger.debug("Skipping benchmark file %s: %s", filename, e)
