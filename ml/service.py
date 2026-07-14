"""
ML Workbench — Mock Service Implementation.

Provides realistic demo data and simulates training progress.
Designed so the frontend never changes when real ML runtime replaces mocks.
"""

from __future__ import annotations

import random
import time
import uuid
from datetime import datetime, timedelta
from typing import Any

from ml.models import (
    ClassificationMetrics,
    ConfusionMatrix,
    DatasetInfo,
    Experiment,
    ExperimentStatus,
    FeatureImportance,
    Hyperparams,
    Model,
    ModelStatus,
    TrainingMetrics,
    TrainingRun,
)

logger = __import__("logging").getLogger(__name__)

# TypedDict-like shape for the API dict
API = dict[str, Any]


def _ts(ago_days: int = 0) -> str:
    """ISO timestamp, offset by `ago_days`."""
    dt = datetime.utcnow() - timedelta(days=ago_days, hours=random.randint(0, 23))
    return dt.isoformat() + "Z"


# ── Demo Models ────────────────────────────────────────────────────

_DEMO_MODELS: list[Model] = [
    Model(
        id="model-momentum-predictor",
        name="Momentum Predictor",
        description="LSTM-based model predicting short-term price momentum from order flow and volume profile features.",
        version="2.1.0",
        status=ModelStatus.PRODUCTION,
        model_type="classifier",
        framework="pytorch",
        accuracy=0.914,
        last_trained=_ts(1),
        tags=["momentum", "lstm", "orderflow"],
        hyperparams=Hyperparams(
            learning_rate=0.0005, batch_size=64, epochs=100, hidden_layers=[128, 64, 32]
        ),
        dataset=DatasetInfo(
            name="BTC/USDT Momentum v3",
            version="3.0",
            rows=125000,
            features=["volume_delta", "cumulative_delta", "bid_ask_imbalance", "trade_velocity",
                      "vwap_deviation", "order_book_pressure", "tick_frequency"],
            target="direction_up",
            description="15m OHLCV + order flow features from June–December 2025.",
        ),
        metrics=ClassificationMetrics(accuracy=0.914, precision=0.892, recall=0.876, f1_score=0.884, roc_auc=0.941),
        confusion_matrix=ConfusionMatrix(
            labels=["Down", "Up"],
            matrix=[[2100, 312], [284, 2304]],
        ),
        feature_importance=[
            FeatureImportance(name="volume_delta", importance=0.231),
            FeatureImportance(name="cumulative_delta", importance=0.187),
            FeatureImportance(name="order_book_pressure", importance=0.143),
            FeatureImportance(name="bid_ask_imbalance", importance=0.128),
            FeatureImportance(name="vwap_deviation", importance=0.112),
            FeatureImportance(name="trade_velocity", importance=0.104),
            FeatureImportance(name="tick_frequency", importance=0.095),
        ],
        created_at=_ts(60),
        updated_at=_ts(1),
    ),
    Model(
        id="model-whale-flow-detector",
        name="Whale Flow Detector",
        description="Gradient-boosted classifier detecting large institutional transactions from on-chain data.",
        version="1.3.0",
        status=ModelStatus.READY,
        model_type="classifier",
        framework="xgboost",
        accuracy=0.878,
        last_trained=_ts(7),
        tags=["whale", "onchain", "xgboost"],
        hyperparams=Hyperparams(
            learning_rate=0.05, batch_size=128, epochs=200, optimizer="xgboost", loss_fn="log_loss",
            dropout=0.3, hidden_layers=[]
        ),
        dataset=DatasetInfo(
            name="Whale Transactions Q1 2025",
            version="1.2",
            rows=48300,
            features=["tx_value_usd", "gas_price", "wallet_age_days", "exchange_inflow", "exchange_outflow",
                      "prev_tx_count", "contract_interaction"],
            target="is_whale",
            description="On-chain transaction data for wallets > $100k.",
        ),
        metrics=ClassificationMetrics(accuracy=0.878, precision=0.851, recall=0.832, f1_score=0.841, roc_auc=0.903),
        confusion_matrix=ConfusionMatrix(
            labels=["Normal", "Whale"],
            matrix=[[8450, 890], [720, 6240]],
        ),
        feature_importance=[
            FeatureImportance(name="tx_value_usd", importance=0.312),
            FeatureImportance(name="gas_price", importance=0.205),
            FeatureImportance(name="exchange_inflow", importance=0.148),
            FeatureImportance(name="wallet_age_days", importance=0.122),
            FeatureImportance(name="exchange_outflow", importance=0.108),
            FeatureImportance(name="prev_tx_count", importance=0.065),
            FeatureImportance(name="contract_interaction", importance=0.040),
        ],
        created_at=_ts(90),
        updated_at=_ts(7),
    ),
    Model(
        id="model-liquidity-sweep",
        name="Liquidity Sweep Classifier",
        description="CNN-based model detecting liquidity sweep patterns from microstructure data.",
        version="0.9.0",
        status=ModelStatus.DRAFT,
        model_type="classifier",
        framework="pytorch",
        accuracy=0.0,
        tags=["liquidity", "cnn", "microstructure"],
        hyperparams=Hyperparams(
            learning_rate=0.001, batch_size=32, epochs=150, hidden_layers=[64, 64, 32, 16]
        ),
        dataset=DatasetInfo(
            name="Microstructure Sweeps v1",
            version="1.0",
            rows=0,
            features=["tick_sequence", "depth_imbalance", "spread_pct", "cancel_rate", "print_size_pct"],
            target="sweep_detected",
            description="Raw market microstructure tick data.",
        ),
        created_at=_ts(2),
        updated_at=_ts(2),
    ),
    Model(
        id="model-regime-classifier",
        name="Market Regime Classifier",
        description="Hidden Markov Model + attention-based classifier for market regime detection (trending / ranging / volatile).",
        version="1.0.0",
        status=ModelStatus.READY,
        model_type="classifier",
        framework="pytorch",
        accuracy=0.856,
        last_trained=_ts(14),
        tags=["regime", "hmm", "attention"],
        hyperparams=Hyperparams(
            learning_rate=0.0008, batch_size=64, epochs=80, hidden_layers=[96, 48, 24]
        ),
        dataset=DatasetInfo(
            name="Regime Labels 2025",
            version="2.1",
            rows=95000,
            features=["returns_5m", "returns_15m", "atr_pct", "volume_zscore", "spread_avg", "turnover_ratio",
                      "correlation_breadth"],
            target="regime",
            description="Multi-asset regime labels (trend, range, volatile) from 2025.",
        ),
        metrics=ClassificationMetrics(accuracy=0.856, precision=0.833, recall=0.814, f1_score=0.823, roc_auc=0.894),
        confusion_matrix=ConfusionMatrix(
            labels=["Trend", "Range", "Volatile"],
            matrix=[[3200, 420, 180], [380, 2900, 310], [150, 290, 1760]],
        ),
        feature_importance=[
            FeatureImportance(name="atr_pct", importance=0.245),
            FeatureImportance(name="returns_15m", importance=0.198),
            FeatureImportance(name="volume_zscore", importance=0.156),
            FeatureImportance(name="spread_avg", importance=0.134),
            FeatureImportance(name="returns_5m", importance=0.112),
            FeatureImportance(name="turnover_ratio", importance=0.088),
            FeatureImportance(name="correlation_breadth", importance=0.067),
        ],
        created_at=_ts(120),
        updated_at=_ts(14),
    ),
    Model(
        id="model-sentiment-analyzer",
        name="News Sentiment Analyzer",
        description="Transformer-based sentiment classifier for financial news headlines and social media.",
        version="0.4.0",
        status=ModelStatus.TRAINING,
        model_type="classifier",
        framework="transformers",
        accuracy=0.723,
        last_trained=_ts(30),
        tags=["nlp", "sentiment", "transformer"],
        hyperparams=Hyperparams(
            learning_rate=2e-5, batch_size=16, epochs=10, optimizer="adamw", loss_fn="cross_entropy",
            dropout=0.1, hidden_layers=[768, 256, 3]
        ),
        dataset=DatasetInfo(
            name="Financial News v4",
            version="4.0",
            rows=250000,
            features=["token_ids", "attention_mask", "source_weight"],
            target="sentiment",
            description="Aggregated financial news headlines 2024–2025 with expert labels.",
        ),
        metrics=ClassificationMetrics(accuracy=0.723, precision=0.701, recall=0.689, f1_score=0.695, roc_auc=0.812),
        confusion_matrix=ConfusionMatrix(
            labels=["Negative", "Neutral", "Positive"],
            matrix=[[4100, 890, 320], [760, 5200, 680], [290, 610, 4850]],
        ),
        feature_importance=[],
        created_at=_ts(45),
        updated_at=_ts(1),
    ),
    Model(
        id="model-order-flow-ae",
        name="Order Flow Anomaly Detector",
        description="Autoencoder trained on order flow feature vectors for anomaly/regime-shift detection.",
        version="0.2.0",
        status=ModelStatus.DRAFT,
        model_type="autoencoder",
        framework="pytorch",
        accuracy=0.0,
        tags=["anomaly", "autoencoder", "unsupervised"],
        hyperparams=Hyperparams(
            learning_rate=0.0003, batch_size=128, epochs=200, hidden_layers=[64, 32, 16, 8]
        ),
        dataset=DatasetInfo(
            name="Order Flow Features",
            version="0.5",
            rows=0,
            features=["feature_vector_64d"],
            target="reconstruction_error",
            description="64-dim order flow feature vectors from live market data.",
        ),
        created_at=_ts(1),
        updated_at=_ts(1),
    ),
]


# ── In-memory state ────────────────────────────────────────────────

_models: dict[str, Model] = {m.id: m for m in _DEMO_MODELS}
_training_runs: dict[str, TrainingRun] = {}
_experiments: list[Experiment] = [
    Experiment(
        id="exp-001",
        name="LSTM v2 — hyperparam sweep",
        model_id="model-momentum-predictor",
        model_name="Momentum Predictor",
        status=ExperimentStatus.COMPLETED,
        dataset_name="BTC/USDT Momentum v2",
        accuracy=0.887,
        duration_seconds=3420.0,
        hyperparams=Hyperparams(learning_rate=0.001, batch_size=32, epochs=80, hidden_layers=[64, 32]),
        started_at=_ts(65),
        completed_at=_ts(64),
        tags=["sweep", "lstm", "v2"],
    ),
    Experiment(
        id="exp-002",
        name="LSTM v3 — deeper L2",
        model_id="model-momentum-predictor",
        model_name="Momentum Predictor",
        status=ExperimentStatus.COMPLETED,
        dataset_name="BTC/USDT Momentum v3",
        accuracy=0.902,
        duration_seconds=4800.0,
        hyperparams=Hyperparams(learning_rate=0.0008, batch_size=64, epochs=100, hidden_layers=[128, 64]),
        started_at=_ts(50),
        completed_at=_ts(48),
        tags=["sweep", "lstm", "v3"],
    ),
    Experiment(
        id="exp-003",
        name="LSTM v3 — lower LR",
        model_id="model-momentum-predictor",
        model_name="Momentum Predictor",
        status=ExperimentStatus.COMPLETED,
        dataset_name="BTC/USDT Momentum v3",
        accuracy=0.914,
        duration_seconds=5100.0,
        hyperparams=Hyperparams(learning_rate=0.0005, batch_size=64, epochs=100, hidden_layers=[128, 64, 32]),
        started_at=_ts(40),
        completed_at=_ts(38),
        tags=["sweep", "lstm", "v3"],
    ),
    Experiment(
        id="exp-004",
        name="XGBoost baseline",
        model_id="model-whale-flow-detector",
        model_name="Whale Flow Detector",
        status=ExperimentStatus.COMPLETED,
        dataset_name="Whale Transactions Q1 2025",
        accuracy=0.821,
        duration_seconds=180.0,
        hyperparams=Hyperparams(learning_rate=0.1, batch_size=0, epochs=100, optimizer="xgboost", hidden_layers=[]),
        started_at=_ts(95),
        completed_at=_ts(95),
        tags=["baseline", "xgboost"],
    ),
    Experiment(
        id="exp-005",
        name="XGBoost tuned",
        model_id="model-whale-flow-detector",
        model_name="Whale Flow Detector",
        status=ExperimentStatus.COMPLETED,
        dataset_name="Whale Transactions Q1 2025",
        accuracy=0.878,
        duration_seconds=420.0,
        hyperparams=Hyperparams(learning_rate=0.05, batch_size=128, epochs=200, optimizer="xgboost", hidden_layers=[]),
        started_at=_ts(30),
        completed_at=_ts(29),
        tags=["tuned", "xgboost"],
    ),
    Experiment(
        id="exp-006",
        name="Regime HMM + attention v1",
        model_id="model-regime-classifier",
        model_name="Market Regime Classifier",
        status=ExperimentStatus.COMPLETED,
        dataset_name="Regime Labels 2025",
        accuracy=0.845,
        duration_seconds=2800.0,
        hyperparams=Hyperparams(learning_rate=0.001, batch_size=64, epochs=60, hidden_layers=[64, 32]),
        started_at=_ts(130),
        completed_at=_ts(128),
        tags=["hmm", "attention", "v1"],
    ),
    Experiment(
        id="exp-007",
        name="Regime v2 — deeper",
        model_id="model-regime-classifier",
        model_name="Market Regime Classifier",
        status=ExperimentStatus.COMPLETED,
        dataset_name="Regime Labels 2025",
        accuracy=0.856,
        duration_seconds=3600.0,
        hyperparams=Hyperparams(learning_rate=0.0008, batch_size=64, epochs=80, hidden_layers=[96, 48, 24]),
        started_at=_ts(100),
        completed_at=_ts(98),
        tags=["v2", "deeper"],
    ),
    Experiment(
        id="exp-008",
        name="Sentiment BERT fine-tune",
        model_id="model-sentiment-analyzer",
        model_name="News Sentiment Analyzer",
        status=ExperimentStatus.RUNNING,
        dataset_name="Financial News v4",
        accuracy=0.0,
        duration_seconds=7200.0,
        hyperparams=Hyperparams(learning_rate=2e-5, batch_size=16, epochs=10, optimizer="adamw", hidden_layers=[768, 256, 3]),
        started_at=_ts(0),
        completed_at="",
        tags=["bert", "finetune"],
    ),
]

# Active training simulation (auto-advances on each poll)
_active_training: str | None = "model-sentiment-analyzer"


def _find_active_training() -> TrainingRun | None:
    """Return latest training run for the model in TRAINING status."""
    for m in _models.values():
        if m.status == ModelStatus.TRAINING:
            return _simulate_training(m)
    return None


def _simulate_training(model: Model) -> TrainingRun:
    """Simulate training progress. Each call advances ~1-3 epochs."""
    run_id = f"train-{model.id}"

    if run_id not in _training_runs:
        total = model.hyperparams.epochs
        _training_runs[run_id] = TrainingRun(
            id=run_id,
            model_id=model.id,
            model_name=model.name,
            status="running",
            progress=0.05,
            current_epoch=2,
            total_epochs=total,
            metrics=TrainingMetrics(
                epoch=2, total_epochs=total,
                loss=1.2, accuracy=0.45,
                val_loss=1.3, val_accuracy=0.42,
                learning_rate=model.hyperparams.learning_rate,
            ),
            started_at=_ts(0),
            eta=(datetime.utcnow() + timedelta(minutes=28)).isoformat() + "Z",
        )

    run = _training_runs[run_id]
    advance = random.randint(1, 3)
    run.current_epoch = min(run.current_epoch + advance, run.total_epochs)
    run.progress = run.current_epoch / run.total_epochs

    # Simulate improving metrics
    base_loss = max(0.01, 1.2 * (1 - run.progress * 0.8) + random.uniform(-0.02, 0.02))
    base_acc = min(0.95, 0.45 + run.progress * 0.40 + random.uniform(-0.01, 0.01))

    run.metrics = TrainingMetrics(
        epoch=run.current_epoch,
        total_epochs=run.total_epochs,
        loss=round(base_loss, 4),
        accuracy=round(base_acc, 4),
        val_loss=round(base_loss * 1.1, 4),
        val_accuracy=round(base_acc - 0.02, 4),
        learning_rate=model.hyperparams.learning_rate * (0.95 ** (run.current_epoch // 20)),
    )

    if run.current_epoch >= run.total_epochs:
        run.status = "completed"
        model.status = ModelStatus.READY
        model.accuracy = run.metrics.accuracy
        model.metrics = ClassificationMetrics(
            accuracy=run.metrics.accuracy,
            precision=round(run.metrics.accuracy * 0.97, 3),
            recall=round(run.metrics.accuracy * 0.95, 3),
            f1_score=round(run.metrics.accuracy * 0.96, 3),
            roc_auc=round(0.5 + run.metrics.accuracy * 0.5, 3),
        )

    remaining_epochs = run.total_epochs - run.current_epoch
    eta_min = max(1, int(remaining_epochs * 0.15))
    run.eta = (datetime.utcnow() + timedelta(minutes=eta_min)).isoformat() + "Z"

    return run


# ── Public API ─────────────────────────────────────────────────────


def create_ml_api() -> dict[str, Any]:
    """Create API handlers for the ML Workbench.

    Returns dict of {endpoint_name: handler_function}.
    Designed to be replaced by a real ML runtime without frontend changes.
    """

    # ── Models ──

    def list_models() -> list[dict]:
        """GET /api/v1/ml/models — List all models."""
        # Advance training simulation on poll
        _find_active_training()
        return [m.to_dict() for m in sorted(
            _models.values(),
            key=lambda x: x.updated_at or "",
            reverse=True,
        )]

    def get_model(model_id: str) -> dict | None:
        """GET /api/v1/ml/models/{id} — Get model details."""
        m = _models.get(model_id)
        if not m:
            return {"error": "model not found"}
        _find_active_training()
        return m.to_dict()

    # ── Training ──

    def start_training(body: dict) -> dict:
        """POST /api/v1/ml/train — Start/queue training for a model."""
        model_id = body.get("model_id", "")
        if model_id not in _models:
            return {"error": f"model '{model_id}' not found"}

        model = _models[model_id]
        if model.status == ModelStatus.TRAINING:
            return {"error": f"model '{model_id}' is already training"}

        model.status = ModelStatus.TRAINING
        model.last_trained = _ts(0)

        # Reset training run
        run_id = f"train-{model_id}"
        _training_runs.pop(run_id, None)

        return {
            "success": True,
            "model_id": model_id,
            "message": f"Training started for {model.name}",
        }

    def get_training_run(model_id: str) -> dict | None:
        """GET /api/v1/ml/train/{model_id} — Get current training run."""
        model = _models.get(model_id)
        if not model:
            return {"error": "model not found"}
        _find_active_training()
        if model.status != ModelStatus.TRAINING:
            return {"status": "idle", "model_id": model_id}
        run = _find_active_training()
        return run.to_dict() if run else {"status": "queued", "model_id": model_id}

    # ── Evaluation ──

    def evaluate_model(body: dict) -> dict:
        """POST /api/v1/ml/evaluate — Run evaluation on a trained model."""
        model_id = body.get("model_id", "")
        if model_id not in _models:
            return {"error": "model not found"}

        model = _models[model_id]
        if model.status in (ModelStatus.DRAFT, ModelStatus.FAILED):
            return {"error": "cannot evaluate a model in {model.status.value} status"}

        # Simulate evaluation producing fresh metrics
        base = model.accuracy if model.accuracy > 0 else 0.75
        jitter = random.uniform(-0.02, 0.02)
        acc = round(min(0.99, base + jitter), 3)

        eval_result = {
            "model_id": model_id,
            "model_name": model.name,
            "status": "completed",
            "metrics": ClassificationMetrics(
                accuracy=acc,
                precision=round(acc * 0.97, 3),
                recall=round(acc * 0.95, 3),
                f1_score=round(acc * 0.96, 3),
                roc_auc=round(0.5 + acc * 0.5, 3),
            ).to_dict(),
            "confusion_matrix": model.confusion_matrix.to_dict(),
            "feature_importance": [fi.to_dict() for fi in model.feature_importance],
        }
        return eval_result

    # ── Promotion ──

    def promote_model(body: dict) -> dict:
        """POST /api/v1/ml/promote — Promote model to next stage.

        Accepts 'model_id' and optionally 'target_status'.
        If target_status absent, auto-advances: draft→ready, ready→production.
        """
        model_id = body.get("model_id", "")
        target = body.get("target_status", "")

        if model_id not in _models:
            return {"error": "model not found"}

        model = _models[model_id]
        status_order = [ModelStatus.DRAFT, ModelStatus.TRAINING, ModelStatus.READY,
                        ModelStatus.PRODUCTION, ModelStatus.ARCHIVED]

        if target and target in [s.value for s in status_order]:
            model.status = ModelStatus(target)
            model.updated_at = _ts(0)
            return {"success": True, "model_id": model_id, "status": model.status.value}

        # Auto-advance
        current_idx = status_order.index(model.status) if model.status in status_order else 0
        if current_idx < len(status_order) - 1:
            # Skip TRAINING (auto-advance from draft→ready, ready→production)
            if model.status == ModelStatus.DRAFT:
                model.status = ModelStatus.READY
            elif model.status == ModelStatus.READY:
                model.status = ModelStatus.PRODUCTION
            elif model.status == ModelStatus.PRODUCTION:
                model.status = ModelStatus.ARCHIVED
            else:
                model.status = status_order[min(current_idx + 1, len(status_order) - 1)]
            model.updated_at = _ts(0)
            return {"success": True, "model_id": model_id, "status": model.status.value}

        return {"success": False, "error": "already at terminal status"}

    # ── Experiments ──

    def list_experiments() -> list[dict]:
        """GET /api/v1/ml/experiments — List all experiments."""
        return [e.to_dict() for e in sorted(
            _experiments,
            key=lambda x: x.started_at or "",
            reverse=True,
        )]

    def get_experiment(experiment_id: str) -> dict | None:
        """GET /api/v1/ml/experiments/{id} — Get experiment details."""
        for e in _experiments:
            if e.id == experiment_id:
                return e.to_dict()
        return {"error": "experiment not found"}

    # ── Metrics (live training feed) ──

    def get_metrics(model_id: str) -> dict | None:
        """GET /api/v1/ml/metrics/{model_id} — Latest training metrics."""
        model = _models.get(model_id)
        if not model:
            return {"error": "model not found"}
        _find_active_training()
        run = _find_active_training()
        if run and run.model_id == model_id:
            return run.to_dict()
        # Return static metrics for non-training models
        if model.metrics:
            return {
                "model_id": model_id,
                "status": "idle",
                "metrics": model.metrics.to_dict(),
            }
        return {"status": "idle", "model_id": model_id}

    return {
        "list_models": list_models,
        "get_model": get_model,
        "start_training": start_training,
        "get_training_run": get_training_run,
        "evaluate_model": evaluate_model,
        "promote_model": promote_model,
        "list_experiments": list_experiments,
        "get_experiment": get_experiment,
        "get_metrics": get_metrics,
    }
