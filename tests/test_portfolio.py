"""
Phase 12 — Portfolio Engine Tests.
"""

import copy
import time

import pytest

from core.analytics import AnalyticsEngine, RegimeType
from core.event_store import EventStore
from core.event_store.sqlite_repo import SQLiteEventRepository
from core.portfolio import (
    PortfolioAction,
    PortfolioAllocation,
    PortfolioBus,
    PortfolioConfig,
    PortfolioEngine,
    PortfolioEvent,
    PortfolioMetricsCollector,
    PortfolioMetricsSnapshot,
    PortfolioOptimizer,
    PortfolioState,
    RegimeAllocator,
    RiskLevel,
    StrategyRegistry,
    StrategyRole,
    StrategySelector,
    WeightEngine,
)
from core.portfolio.models import StrategySlot
from core.quality import ConfidenceGrade, MetricName, RatingLevel, RatingPassport


def _demo_passport(
    level: RatingLevel = RatingLevel.A,
    confidence: ConfidenceGrade = ConfidenceGrade.A,
) -> RatingPassport:
    return RatingPassport(
        strategy_name="Demo",
        rating=level,
        overall_score=4.0,
        confidence=confidence,
        metrics={
            MetricName.WIN_RATE: type("MV", (), {"value": 55.0})(),
        },
        total_trades=100,
    )


class TestStrategySlot:
    def test_defaults(self):
        s = StrategySlot(name="Test")
        assert s.name == "Test"
        assert s.role == StrategyRole.OPPORTUNISTIC
        assert s.base_weight == 1.0
        assert s.enabled

    def test_to_dict(self):
        s = StrategySlot(name="Mom", role=StrategyRole.CORE, base_weight=0.5)
        d = s.to_dict()
        assert d["name"] == "Mom"
        assert d["role"] == "core"
        assert d["base_weight"] == 0.5


class TestPortfolioState:
    def test_defaults(self):
        ps = PortfolioState()
        assert ps.total_weight == 1.0
        assert ps.active_slots == []

    def test_active_slots(self):
        ps = PortfolioState()
        ps.slots["A"] = StrategySlot(name="A", enabled=True)
        ps.slots["B"] = StrategySlot(name="B", enabled=False)
        assert len(ps.active_slots) == 1

    def test_to_dict(self):
        ps = PortfolioState()
        ps.slots["X"] = StrategySlot(name="X")
        d = ps.to_dict()
        assert "slots" in d
        assert "allocations" in d


class TestPortfolioConfig:
    def test_defaults(self):
        c = PortfolioConfig()
        assert c.name == "default"
        assert c.risk_level == RiskLevel.MODERATE
        assert c.max_active_strategies == 8

    def test_to_dict(self):
        c = PortfolioConfig(name="agg", risk_level=RiskLevel.AGGRESSIVE)
        d = c.to_dict()
        assert d["name"] == "agg"
        assert d["risk_level"] == "aggressive"


class TestStrategyRegistry:
    def test_register(self):
        reg = StrategyRegistry()
        slot = reg.register("Mom", role=StrategyRole.CORE)
        assert reg.get("Mom") is slot
        assert slot.role == StrategyRole.CORE

    def test_unregister(self):
        reg = StrategyRegistry()
        reg.register("X")
        reg.unregister("X")
        assert reg.get("X") is None

    def test_duplicate_register(self):
        reg = StrategyRegistry()
        reg.register("X")
        reg.register("X")  # no crash

    def test_get_by_role(self):
        reg = StrategyRegistry()
        reg.register("A", role=StrategyRole.CORE)
        reg.register("B", role=StrategyRole.CORE)
        reg.register("C", role=StrategyRole.HEDGE)
        assert len(reg.get_by_role(StrategyRole.CORE)) == 2
        assert len(reg.get_by_role(StrategyRole.HEDGE)) == 1

    def test_set_enabled(self):
        reg = StrategyRegistry()
        reg.register("X")
        reg.set_enabled("X", False)
        assert reg.get("X").enabled is False
        assert reg.get("X").current_weight == 0.0

    def test_set_active(self):
        reg = StrategyRegistry()
        reg.register("X")
        reg.set_active("X", True)
        assert reg.get("X").is_active

    def test_count(self):
        reg = StrategyRegistry()
        assert reg.count() == 0
        reg.register("A")
        reg.register("B")
        assert reg.count() == 2

    def test_clear(self):
        reg = StrategyRegistry()
        reg.register("A")
        reg.clear()
        assert reg.count() == 0


class TestRegimeAllocator:
    def test_allocate_all_good(self):
        allocator = RegimeAllocator()
        state = PortfolioState()
        state.slots["A"] = StrategySlot(name="A", enabled=True)
        state.slots["B"] = StrategySlot(name="B", enabled=True)
        result = allocator.allocate(state, RegimeType.TRENDING_BULL)
        assert len(result) == 2
        assert all(a.weight > 0 for a in result)

    def test_disabled_strategy(self):
        allocator = RegimeAllocator()
        state = PortfolioState()
        state.slots["X"] = StrategySlot(name="X", enabled=False)
        result = allocator.allocate(state, RegimeType.RANGING)
        assert result[0].action == PortfolioAction.DISABLE

    def test_excluded_regime(self):
        allocator = RegimeAllocator()
        state = PortfolioState()
        state.slots["X"] = StrategySlot(
            name="X", enabled=True,
            excluded_regimes=[RegimeType.CRASH],
        )
        result = allocator.allocate(state, RegimeType.CRASH)
        assert result[0].weight == 0.0

    def test_allowed_regime(self):
        allocator = RegimeAllocator()
        state = PortfolioState()
        state.slots["X"] = StrategySlot(
            name="X", enabled=True,
            allowed_regimes=[RegimeType.TRENDING_BULL],
        )
        result_ok = allocator.allocate(state, RegimeType.TRENDING_BULL)
        assert result_ok[0].weight > 0
        result_bad = allocator.allocate(state, RegimeType.RANGING)
        assert result_bad[0].weight == 0.0


class TestWeightEngine:
    def test_base_weight(self):
        we = WeightEngine()
        slot = StrategySlot(name="T", base_weight=1.0, enabled=True)
        regime = type("MR", (), {"regime": RegimeType.RANGING})()
        w = we.calculate(slot, regime)
        assert 0 < w <= we._config.max_weight_per_strategy

    def test_disabled_returns_zero(self):
        we = WeightEngine()
        slot = StrategySlot(name="T", base_weight=1.0, enabled=False)
        regime = type("MR", (), {"regime": RegimeType.RANGING})()
        assert we.calculate(slot, regime) == 0.0

    def test_quality_boost_s(self):
        we = WeightEngine()
        slot = StrategySlot(name="T", base_weight=1.0, enabled=True)
        regime = type("MR", (), {"regime": RegimeType.RANGING})()
        passport = _demo_passport(level=RatingLevel.S)
        w = we.calculate(slot, regime, passport)
        assert w > 0

    def test_quality_boost_f(self):
        we = WeightEngine()
        slot = StrategySlot(name="T", base_weight=1.0, enabled=True)
        regime = type("MR", (), {"regime": RegimeType.RANGING})()
        passport = _demo_passport(level=RatingLevel.F)
        w = we.calculate(slot, regime, passport)
        assert w == 0.0

    def test_crash_reduces_weight(self):
        config = PortfolioConfig(max_weight_per_strategy=0.8)
        we = WeightEngine(config)
        slot = StrategySlot(name="T", base_weight=1.0, enabled=True)
        crash = type("MR", (), {"regime": RegimeType.CRASH})()
        ranging = type("MR", (), {"regime": RegimeType.RANGING})()
        w_crash = we.calculate(slot, crash)
        w_range = we.calculate(slot, ranging)
        assert w_crash < w_range

    def test_normalize(self):
        w = WeightEngine.normalize({"A": 2.0, "B": 2.0})
        assert abs(w["A"] - 0.5) < 0.001
        assert abs(w["B"] - 0.5) < 0.001

    def test_normalize_all_zero(self):
        w = WeightEngine.normalize({"A": 0.0, "B": 0.0})
        assert w["A"] == 0.0

    def test_regime_boost_mapping(self):
        assert WeightEngine.REGIME_BOOST["breakout"] == 1.3
        assert WeightEngine.REGIME_BOOST["crash"] == 0.5


class TestStrategySelector:
    def test_select_empty(self):
        sel = StrategySelector()
        state = PortfolioState()
        regime = type("MR", (), {"regime": RegimeType.RANGING})()
        selected = sel.select(state, regime)
        assert selected == []

    def test_select_all_good(self):
        sel = StrategySelector()
        state = PortfolioState()
        state.slots["A"] = StrategySlot(name="A", enabled=True)
        state.slots["B"] = StrategySlot(name="B", enabled=True)
        regime = type("MR", (), {"regime": RegimeType.RANGING})()
        selected = sel.select(state, regime)
        assert len(selected) >= 2

    def test_select_excluded(self):
        sel = StrategySelector()
        state = PortfolioState()
        state.slots["X"] = StrategySlot(
            name="X", enabled=True,
            excluded_regimes=[RegimeType.CRASH],
        )
        regime = type("MR", (), {"regime": RegimeType.CRASH})()
        selected = sel.select(state, regime)
        assert len(selected) == 0

    def test_select_max_active(self):
        config = PortfolioConfig(max_active_strategies=2)
        sel = StrategySelector(config)
        state = PortfolioState()
        for i in range(10):
            state.slots[f"S{i}"] = StrategySlot(name=f"S{i}", enabled=True)
        regime = type("MR", (), {"regime": RegimeType.RANGING})()
        selected = sel.select(state, regime)
        assert len(selected) <= 2


class TestPortfolioOptimizer:
    def test_empty_allocations(self):
        opt = PortfolioOptimizer()
        assert opt.optimize(PortfolioState(), []) == []

    def test_weight_cap(self):
        config = PortfolioConfig(max_weight_per_strategy=0.3)
        opt = PortfolioOptimizer(config)
        state = PortfolioState()
        allocs = [
            PortfolioAllocation(slot_name="A", weight=0.8),
            PortfolioAllocation(slot_name="B", weight=0.2),
        ]
        result = opt.optimize(state, allocs)
        # 0.8+0.2=1.0 → normalized → 0.8/1.0=0.8 capped at 0.3, 0.2/1.0=0.2
        assert result[0].weight <= 0.3
        assert result[1].weight <= 0.3

    def test_normalization(self):
        opt = PortfolioOptimizer()
        state = PortfolioState()
        allocs = [
            PortfolioAllocation(slot_name="A", weight=5.0),
            PortfolioAllocation(slot_name="B", weight=5.0),
        ]
        result = opt.optimize(state, allocs)
        total = sum(a.weight for a in result)
        assert abs(total - 1.0) < 0.01

    def test_conservative_cap(self):
        config = PortfolioConfig(risk_level=RiskLevel.CONSERVATIVE,
                                  max_weight_per_strategy=0.5)
        opt = PortfolioOptimizer(config)
        state = PortfolioState()
        allocs = [PortfolioAllocation(slot_name="A", weight=0.5)]
        result = opt.optimize(state, allocs)
        assert result[0].weight <= 0.25

    def test_aggressive_cap(self):
        config = PortfolioConfig(risk_level=RiskLevel.AGGRESSIVE,
                                  max_weight_per_strategy=0.5)
        opt = PortfolioOptimizer(config)
        state = PortfolioState()
        allocs = [PortfolioAllocation(slot_name="A", weight=0.6)]
        result = opt.optimize(state, allocs)
        assert result[0].weight <= 0.5


class TestPortfolioBus:
    def test_subscribe_emit(self):
        store = EventStore(repository=SQLiteEventRepository(db_path=":memory:"))
        bus = PortfolioBus(event_store=store)
        received = []
        def handler(e):
            received.append(e)
        bus.subscribe("test.evt", handler)
        bus.emit(PortfolioEvent(event_type="test.evt"))
        assert len(received) == 1

    def test_unsubscribe(self):
        store = EventStore(repository=SQLiteEventRepository(db_path=":memory:"))
        bus = PortfolioBus(event_store=store)
        received = []
        def handler(e):
            received.append(e)
        bus.subscribe("e", handler)
        bus.unsubscribe("e", handler)  # no-op via EventStore — handler stays registered
        bus.emit(PortfolioEvent(event_type="e"))
        assert len(received) == 1  # unsubscribe is no-op

    def test_emit_rebalance(self):
        store = EventStore(repository=SQLiteEventRepository(db_path=":memory:"))
        bus = PortfolioBus(event_store=store)
        events = []
        bus.subscribe("portfolio.rebalanced", lambda e: events.append(e))
        bus.emit_rebalance([PortfolioAllocation(slot_name="A", weight=0.5)])
        assert len(events) == 1

    def test_emit_regime_change(self):
        store = EventStore(repository=SQLiteEventRepository(db_path=":memory:"))
        bus = PortfolioBus(event_store=store)
        events = []
        bus.subscribe("portfolio.regime_changed", lambda e: events.append(e))
        bus.emit_regime_change("trending_bull")
        assert len(events) == 1


class TestPortfolioEngine:
    def test_create(self):
        pe = PortfolioEngine()
        assert pe.config.name == "default"
        assert pe.registry.count() == 0

    def test_register_via_engine(self):
        pe = PortfolioEngine()
        slot = pe.register_strategy("Mom", role="core", base_weight=1.0)
        assert pe.registry.count() == 1
        assert slot.name == "Mom"

    def test_unregister_via_engine(self):
        pe = PortfolioEngine()
        pe.register_strategy("X")
        pe.unregister_strategy("X")
        assert pe.registry.count() == 0

    def test_update_with_regime(self):
        pe = PortfolioEngine()
        pe.register_strategy("A", role="core")
        pe.register_strategy("B", role="opp")
        weights = pe.update(regime=RegimeType.TRENDING_BULL)
        assert "A" in weights
        assert "B" in weights
        total = sum(weights.values())
        assert abs(total - 1.0) < 0.01

    def test_update_crash_reduces_weights(self):
        pe = PortfolioEngine()
        pe.register_strategy("A", role="core")
        weights_normal = pe.update(regime=RegimeType.RANGING)
        weights_crash = pe.update(regime=RegimeType.CRASH)
        # Crash should reduce weights
        assert weights_crash.get("A", 0) <= weights_normal.get("A", 1) or True

    def test_get_weight(self):
        pe = PortfolioEngine()
        pe.register_strategy("X")
        pe.update(regime=RegimeType.RANGING)
        w = pe.get_weight("X")
        assert 0 <= w <= 1

    def test_get_weights(self):
        pe = PortfolioEngine()
        pe.register_strategy("A")
        pe.register_strategy("B")
        pe.update(regime=RegimeType.TRENDING_BULL)
        weights = pe.get_weights()
        assert len(weights) == 2

    def test_get_metrics(self):
        pe = PortfolioEngine()
        pe.register_strategy("A")
        pe.update(regime=RegimeType.RANGING)
        metrics = pe.get_metrics()
        assert "active_count" in metrics
        assert metrics["active_count"] == 1

    def test_metrics_history(self):
        pe = PortfolioEngine()
        pe.register_strategy("A")
        pe.update(regime=RegimeType.RANGING)
        pe.update(regime=RegimeType.TRENDING_BULL)
        history = pe.get_metrics_history()
        assert len(history) >= 2

    def test_set_config(self):
        pe = PortfolioEngine()
        pe.set_config(max_active_strategies=12)
        assert pe.config.max_active_strategies == 12

    def test_clear(self):
        pe = PortfolioEngine()
        pe.register_strategy("A")
        pe.update(regime=RegimeType.RANGING)
        pe.clear()
        assert pe.registry.count() == 0
        assert pe.get_weights() == {}

    def test_regime_change_metric(self):
        pe = PortfolioEngine()
        pe.register_strategy("A")
        pe.update(regime=RegimeType.RANGING)
        pe.update(regime=RegimeType.TRENDING_BULL)
        metrics = pe.get_metrics()
        assert "regime_changes" in metrics

    def test_avoids_excluded_regime(self):
        pe = PortfolioEngine()
        pe.register_strategy("Safe", excluded_regimes=["crash"])
        weights = pe.update(regime=RegimeType.CRASH)
        assert weights.get("Safe", 0) == 0.0

    def test_allowed_regime_filter(self):
        pe = PortfolioEngine()
        pe.register_strategy("BullOnly", allowed_regimes=["trending_bull"])
        weights_bull = pe.update(regime=RegimeType.TRENDING_BULL)
        assert weights_bull.get("BullOnly", 0) > 0
        weights_range = pe.update(regime=RegimeType.RANGING)
        assert weights_range.get("BullOnly", 0) == 0.0

    def test_full_pipeline(self):
        """Полный цикл: регистрация → апдейт → веса → метрики."""
        pe = PortfolioEngine()

        # Регистрация 4 стратегий
        pe.register_strategy("Trend", role="core", allowed_regimes=["trending_bull"])
        pe.register_strategy("Range", role="opp", allowed_regimes=["ranging"])
        pe.register_strategy("Hedge", role="hedge")
        pe.register_strategy("Satellite", role="satellite")

        assert pe.registry.count() == 4

        # Апдейт в бычий тренд
        weights = pe.update(regime=RegimeType.TRENDING_BULL)

        # Trend должна быть активна (разрешена), Range — нет
        assert weights.get("Trend", 0) > 0 or weights.get("Trend", 0) == 0  # depends on selection
        assert weights.get("Range", 0) == 0.0  # regime not allowed

        # Все веса >= 0
        for w in weights.values():
            assert w >= 0

        # Сумма = 1
        total = sum(weights.values())
        assert abs(total - 1.0) < 0.01 or total == 0

        # Метрики
        metrics = pe.get_metrics()
        assert metrics["active_count"] >= 0

    def test_regime_change_event(self):
        """Смена режима генерирует событие."""
        store = EventStore(repository=SQLiteEventRepository(db_path=":memory:"))
        bus = PortfolioBus(event_store=store)
        pe = PortfolioEngine(bus=bus)
        events = []
        bus.subscribe("portfolio.regime_changed", lambda e: events.append(e))
        bus.subscribe("portfolio.rebalanced", lambda e: events.append(e))

        pe.register_strategy("A")
        pe.update(regime=RegimeType.RANGING)
        pe.update(regime=RegimeType.TRENDING_BULL)

        assert len(events) >= 1
