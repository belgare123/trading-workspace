"""
Learning Engine -- Phase 13.

ML/AI layer: regime classification, performance prediction,
anomaly detection, and parameter optimization.

Components:
  13.1  Features            -- Feature extractors (candles, profile, passport)
  13.2  Dataset             -- Dataset builder (train/test splitting)
  13.3  Classifier          -- Regime classifier (ML-over-rule-based)
  13.4  Predictor           -- Performance predictor (regression)
  13.5  Detector            -- Anomaly detector (Z-score based)
  13.6  Optimizer           -- Parameter optimizer (random/grid search)
  13.7  Registry            -- Model registry (version management)
  13.8  Trainer             -- Trainer (orchestrates learning)
  13.9  Events              -- Event type constants
  13.10 Bus                 -- Event bus
  13.11 Engine              -- Orchestrator
"""

from core.learning.engine import LearningEngine

__all__ = [
    "LearningEngine",
]
