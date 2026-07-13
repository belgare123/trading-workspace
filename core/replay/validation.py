"""
9.10 Validation Engine — регрессионное тестирование после Replay.

Проверяет:
  - Signals совпадают с эталоном
  - Decision совпадает с эталоном
  - Lifecycle совпадает с эталоном
  - Metrics совпадают с эталоном
"""

from __future__ import annotations

import hashlib
import json
import logging
from typing import Any

from core.replay.models import ReplayPackage, ValidationResult
from core.replay.deterministic import DeterministicExecutor

logger = logging.getLogger(__name__)


class ValidationEngine:
    """Валидация результатов replay против эталона."""

    def __init__(self) -> None:
        self._reference: dict[str, Any] = {}

    def record_reference(
        self,
        replay_id: str,
        signals: list[dict[str, Any]],
        decisions: list[dict[str, Any]],
        lifecycles: list[dict[str, Any]],
        metrics: dict[str, Any],
    ) -> str:
        """Записать эталонные результаты."""
        ref_hash = self._hash_results(signals, decisions, lifecycles, metrics)
        self._reference[replay_id] = {
            "signals": signals,
            "decisions": decisions,
            "lifecycles": lifecycles,
            "metrics": metrics,
            "hash": ref_hash,
        }
        logger.info("Reference recorded: %s = %s", replay_id, ref_hash)
        return ref_hash

    def validate(
        self,
        replay_id: str,
        signals: list[dict[str, Any]],
        decisions: list[dict[str, Any]],
        lifecycles: list[dict[str, Any]],
        metrics: dict[str, Any],
    ) -> ValidationResult:
        """Проверить результаты против эталона."""
        ref = self._reference.get(replay_id)
        if not ref:
            return ValidationResult(
                passed=False,
                replay_id=replay_id,
                mismatch_details=["No reference found"],
            )

        mismatches: list[str] = []
        signals_match = self._compare("signals", ref["signals"], signals, mismatches)
        decisions_match = self._compare("decisions", ref["decisions"], decisions, mismatches)
        lifecycle_match = self._compare("lifecycles", ref["lifecycles"], lifecycles, mismatches)

        ref_metrics_hash = hashlib.md5(json.dumps(ref["metrics"], sort_keys=True, default=str).encode()).hexdigest()[:8]
        cur_metrics_hash = hashlib.md5(json.dumps(metrics, sort_keys=True, default=str).encode()).hexdigest()[:8]
        metrics_match = ref_metrics_hash == cur_metrics_hash

        if not metrics_match:
            mismatches.append(f"Metrics hash: {ref_metrics_hash} vs {cur_metrics_hash}")

        passed = all([signals_match, decisions_match, lifecycle_match, metrics_match])
        score = sum([signals_match, decisions_match, lifecycle_match, metrics_match]) / 4.0

        result = ValidationResult(
            passed=passed,
            replay_id=replay_id,
            signals_match=signals_match,
            decisions_match=decisions_match,
            lifecycle_match=lifecycle_match,
            metrics_match=metrics_match,
            mismatch_details=mismatches,
            signal_count=len(signals),
            decision_count=len(decisions),
            lifecycle_count=len(lifecycles),
            score=score,
        )

        if passed:
            logger.info("Validation PASSED: %s (score=%.1f%%)", replay_id, score * 100)
        else:
            logger.warning("Validation FAILED: %s\n%s", replay_id, result.summary)

        return result

    @staticmethod
    def _compare(
        label: str,
        ref: list[dict[str, Any]],
        cur: list[dict[str, Any]],
        mismatches: list[str],
    ) -> bool:
        if len(ref) != len(cur):
            mismatches.append(f"{label}: count {len(ref)} vs {len(cur)}")
            return False
        for i, (r, c) in enumerate(zip(ref, cur)):
            r_hash = hashlib.md5(json.dumps(r, sort_keys=True, default=str).encode()).hexdigest()[:12]
            c_hash = hashlib.md5(json.dumps(c, sort_keys=True, default=str).encode()).hexdigest()[:12]
            if r_hash != c_hash:
                mismatches.append(f"{label}[{i}]: {r_hash} vs {c_hash}")
                if len(mismatches) >= 5:
                    return False
                return False  # first mismatch = fail
        return True

    @staticmethod
    def _hash_results(
        signals: list[dict[str, Any]],
        decisions: list[dict[str, Any]],
        lifecycles: list[dict[str, Any]],
        metrics: dict[str, Any],
    ) -> str:
        raw = json.dumps({
            "signals": signals,
            "decisions": decisions,
            "lifecycles": lifecycles,
            "metrics": metrics,
        }, sort_keys=True, default=str)
        return hashlib.sha256(raw.encode()).hexdigest()[:16]
