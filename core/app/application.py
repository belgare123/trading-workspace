"""
Application — главный класс приложения.

Объединяет Container, Lifecycle, Bootstrap и HealthRegistry.
Является единой точкой входа для всех режимов (live, replay, backtest).
"""

from __future__ import annotations

import asyncio
import logging
import os
import signal
import sys
import time
from typing import TYPE_CHECKING, Any, Callable

from core.api import (
    IContextEngine,
    IDecisionEngine,
    IEventBus,
    IFeatureEngine,
    IStrategyEngine,
)
from core.app.bootstrap import (
    CHANNELS, EXTRA_TFS, OB_SYMBOLS, TOP_SYMBOLS,
    bootstrap_app,
)
from core.app.health import HealthRegistry, HealthStatus
from core.app.lifecycle import Lifecycle, LifecycleStage
from core.app.phases import Phase
from core.di.container import Container, _log_task_exception

if TYPE_CHECKING:
    from core.services import IService

logger = logging.getLogger(__name__)


class Application:
    """Приложение Crypto Screener.

    Usage:
        app = Application()

        # Вариант 1: полный lifecycle
        await app.bootstrap()
        await app.start()
        await app.run()

        # Вариант 2: быстро (bootstrap + start + run)
        await app.launch()

        # Вариант 3: только регистрация (для тестов)
        await app.bootstrap()

    """

    def __init__(self, container: Container | None = None):
        self.container = container or Container()
        self.lifecycle = Lifecycle()
        self._health = HealthRegistry()
        self._services: dict[str, IService] = {}
        self._shutdown_event = asyncio.Event()
        self._shutdown_timeout: float = 10.0
        # Metrics counters (lazy init via _init_metrics)
        self._metrics: dict[str, Any] = {}
        self._metrics_inited = False

    # ── Свойства ──

    @property
    def is_running(self) -> bool:
        return self.lifecycle.is_running

    @property
    def stage(self) -> LifecycleStage:
        return self.lifecycle.stage

    def require(self, name: str) -> Any:
        """Получить компонент из контейнера (raise если нет)."""
        return self.container.require(name)

    def get(self, name: str, default: Any = None) -> Any:
        """Получить компонент из контейнера (default если нет)."""
        return self.container.get(name, default)

    def _init_metrics(self) -> None:
        """Lazy-init counters из MetricsRegistry в контейнере."""
        if self._metrics_inited:
            return
        self._metrics_inited = True
        reg = self.container.get("metrics_registry", None)
        if reg is None:
            return
        self._metrics["reconnect_total"] = reg.counter(
            "gateway_reconnect_total",
            "Total WebSocket reconnection attempts",
        )
        self._metrics["gateway_errors_total"] = reg.counter(
            "gateway_errors_total",
            "Total gateway errors (API/auth/WS failures)",
        )
        self._metrics["strategy_exceptions_total"] = reg.counter(
            "strategy_exceptions_total",
            "Total unhandled strategy exceptions",
        )
        self._metrics["runtime_restart_total"] = reg.counter(
            "runtime_restart_total",
            "Total runtime restarts / recovery cycles",
        )

    def inc_gateway_error(self, amount: float = 1.0) -> None:
        """Increment gateway error counter (call from bridge/TS)."""
        self._init_metrics()
        reg = self.container.get("metrics_registry", None)
        if reg is not None:
            reg.inc("gateway_errors_total", amount)

    def inc_reconnect(self, amount: float = 1.0) -> None:
        """Increment reconnect counter (call from bridge/TS)."""
        self._init_metrics()
        reg = self.container.get("metrics_registry", None)
        if reg is not None:
            reg.inc("gateway_reconnect_total", amount)

    def inc_strategy_exception(self, amount: float = 1.0) -> None:
        """Increment strategy exception counter."""
        self._init_metrics()
        reg = self.container.get("metrics_registry", None)
        if reg is not None:
            reg.inc("strategy_exceptions_total", amount)

    # ── Bootstrap — регистрация компонентов ──

    async def bootstrap(self, registrar: Callable[[Container], None] | None = None) -> None:
        """Фаза регистрации всех компонентов.

        Args:
            registrar: Функция регистрации (по умолчанию bootstrap_app).
                      Можно передать свою для тестов или частичной загрузки.
        """
        if self.lifecycle.stage != LifecycleStage.INIT:
            raise RuntimeError(
                f"Cannot bootstrap from stage {self.lifecycle.stage.name}"
            )

        await self.lifecycle.bootstrap()
        try:
            # Основная регистрация
            (registrar or bootstrap_app)(self.container)

            # Регистрируем сервисы в HealthRegistry
            self._register_health_checks()

            # Сигнал подписчикам
            await self.lifecycle.emit("on_bootstrap", self.container)

            await self.lifecycle.transition_to(LifecycleStage.BOOTSTRAPPED)
            logger.info("[app] Bootstrap complete — %d interfaces, %d named components",
                        len(self.container._registry), len(self.container._components))
        except Exception as e:
            logger.exception("[app] Bootstrap failed")
            await self.lifecycle.error()
            raise

    # ── Start — запуск сервисов ──

    async def start(self) -> None:
        """Фаза запуска сервисов.

        Выполняет в порядке:
        1. ContextEngine.start()
        2. Exchange subscribe + start
        3. Scanner start
        4. BatchFeatureUpdater.start()
        5. StrategyEngine.start()
        6. Telegram setup + start + polling
        7. StateEngine background loop
        8. Analytics (SignalRecorder, WinRateChecker, StatsReporter)
        9. Metrics server
        10. Background tickers
        11. Warmup (REST)
        """
        if self.lifecycle.stage != LifecycleStage.BOOTSTRAPPED:
            raise RuntimeError(
                f"Cannot start from stage {self.lifecycle.stage.name}"
            )

        await self.lifecycle.start()
        try:
            self.container.loop_start_time = asyncio.get_event_loop().time()

            # ── 1. ContextEngine start ──
            await self._start_context_engine()

            # ── 2. Exchange — subscribe + start ──
            await self._start_exchange()

            # ── 3. Scanner start ──
            await self._start_scanners()

            # ── 4. BatchFeatureUpdater start ──
            await self._start_batch_updater()

            # ── 5. StrategyEngine start ──
            await self._start_strategy_engine()

            # ── 6. Telegram ──
            await self._start_telegram()

            # ── 7. StateEngine background loop ──
            self._start_state_engine()

            # ── 8. Analytics ──
            await self._start_analytics()

            # ── 9. Metrics server ──
            await self._start_metrics_server()

            # ── 10. Background tickers ──
            self._start_tickers()

            # ── 11. Warmup (REST) ──
            await self._warmup_feature_engine()

            await self.lifecycle.emit("on_start", self.container)
            await self.lifecycle.running()
            logger.info("[app] All services started")
        except Exception as e:
            logger.exception("[app] Start failed")
            await self.lifecycle.error()
            raise

    async def _start_context_engine(self) -> None:
        """Start ContextEngine."""
        ce = self.container.get("context_engine")
        if ce and hasattr(ce, "start"):
            await ce.start()
            logger.info("[app] ContextEngine started")

    async def _start_exchange(self) -> None:
        """Exchange subscribe + start."""
        exchange = self.container.require("exchange")
        bus = self.container.require("bus")

        for ch in CHANNELS:
            params = "1" if ch == "candles" else None
            await exchange.subscribe(ch, TOP_SYMBOLS, params=params)
        for tf in EXTRA_TFS:
            await exchange.subscribe("candles", TOP_SYMBOLS, params=tf)
        await exchange.subscribe("orderbook", OB_SYMBOLS, params="50")
        logger.info("[app] Subscribed: %d channels × %d symbols",
                     len(CHANNELS), len(TOP_SYMBOLS))

        # Strategy Engine on_event subscription
        strategy_engine = self.container.get("strategy_engine")
        if strategy_engine:
            bus.subscribe("candles.*", strategy_engine.on_event)
            bus.subscribe("trades.*", strategy_engine.on_event)

        await exchange.start()
        logger.info("[app] Exchange started")

    async def _start_scanners(self) -> None:
        """Start all scanners."""
        bus = self.container.require("bus")

        from scanner.trades import TradeScanner
        from scanner.candles import CandleScanner
        from scanner.ticker import TickerScanner, LiquidationScanner
        from scanner.orderbook import OrderBookScanner as _OBS

        scanners = [
            CandleScanner(bus=bus),
            TickerScanner(),
            TradeScanner(bus=bus),
            LiquidationScanner(),
            _OBS(bus=bus),
        ]
        for s in scanners:
            await s.start()
        logger.info("[app] All scanners started")

    async def _start_batch_updater(self) -> None:
        """Start BatchFeatureUpdater if present."""
        bu = self.container.get("batch_updater")
        if bu and hasattr(bu, "start"):
            await bu.start()
            logger.info("[app] BatchFeatureUpdater started")

    async def _start_strategy_engine(self) -> None:
        """Start StrategyEngine."""
        se = self.container.get("strategy_engine")
        if se and hasattr(se, "start"):
            await se.start()
            logger.info("[app] StrategyEngine started")

    async def _start_telegram(self) -> None:
        """Setup and start Telegram layer."""
        # Settings DB
        settings_db = self.container.get("settings_db")
        if settings_db and hasattr(settings_db, "start"):
            await settings_db.start()

        # Router attachment
        notifier = self.container.get("notifier")
        telegram_router = self.container.get("telegram_router")
        if notifier and telegram_router and hasattr(notifier, "attach_router"):
            await notifier.attach_router(telegram_router)

        # Notifier start
        if notifier and hasattr(notifier, "start"):
            await notifier.start()

        # Polling
        if notifier and hasattr(notifier, "start_polling"):
            await notifier.start_polling()
            logger.info("[app] Telegram polling started")

    def _start_state_engine(self) -> None:
        """Start StateEngine background loop as task."""
        state_engine = self.container.get("state_engine")
        if state_engine and hasattr(state_engine, "start"):
            self.container.create_task(state_engine.start(), name="state_engine")
            logger.info("[app] StateEngine background loop started")

    async def _start_analytics(self) -> None:
        """Start analytics components."""
        recorder = self.container.get("signal_recorder")
        if recorder and hasattr(recorder, "start"):
            await recorder.start()

        winchecker = self.container.get("winchecker")
        if winchecker and hasattr(winchecker, "start"):
            await winchecker.start()

        stats = self.container.get("stats_reporter")
        if stats and hasattr(stats, "start"):
            await stats.start()
        logger.info("[app] Analytics started")

    async def _start_metrics_server(self) -> None:
        """Start metrics server."""
        metrics_server = self.container.get("metrics_server")
        if metrics_server and hasattr(metrics_server, "start"):
            await metrics_server.start()
            logger.info("[app] Metrics server started")

    def _start_tickers(self) -> None:
        """Start all background tickers."""
        self.container.create_task(self._health_ticker(), name="health")
        self.container.create_task(self._session_ticker(), name="session")
        self.container.create_task(self._correlation_ticker(), name="correlation")
        self.container.create_task(self._breadth_ticker(), name="breadth")
        self.container.create_task(self._heatmap_ticker(), name="heatmap")
        self.container.create_task(self._rotation_ticker(), name="rotation")
        self.container.create_task(self._liquidity_ticker(), name="liquidity")
        self.container.create_task(self._trend_ticker(), name="trend")
        self.container.create_task(self._lifecycle_ticker(), name="lifecycle")
        self.container.create_task(self._market_ticker(), name="market")
        self.container.create_task(self._replay_ticker(), name="replay")
        logger.info("[app] Background tickers started")

    async def _warmup_feature_engine(self) -> None:
        """Warmup FeatureEngine via REST."""
        fe = self.container.get("feature_engine")
        if fe is None:
            logger.info("[warmup] No FeatureEngine — skipping warmup")
            return

        from core.features.calculators.ohlcv import OHLCVFeatureCalculator
        from core import Event
        import aiohttp

        ohlcv = next(
            (calc for calc in fe._calculators if isinstance(calc, OHLCVFeatureCalculator)),
            None,
        )
        if ohlcv is None:
            logger.warning("[warmup] OHLCVFeatureCalculator not found, skipping")
            return

        symbols = TOP_SYMBOLS
        async with aiohttp.ClientSession() as session:
            for sym in symbols:
                try:
                    base, rest = sym.split("/", 1)
                    quote = rest.split(":", 1)[0]
                    raw = base + quote
                    url = (
                        "https://api.bybit.com/v5/market/kline"
                        f"?category=linear&symbol={raw}&interval=1&limit=200"
                    )
                    async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                        result = await resp.json()

                    if result.get("retCode") != 0:
                        logger.warning("[warmup] Bybit API error for %s: %s", raw, result.get("retMsg"))
                        continue

                    klines = result.get("result", {}).get("list", [])
                    if not klines:
                        continue

                    for k in reversed(klines):
                        candle = {
                            "t": int(k[0]),
                            "o": k[1], "h": k[2], "l": k[3], "c": k[4],
                            "v": k[5], "qv": k[6],
                        }
                        ev = Event(
                            channel=f"candles.1m.{sym}",
                            exchange="bybit", symbol=sym,
                            data=candle, ts=float(candle["t"]),
                        )
                        await ohlcv.on_event(ev)

                    ohlcv._last_compute.pop(sym, None)
                    await ohlcv.compute_if_expired(sym)
                    for calc in fe._calculators:
                        if calc is not ohlcv:
                            calc._last_compute.pop(sym, None)
                            await calc.compute_if_expired(sym)

                    logger.info("[warmup] Loaded %d 1m candles for %s", len(klines), sym)
                except Exception:
                    logger.exception("[warmup] Failed to warmup %s", sym)

        warmed = sum(1 for s in symbols if ohlcv._last_candle.get((s, "1m")))
        logger.info("[warmup] FeatureEngine warmup complete (%d/%d symbols)", warmed, len(symbols))

    # ── Run — основной цикл ──

    async def run(self, shutdown_timeout: float = 10.0) -> None:
        """Основной цикл приложения.

        Ожидает сигнал завершения (SIGINT/SIGTERM) и
        корректно останавливает все сервисы.
        """
        if self.lifecycle.stage != LifecycleStage.RUNNING:
            raise RuntimeError(
                f"Cannot run from stage {self.lifecycle.stage.name}"
            )

        self._shutdown_timeout = shutdown_timeout
        self._setup_signal_handlers()

        logger.info("[app] Application running (PID %d)", os.getpid())

        try:
            await self._shutdown_event.wait()
        except asyncio.CancelledError:
            logger.info("[app] Application cancelled")
        finally:
            await self.shutdown()

    async def shutdown(self) -> None:
        """Корректная остановка всех сервисов."""
        if self.lifecycle.is_stopped:
            return

        logger.info("[app] Shutting down...")
        await self.lifecycle.stop()

        try:
            # Отмена фоновых задач
            await self.container.cancel_all_tasks()

            await self.lifecycle.emit("on_stop", self.container)
            await self.lifecycle.stopped()
            logger.info("[app] Shutdown complete")
        except Exception as e:
            logger.exception("[app] Shutdown error")
            await self.lifecycle.error()
            raise

    # ── Launch — полный lifecycle ──

    async def launch(
        self,
        registrar: Callable[[Container], None] | None = None,
        shutdown_timeout: float = 10.0,
    ) -> None:
        """Полный lifecycle: bootstrap → start → run.

        Args:
            registrar: Функция регистрации компонентов.
            shutdown_timeout: Таймаут на остановку сервисов.
        """
        await self.bootstrap(registrar)
        await self.start()
        await self.run(shutdown_timeout)

    # ── Health ──

    async def health(self) -> dict[str, Any]:
        """Получить агрегированный статус приложения."""
        return await self._health.summary()

    async def check(self, name: str) -> HealthStatus:
        """Проверить здоровье конкретного компонента."""
        return await self._health.check(name)

    # ── Service registration ──

    def register_service(self, name: str, service: IService) -> None:
        """Зарегистрировать сервис для управления жизненным циклом."""
        self._services[name] = service
        self._health.register(name, service)

    def _register_health_checks(self) -> None:
        """Register health checks for known components."""
        def _wrap_health(obj: Any, name: str):
            """Wrap a component's health check, using health() if available, else status()."""
            if hasattr(obj, "health"):
                return obj.health
            if hasattr(obj, "status"):
                return lambda: {"status": "ok", "detail": f"{name} running"} if obj else {"status": "error", "detail": f"{name} not available"}
            return lambda: {"status": "ok", "detail": f"{name} running"}

        # Exchange
        exchange = self.container.get("exchange")
        if exchange:
            self._health.register("exchange", _wrap_health(exchange, "exchange"))

        # FeatureEngine
        fe = self.container.get("feature_engine")
        if fe:
            self._health.register("feature_engine", _wrap_health(fe, "feature_engine"))

        # StrategyEngine
        se = self.container.get("strategy_engine")
        if se:
            self._health.register("strategy_engine", _wrap_health(se, "strategy_engine"))

        # Telegram
        notifier = self.container.get("notifier")
        if notifier:
            self._health.register("telegram", _wrap_health(notifier, "telegram"))

    # ── Signal handling ──

    def _setup_signal_handlers(self) -> None:
        """Настроить обработчики сигналов ОС."""
        try:
            loop = asyncio.get_event_loop()

            if sys.platform != "win32":
                for sig in (signal.SIGTERM, signal.SIGINT):
                    loop.add_signal_handler(sig, self._signal_handler)
                logger.debug("[app] Signal handlers registered (SIGTERM, SIGINT)")
            else:
                # Windows: signal handlers работают иначе
                signal.signal(signal.SIGTERM, self._signal_handler_sync)
                signal.signal(signal.SIGINT, self._signal_handler_sync)
                logger.debug("[app] Signal handlers registered (Windows)")
        except Exception as e:
            logger.warning("[app] Could not register signal handlers: %s", e)

    def _signal_handler(self) -> None:
        """Async-safe обработчик сигнала."""
        logger.info("[app] Signal received, initiating shutdown...")
        self._shutdown_event.set()

    def _signal_handler_sync(self, signum, frame) -> None:
        """Sync обработчик для Windows."""
        logger.info("[app] Signal %s received, initiating shutdown...", signum)
        task = asyncio.create_task(self._async_shutdown_from_signal())
        task.add_done_callback(_log_task_exception)

    async def _async_shutdown_from_signal(self) -> None:
        self._shutdown_event.set()

    # ── Background tickers (from old bootstrap.py) ──

    async def _health_ticker(self) -> None:
        """Health check каждые 30 сек."""
        await asyncio.sleep(2)
        while True:
            await asyncio.sleep(30)
            try:
                c = self.container
                rs_engine = c.get("rs_engine")
                sector_engine = c.get("sector_engine")
                correlation_engine = c.get("correlation_engine")
                breadth_engine = c.get("breadth_engine")
                feature_engine = c.get("feature_engine")
                strategy_engine = c.get("strategy_engine")
                session_engine = c.get("session_engine")
                heatmap_engine = c.get("heatmap_engine")

                _rs_top, _rs_bot = rs_engine.get_ranking("rs_5m_pct", top_n=3) if rs_engine else ([], [])
                rs_top = ",".join(r["symbol"].split("/")[0] for r in _rs_top) if _rs_top else "?"
                _sector_snap = sector_engine.scan(_rs_top) if _rs_top else None
                sector_leader = _sector_snap.leading_sector if _sector_snap and _sector_snap.sectors else "?"

                logger.info(
                    "[health] strategies=%d session=%s rs_top=%s sector=%s feat_cache=%d",
                    len(strategy_engine._strategies) if strategy_engine else 0,
                    session_engine.session_name if session_engine else "?",
                    rs_top,
                    sector_leader,
                    feature_engine.store.stats()["alive"] if feature_engine else 0,
                )

                b = breadth_engine.last_snapshot
                h = heatmap_engine.last_snapshot
                router = c.get("telegram_router")
                if router:
                    router._health_cache = {
                        "uptime": f"{asyncio.get_event_loop().time() - c.loop_start_time:.0f}s",
                        "strategies": len(strategy_engine._strategies) if strategy_engine else 0,
                        "session": session_engine.session_name if session_engine else "?",
                        "rs_top": rs_top,
                        "sector": sector_leader,
                        "breadth": f"{b.pct_green}%" if b.total > 0 else "?",
                        "heatmap_volume": f"{h.top_volume[0]['symbol']} {h.top_volume[0]['volume_usdt']/1_000_000:.1f}M"
                        if h.top_volume else "?",
                    }

                # Log metrics counters
                self._init_metrics()
                reg = self.container.get("metrics_registry", None)
                if reg is not None:
                    reconn = reg.counter("gateway_reconnect_total").value()
                    gw_err = reg.counter("gateway_errors_total").value()
                    logger.info(
                        "[health] metrics: reconnects=%d gateway_errors=%d",
                        reconn, gw_err,
                    )
            except Exception:
                logger.exception("[health] ticker error")

    async def _session_ticker(self) -> None:
        """Сессия — раз в 60 сек."""
        while True:
            await asyncio.sleep(60)
            se = self.container.get("session_engine")
            if se:
                try:
                    await se.tick()
                except Exception:
                    logger.exception("[session] ticker error")

    async def _correlation_ticker(self) -> None:
        """Корреляция + RS — раз в 2 сек."""
        while True:
            await asyncio.sleep(2)
            try:
                corr = self.container.get("correlation_engine")
                rs = self.container.get("rs_engine")
                ts = self.container.get("ticker_store")
                if not corr or not rs or not ts:
                    continue
                prices = {}
                for sym in corr.TRACKED_SYMBOLS:
                    t = ts.get(sym)
                    if t:
                        price = t.get("lastPrice", t.get("last_price"))
                        if price and float(price) > 0:
                            prices[sym] = float(price)
                await corr.tick(prices)
                rs.update(prices)
            except Exception:
                logger.exception("[correlation] ticker error")

    async def _breadth_ticker(self) -> None:
        """Breadth — раз в 60 сек + сигнал."""
        while True:
            await asyncio.sleep(60)
            try:
                breadth = self.container.get("breadth_engine")
                engine = self.container.get("signal_engine")
                if breadth and engine:
                    snap = breadth.tick()
                    sig = breadth.to_signal()
                    if sig:
                        await engine.push_signal(sig)
            except Exception:
                logger.exception("[breadth] ticker error")

    async def _heatmap_ticker(self) -> None:
        """Heatmap — раз в 60 сек + сигнал."""
        while True:
            await asyncio.sleep(60)
            try:
                heatmap = self.container.get("heatmap_engine")
                if heatmap:
                    heatmap.tick()
            except Exception:
                logger.exception("[heatmap] ticker error")

    async def _rotation_ticker(self) -> None:
        """Rotation — раз в 60 сек."""
        while True:
            await asyncio.sleep(60)
            try:
                rotation = self.container.get("rotation_detector")
                if rotation:
                    await rotation.tick()
            except Exception:
                logger.exception("[rotation] ticker error")

    async def _liquidity_ticker(self) -> None:
        """Liquidity Zones — раз в 2 сек."""
        while True:
            await asyncio.sleep(2)
            try:
                liq = self.container.get("liquidity_engine")
                if liq:
                    liq.tick()
            except Exception:
                logger.exception("[liquidity] ticker error")

    async def _trend_ticker(self) -> None:
        """Trend Strength — раз в 5 сек."""
        while True:
            await asyncio.sleep(5)
            try:
                trend = self.container.get("trend_engine")
                if trend:
                    await trend.tick()
            except Exception:
                logger.exception("[trend] ticker error")

    async def _lifecycle_ticker(self) -> None:
        """Signal Lifecycle — раз в 10 сек."""
        while True:
            await asyncio.sleep(10)
            try:
                lc = self.container.get("lifecycle_engine")
                if lc:
                    await lc.tick()
            except Exception:
                logger.exception("[lifecycle] ticker error")

    async def _market_ticker(self) -> None:
        """Market Analysis — раз в 60 сек."""
        while True:
            await asyncio.sleep(60)
            try:
                ma = self.container.get("analysis_engine")
                if ma:
                    await ma.tick()
            except Exception:
                logger.exception("[market] ticker error")

    async def _replay_ticker(self) -> None:
        """Replay — раз в 60 сек."""
        while True:
            await asyncio.sleep(60)
            try:
                replay = self.container.get("replay_engine")
                if replay:
                    await replay.tick()
            except Exception:
                logger.exception("[replay] ticker error")


# ── Функции быстрого запуска ──


async def run_app(
    registrar: Callable[[Container], None] | None = None,
    shutdown_timeout: float = 10.0,
) -> None:
    """Быстрый запуск приложения.

    Создаёт Application, запускает полный lifecycle.
    """
    app = Application()
    await app.launch(registrar, shutdown_timeout)
