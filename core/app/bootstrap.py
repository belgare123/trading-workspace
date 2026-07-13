"""
Bootstrap — чистая регистрация компонентов в Container.

В отличие от старого bootstrap.py, здесь:
- Нет запуска сервисов
- Нет warmup
- Нет event loop

Только регистрация графа зависимостей.
Каждая функция — pure registration (container.set()).

Порядок вызова важен: register_storage → register_bus → ... → register_outputs.
"""

from __future__ import annotations

import logging
from typing import Any

from core.api import (
    IContextEngine,
    IDecisionEngine,
    IEventBus,
    IFeatureEngine,
    IFeatureStore,
    IOutput,
    IStorage,
    IStrategyEngine,
)

logger = logging.getLogger(__name__)

# ── Константы ──
TOP_SYMBOLS = [
    "BTC/USDT:USDT", "ETH/USDT:USDT", "SOL/USDT:USDT",
    "XRP/USDT:USDT", "DOGE/USDT:USDT", "ADA/USDT:USDT",
    "AVAX/USDT:USDT", "DOT/USDT:USDT", "LINK/USDT:USDT",
    "SUI/USDT:USDT",
]
OB_SYMBOLS = ["BTC/USDT:USDT", "ETH/USDT:USDT"]
CHANNELS = ["candles", "trades", "ticker", "liquidation"]
EXTRA_TFS = ["5", "15"]


# ── Функции регистрации ──


def register_config(container: Any) -> None:
    """Зарегистрировать конфигурацию."""
    from config import settings
    container.register_instance("settings", settings)
    container.register_instance("top_symbols", TOP_SYMBOLS)
    container.register_instance("ob_symbols", OB_SYMBOLS)
    container.register_instance("channels", CHANNELS)
    container.register_instance("extra_tfs", EXTRA_TFS)
    logger.info("[bootstrap] Config registered")


def register_infrastructure(container: Any) -> None:
    """Зарегистрировать инфраструктуру (логирование, сигналы ОС)."""
    import logging as _logging
    import asyncio

    _logging.basicConfig(
        level=_logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    _logging.getLogger("websockets").setLevel(_logging.WARNING)
    _logging.getLogger("asyncio").setLevel(_logging.WARNING)

    container.loop_start_time = asyncio.get_event_loop().time()
    logger.info("[bootstrap] Infrastructure configured")


def register_bus(container: Any) -> None:
    """Зарегистрировать шину событий."""
    from core import get_bus

    bus = get_bus()
    container.register_instance("bus", bus)
    logger.info("[bootstrap] MarketDataBus registered")


def register_exchange(container: Any) -> None:
    """Зарегистрировать биржу."""
    from exchanges.bybit import BybitExchange

    exchange = BybitExchange()
    container.register_instance("exchange", exchange)
    logger.info("[bootstrap] BybitExchange registered")


def register_storage(container: Any) -> None:
    """Зарегистрировать хранилища данных."""
    from core.storage import (
        get_candle_store, get_ticker_store, get_ob_store,
        get_liquidation_store, get_whale_tracker,
    )

    container.register_instance("candle_store", get_candle_store())
    container.register_instance("ticker_store", get_ticker_store())
    container.register_instance("ob_store", get_ob_store())
    container.register_instance("liquidation_store", get_liquidation_store())
    container.register_instance("whale_tracker", get_whale_tracker())
    logger.info("[bootstrap] Storage registered")


def register_feature_engine(container: Any) -> None:
    """Зарегистрировать FeatureEngine + calculators."""
    from core.features import get_feature_engine
    from core.features.calculators.whale import WhaleFeatureCalculator
    from core.features.calculators.ohlcv import OHLCVFeatureCalculator
    from core.features.calculators.indicators import IndicatorsFeatureCalculator
    from core.features.calculators.orderbook import OrderBookFeatureCalculator
    from core.features.calculators.market import MarketFeatureCalculator
    from core.features.calculators.volatility import VolatilityFeatureCalculator

    try:
        fe = get_feature_engine()
        fe.register(WhaleFeatureCalculator())
        fe.register(OHLCVFeatureCalculator())
        fe.register(IndicatorsFeatureCalculator())
        fe.register(OrderBookFeatureCalculator())
        fe.register(MarketFeatureCalculator())
        fe.register(VolatilityFeatureCalculator())

        n_calcs = len(fe._calculators)
        n_feats = sum(len(calc.feature_names) for calc in fe._calculators)
        logger.info(
            "[bootstrap] FeatureEngine registered: %d calculators, %d features",
            n_calcs, n_feats,
        )
        container.register_instance("feature_engine", fe)
    except Exception:
        logger.exception("[bootstrap] FeatureEngine init failed — continuing without it")
        container.register_instance("feature_engine", None)


def register_batch_updater(container: Any) -> None:
    """Зарегистрировать BatchFeatureUpdater."""
    fe = container.get("feature_engine")
    if fe is None:
        logger.info("[bootstrap] No FeatureEngine — skipping BatchFeatureUpdater")
        container.register_instance("batch_updater", None)
        return

    from core.features.batch_updater import BatchFeatureUpdater

    updater = BatchFeatureUpdater(feature_engine=fe, interval=5.0)
    container.register_instance("batch_updater", updater)
    logger.info("[bootstrap] BatchFeatureUpdater registered (interval=5.0s)")


def register_state_engine(container: Any) -> None:
    """Зарегистрировать StateEngine."""
    from core.state import get_state_engine

    se = get_state_engine()
    container.register_instance("state_engine", se)
    logger.info("[bootstrap] StateEngine registered (shadow=%s)", se.shadow)


def register_context_engine(container: Any) -> None:
    """Зарегистрировать ContextEngine."""
    from context import ContextEngine

    ce = ContextEngine(
        feature_store=container.get("feature_store"),
        session_engine=container.get("session_engine"),
        bus=container.get("bus"),
        default_ttl=30.0,
    )
    container.register_instance("context_engine", ce)
    logger.info("[bootstrap] ContextEngine registered (TTL=30s)")


def register_decision_engine(container: Any) -> None:
    """Зарегистрировать DecisionEngine."""
    from core.decision import DecisionEngine

    ce = DecisionEngine(
        context_engine=container.get("context_engine"),
        consensus_engine=container.get("consensus_engine"),
        feature_store=container.get("feature_store"),
        default_threshold=60.0,
    )
    container.register_instance("decision_engine", ce)
    logger.info("[bootstrap] DecisionEngine registered")


def register_strategy_engine(container: Any) -> None:
    """Зарегистрировать StrategyEngine."""
    from context import ContextEngine
    from strategies import StrategyEngine

    ce = container.get("context_engine")
    if ce is None:
        ce = ContextEngine(
            feature_store=container.get("feature_store"),
            bus=container.get("bus"),
            default_ttl=30.0,
        )
        container.register_instance("context_engine", ce)

    # Импорт стратегий триггерит @register_strategy
    import strategies.momentum_v2  # noqa: F401

    se = StrategyEngine(
        feature_engine=container.get("feature_engine"),
        context_engine=ce,
        notifier=container.get("notifier"),
        signal_engine=None,  # V1 SignalEngine removed in v0.10.0
    )
    se.register_all()
    from strategies import set_strategy_engine as _set_se
    _set_se(se)
    container.register_instance("strategy_engine", se)
    logger.info(
        "[bootstrap] StrategyEngine registered (%d strategies)",
        len(se._strategies),
    )


def register_services(container: Any) -> None:
    """Зарегистрировать фоновые сервисы (core/* engine'ы)."""
    from core.correlation import CorrelationEngine
    from core.rotation import RotationDetector
    from core.relative_strength import RelativeStrengthEngine
    from core.sector_scanner import SectorScannerEngine as SectorEngine
    from core.heatmap import HeatmapEngine
    from core.liquidity_zones import LiquidityZoneEngine
    from core.market_breadth import MarketBreadthEngine
    from core.trend_strength import TrendStrengthEngine
    from core.session import SessionEngine
    from core.signal_dna import DNAStore
    from core.signal_lifecycle import SignalLifecycleEngine
    from core.market_replay import MarketReplayEngine
    from core.market_analysis import ExpectedMoveEngine as MarketAnalysisEngine
    from core.pattern_similarity import PatternSimilarityEngine
    from core.ai_clustering import ClusteringEngine
    from core.exchanges import DataEngine

    ticker_store = container.require("ticker_store")
    candle_store = container.require("candle_store")
    ob_store = container.require("ob_store")
    bus = container.require("bus")

    def _ticker_all_getter():
        return ticker_store.all_sync()

    def _candle_getter(symbol: str, tf: str = "5m", limit: int = 100):
        return candle_store.get_sync(symbol, tf, limit)

    def _ob_getter(symbol: str):
        return ob_store.get_sync(symbol)

    def _liq_getter(minutes: int = 5):
        from core.storage import get_liquidation_store
        store = get_liquidation_store()
        return store.recent(minutes=minutes)

    # Session
    session_engine = SessionEngine()
    container.register_instance("session_engine", session_engine)

    # Correlation
    corr_engine = CorrelationEngine()
    container.register_instance("correlation_engine", corr_engine)

    # Relative Strength
    rs_engine = RelativeStrengthEngine(candle_store)
    container.register_instance("rs_engine", rs_engine)

    # Sector
    sector_engine = SectorEngine()
    container.register_instance("sector_engine", sector_engine)

    # Rotation
    rotation_detector = RotationDetector(sector_engine=sector_engine)
    container.register_instance("rotation_detector", rotation_detector)

    # Heatmap
    heatmap_engine = HeatmapEngine(
        ticker_getter=_ticker_all_getter,
        liq_getter=_liq_getter,
    )
    container.register_instance("heatmap_engine", heatmap_engine)

    # Liquidity Zones
    liquidity_engine = LiquidityZoneEngine(
        candle_getter=_candle_getter, ob_getter=_ob_getter,
    )
    container.register_instance("liquidity_engine", liquidity_engine)

    # Breadth
    breadth_engine = MarketBreadthEngine(ticker_getter=_ticker_all_getter)
    container.register_instance("breadth_engine", breadth_engine)

    # Trend Strength
    trend_engine = TrendStrengthEngine(candle_getter=_candle_getter)
    container.register_instance("trend_engine", trend_engine)

    # DNA Store + Lifecycle
    dna_store = DNAStore()
    lifecycle_engine = SignalLifecycleEngine()
    container.register_instance("dna_store", dna_store)
    container.register_instance("lifecycle_engine", lifecycle_engine)

    # Replay
    replay_engine = MarketReplayEngine()
    container.register_instance("replay_engine", replay_engine)

    # Market Analysis
    analysis_engine = MarketAnalysisEngine()
    container.register_instance("analysis_engine", analysis_engine)

    # AI Clustering
    clustering = ClusteringEngine(dna_store)
    container.register_instance("clustering_engine", clustering)

    # Pattern Similarity
    pattern_sim = PatternSimilarityEngine(dna_store)
    container.register_instance("pattern_sim", pattern_sim)

    # Data Engine
    data_engine = DataEngine()
    data_engine.add_exchange("bybit")
    data_engine.add_exchange("binance")
    data_engine.add_exchange("okx")
    data_engine.start()
    container.register_instance("data_engine", data_engine)

    # Metrics & Health
    from core.monitoring import MetricsServer, get_healthcheck, get_metrics_registry

    metrics_registry = get_metrics_registry()
    healthcheck = get_healthcheck()
    healthcheck.register("data_engine", lambda: {"status": "ok"})
    container.register_instance("metrics_registry", metrics_registry)
    container.register_instance("healthcheck", healthcheck)

    metrics_server = MetricsServer(host="0.0.0.0", port=9120)
    container.register_instance("metrics_server", metrics_server)

    # Risk Engine
    from core.risk import get_risk_engine, SpreadRule, ATRRule, LiquidityRule, SessionRule

    risk_engine = get_risk_engine(shadow=False)
    risk_engine.add_rule(SpreadRule())
    risk_engine.add_rule(ATRRule())
    risk_engine.add_rule(LiquidityRule())
    risk_engine.add_rule(SessionRule())
    container.register_instance("risk_engine", risk_engine)

    # Consensus Engine
    from core.consensus import get_consensus_engine, OpportunityRanking

    consensus_engine = get_consensus_engine(shadow=False)
    opportunity_rank = OpportunityRanking(window_minutes=10, top_k=3)
    container.register_instance("consensus_engine", consensus_engine)
    container.register_instance("opportunity_rank", opportunity_rank)

    # OME
    from core.ome import get_ome

    ome = get_ome(shadow=False, capital=1000.0, risk_pct=0.01)
    container.register_instance("ome", ome)

    # Learning Engine
    from core.learning import get_learning_engine

    learning = get_learning_engine(shadow=False)
    container.register_instance("learning_engine", learning)

    # Event Bus
    from events import get_event_bus

    event_bus = get_event_bus()
    container.register_instance("event_bus", event_bus)

    logger.info("[bootstrap] All background services registered")


def register_outputs(container: Any) -> None:
    """Зарегистрировать output-каналы (Telegram, API).

    Только регистрация. Start вызывается в lifecycle.
    """
    from core.signal.engine import SignalEngine as SignalEngineV2
    from alerts.telegram import TelegramNotifier
    from config import settings
    from storage.analytics import WinRateChecker, SignalRecorder, StatsReporter

    bus = container.require("bus")
    ticker_store = container.require("ticker_store")

    # V2 SignalEngine
    signal_engine = SignalEngineV2(
        risk_engine=container.get("risk_engine"),
        decision_engine=container.get("decision_engine"),
        ome=container.get("ome"),
        metrics_registry=container.get("metrics_registry"),
        shadow=False,
    )
    container.register_instance("signal_engine_v2", signal_engine)
    logger.info("[bootstrap] SignalEngineV2 registered (shadow=False)")

    # Telegram Notifier
    notifier = TelegramNotifier(
        token=settings.telegram_token,
        chat_id=str(settings.telegram_chat_id),
    )
    container.register_instance("notifier", notifier)

    # SignalRecorder + WinRateChecker + Stats
    async def _get_price(symbol: str) -> float | None:
        t = ticker_store.get(symbol)
        return t.get("last_price") if t else None

    recorder = SignalRecorder(ticker_getter=_get_price)
    container.register_instance("signal_recorder", recorder)

    winchecker = WinRateChecker(ticker_getter=_get_price)
    container.register_instance("winchecker", winchecker)

    stats = StatsReporter(recorder.db, notifier)
    container.register_instance("stats_reporter", stats)

    # Telegram handlers (settings_db, router)
    from alerts.handlers import setup_telegram_handlers
    from alerts.settings_db import UserSettingsDB
    from pathlib import Path as _Path

    db_path = settings.database_url.replace("sqlite+aiosqlite:///", "")
    settings_db_dir = _Path(db_path).parent
    settings_db = UserSettingsDB(settings_db_dir / "user_settings.db")
    container.register_instance("settings_db", settings_db)

    router = setup_telegram_handlers(settings_db, notifier)
    container.register_instance("telegram_router", router)

    # Recent signals listener (replaces V1 dispatcher listeners)
    recent_signals: list[dict] = []

    async def _on_signal(sig):
        recent_signals.append({
            "symbol": sig.symbol,
            "signal_name": sig.signal_name,
            "score": round(sig.score, 1),
            "direction": sig.direction or "neutral",
        })
        if len(recent_signals) > 20:
            recent_signals.pop(0)
        router._recent_signals = recent_signals

    notifier.register_signal_listener(_on_signal)
    notifier.register_signal_listener(recorder.on_signal)

    container.register_instance("_recent_signals", recent_signals)
    logger.info("[bootstrap] Outputs registered (Telegram + analytics)")


# ── Полная регистрация ──


def bootstrap_app(container: Any) -> None:
    """Полная регистрация всех компонентов (порядок важен)."""
    register_config(container)
    register_infrastructure(container)
    register_bus(container)
    register_exchange(container)
    register_storage(container)
    register_feature_engine(container)
    register_batch_updater(container)
    register_state_engine(container)
    register_context_engine(container)
    register_decision_engine(container)
    register_services(container)
    register_strategy_engine(container)
    register_outputs(container)
    logger.info("[bootstrap] All components registered successfully")
