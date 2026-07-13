"""
Tests for Strategy Engine (Phase 4.5).
"""

import asyncio
from unittest.mock import MagicMock

import pytest

from core.strategy import (
    BaseStrategy,
    EngineConfig,
    MockExchangeAPI,
    MockFeatureAPI,
    MockMarketAPI,
    MockStateAPI,
    PluginInfo,
    PluginLoader,
    Signal,
    SignalBundle,
    SignalDirection,
    StrategyDescriptor,
    StrategyEngine,
    ManifestLoader,
    StrategyCategory,
)


# ═══════════════════════════════════════════════════════════════════
#  Fixtures
# ═══════════════════════════════════════════════════════════════════


@pytest.fixture
def mock_apis():
    return {
        "features": MockFeatureAPI(),
        "market": MockMarketAPI(),
        "exchange": MockExchangeAPI(name="Bybit", mode="paper"),
    }


class EmptyStrat(BaseStrategy):
    """Стратегия без сигналов."""

    async def analyze(self, ctx):
        return SignalBundle(strategy=self.name)


class SignalStrat(BaseStrategy):
    """Стратегия с одним сигналом."""

    async def analyze(self, ctx):
        return SignalBundle(
            strategy=self.name,
            signals=[
                Signal(
                    symbol="BTC/USDT",
                    direction=SignalDirection.LONG,
                    score=80.0,
                    confidence=70.0,
                )
            ],
        )


class FailingStrat(BaseStrategy):
    """Стратегия с ошибкой в analyze."""

    async def analyze(self, ctx):
        msg = "test error"
        raise RuntimeError(msg)


@pytest.fixture
def engine(mock_apis):
    eng = StrategyEngine(
        config=EngineConfig(tick_interval=0),
        feature_api=mock_apis["features"],
        market_api=mock_apis["market"],
        exchange_api=mock_apis["exchange"],
    )
    return eng


def _make_manifest(name: str, category: str = "momentum") -> StrategyDescriptor:
    return ManifestLoader.from_dict({"name": name, "category": category})


# ═══════════════════════════════════════════════════════════════════
#  Mock APIs
# ═══════════════════════════════════════════════════════════════════


class TestMockFeatureAPI:
    """Тесты встроенной FeatureAPI."""

    @pytest.mark.asyncio
    async def test_get_and_has(self):
        api = MockFeatureAPI()
        api._data["ema|BTC/USDT|period=20"] = 45000.0
        api._data["rsi"] = 55.0

        assert await api.get("ema", symbol="BTC/USDT", period=20) == 45000.0
        assert await api.get("rsi") == 55.0
        assert await api.get("nonexistent") is None
        assert await api.has("ema") is True
        assert await api.has("nonexistent") is False

    @pytest.mark.asyncio
    async def test_get_candles(self):
        api = MockFeatureAPI()
        candles = [{"close": i} for i in range(10)]
        api._data["candles|BTC/USDT|timeframe=1h"] = candles

        result = await api.get_candles("BTC/USDT", limit=5)
        assert len(result) == 5
        assert result[0]["close"] == 0

    def test_latest(self):
        api = MockFeatureAPI()
        api._latest["price|BTC/USDT"] = 42000.0
        assert api.latest("price", symbol="BTC/USDT") == 42000.0
        assert api.latest("nonexistent") is None


class TestMockMarketAPI:
    """Тесты встроенной MarketAPI."""

    @pytest.mark.asyncio
    async def test_price(self):
        api = MockMarketAPI()
        await api.init(prices={"BTC/USDT": 42000.0})
        assert await api.price("BTC/USDT") == 42000.0
        assert await api.price("ETH/USDT") is None


class TestMockStateAPI:
    """Тесты встроенной StateAPI."""

    def test_basic(self):
        api = MockStateAPI()
        api.set("count", 0)
        assert api.get("count") == 0
        api.increment("count")
        assert api.get("count") == 1
        assert "count" in api.keys()

    def test_reset(self):
        api = MockStateAPI()
        api.set("key", "value")
        api.reset()
        assert api.get("key") is None


class TestMockExchangeAPI:
    """Тесты встроенной ExchangeAPI."""

    @pytest.mark.asyncio
    async def test_basic(self):
        api = MockExchangeAPI(name="Bybit", mode="paper")
        assert await api.name() == "Bybit"
        assert api.mode == "paper"
        assert await api.is_trading("BTC/USDT") is True


# ═══════════════════════════════════════════════════════════════════
#  PluginLoader
# ═══════════════════════════════════════════════════════════════════


class TestPluginLoader:
    """Тесты PluginLoader."""

    @pytest.mark.asyncio
    async def test_discover_momentum(self):
        """Должен найти Momentum стратегию."""
        loader = PluginLoader("strategies")
        plugins = await loader.discover()
        names = [p.descriptor.name for p in plugins]
        assert "Momentum" in names

    @pytest.mark.asyncio
    async def test_discover_nonexistent_dir(self):
        """Не должен падать при отсутствии директории."""
        loader = PluginLoader("/nonexistent/path")
        plugins = await loader.discover()
        assert len(plugins) == 0

    def test_import_nonexistent_module(self):
        """Должен падать при отсутствии strategy.py."""
        info = PluginInfo(
            descriptor=_make_manifest("Nonexistent"),
            manifest_path="/fake/manifest.yaml",
            strategy_dir="/fake",
            module_path=None,
        )
        loader = PluginLoader()
        with pytest.raises(ImportError, match="No strategy.py"):
            loader.import_strategy(info)


# ═══════════════════════════════════════════════════════════════════
#  StrategyEngine
# ═══════════════════════════════════════════════════════════════════


class TestStrategyEngine:
    """Тесты StrategyEngine."""

    @pytest.mark.asyncio
    async def test_empty_engine(self, engine):
        """Пустой engine работает без стратегий."""
        h = await engine.health()
        assert h["strategy_count"] == 0

    @pytest.mark.asyncio
    async def test_manual_strategies(self, engine):
        """Ручная загрузка стратегий."""
        s1 = EmptyStrat(name="Empty")
        s1._manifest = _make_manifest("Empty")

        engine._strategies["Empty"] = s1
        assert engine.count == 1
        assert engine.get("Empty") is s1

    @pytest.mark.asyncio
    async def test_full_lifecycle(self, engine):
        """Полный lifecycle: init → start → analyze → stop."""
        s1 = EmptyStrat(name="Empty")
        s2 = SignalStrat(name="Signals")
        s1._manifest = _make_manifest("Empty")
        s2._manifest = _make_manifest("Signals")

        engine._strategies["Empty"] = s1
        engine._strategies["Signals"] = s2

        await engine.initialize_all()
        assert s1.state == "initialized"
        assert s2.state == "initialized"

        await engine.start_all()
        assert engine.is_running
        assert s1.state == "running"
        assert s2.state == "running"

        results = await engine.analyze_all()
        assert "Empty" in results
        assert "Signals" in results
        assert results["Empty"].count == 0
        assert results["Signals"].count == 1

        await engine.stop_all()
        assert not engine.is_running
        assert s1.state == "stopped"

    @pytest.mark.asyncio
    async def test_analyze_one(self, engine):
        """analyze_one: существующая, с сигналами, отсутствующая."""
        s1 = SignalStrat(name="Signals")
        s1._manifest = _make_manifest("Signals")
        engine._strategies["Signals"] = s1

        await engine.initialize_all()
        await engine.start_all()

        bundle = await engine.analyze_one("Signals")
        assert bundle is not None
        assert bundle.count == 1

        assert await engine.analyze_one("NonExistent") is None

    @pytest.mark.asyncio
    async def test_error_handling(self, engine):
        """Ошибка в analyze не ломает engine."""
        s1 = FailingStrat(name="Failing")
        s1._manifest = _make_manifest("Failing")
        engine._strategies["Failing"] = s1

        await engine.initialize_all()
        await engine.start_all()

        # Ошибка должна вернуть пустой bundle, не упасть
        results = await engine.analyze_all()
        assert "Failing" in results
        assert results["Failing"].count == 0
        assert results["Failing"].strategy == "Failing"

    @pytest.mark.asyncio
    async def test_health_metrics(self, engine):
        """health() и metrics() возвращают данные."""
        s1 = SignalStrat(name="Signals")
        s1._manifest = _make_manifest("Signals")
        engine._strategies["Signals"] = s1

        await engine.initialize_all()
        await engine.start_all()
        await engine.analyze_all()

        h = await engine.health()
        assert h["strategy_count"] == 1
        assert h["running"] == 1
        assert h["state"] == "running"

        m = await engine.metrics()
        assert m["strategy_count"] == 1
        assert m["total_signals"] >= 1

    @pytest.mark.asyncio
    async def test_on_signal_callback(self, engine):
        """Callback вызывается для каждого сигнала."""
        received = []

        def callback(signal):
            received.append(signal)

        engine._config.on_signal = callback

        s1 = SignalStrat(name="Signals")
        s1._manifest = _make_manifest("Signals")
        engine._strategies["Signals"] = s1

        await engine.initialize_all()
        await engine.start_all()
        await engine.analyze_all()

        assert len(received) == 1
        assert received[0].direction == SignalDirection.LONG
        assert received[0].score == 80.0

    @pytest.mark.asyncio
    async def test_run_pipeline(self, engine):
        """run_pipeline(): load → init → start."""
        # Skip — для run_pipeline нужна реальная стратегия в filesystem
        pass

    @pytest.mark.asyncio
    async def test_discover(self):
        """discover() находит стратегии."""
        loader = PluginLoader("strategies")
        plugins = await loader.discover()
        assert len(plugins) >= 1
        # Проверяем, что Momentm найден
        assert any(p.descriptor.name == "Momentum" for p in plugins)
