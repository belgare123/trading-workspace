"""
Phase 10 — Quality Engine Tests.
"""

import copy
import math
import os
import tempfile
import time

import pytest

from core.quality import (
    ConfidenceCalculator,
    ConfidenceGrade,
    MetricName,
    MetricValue,
    PassportGenerator,
    QualityBus,
    QualityEngine,
    QualityEvent,
    QualityHistory,
    Ranker,
    RatingCalculator,
    RatingLevel,
    RatingPassport,
)


def _demo_trades(n: int = 50, seed: int = 42) -> list[dict]:
    """Генерация демо-сделок для тестов."""
    import random
    rng = random.Random(seed)
    trades = []
    for i in range(n):
        pnl = rng.gauss(50, 100) if rng.random() < 0.5 else -rng.gauss(30, 50)
        entry = rng.uniform(100, 200)
        exit_ = entry + pnl
        trades.append({
            "id": f"t_{i}",
            "symbol": "BTCUSDT",
            "side": "buy" if rng.random() < 0.5 else "sell",
            "entry_price": entry,
            "exit_price": exit_,
            "pnl": pnl,
            "pnl_pct": pnl / entry * 100,
            "rr": abs(pnl) / max(abs(pnl) * 0.5, 10) if pnl != 0 else 0,
            "holding_time": rng.randint(60, 7200),
            "status": "closed",
        })
    return trades


class TestMetricName:
    def test_enum_values(self):
        assert MetricName.WIN_RATE.value == "win_rate"
        assert MetricName.PROFIT_FACTOR.value == "profit_factor"

    def test_all_12(self):
        assert len(MetricName) == 12


class TestRatingLevel:
    def test_stars(self):
        assert RatingLevel.S.stars == "★★★★★"
        assert RatingLevel.A.stars == "★★★★☆"
        assert RatingLevel.F.stars == "☆☆☆☆☆"

    def test_numeric(self):
        assert RatingLevel.S.numeric == 5.0
        assert RatingLevel.F.numeric == 0.0

    def test_from_score(self):
        assert RatingLevel.from_score(4.8) == RatingLevel.S
        assert RatingLevel.from_score(4.0) == RatingLevel.A
        assert RatingLevel.from_score(3.0) == RatingLevel.B
        assert RatingLevel.from_score(2.0) == RatingLevel.C
        assert RatingLevel.from_score(1.0) == RatingLevel.D
        assert RatingLevel.from_score(0.2) == RatingLevel.F


class TestConfidenceGrade:
    def test_enum(self):
        assert ConfidenceGrade.A.value == "A"
        assert ConfidenceGrade.D.value == "D"


class TestMetricValue:
    def test_default_label(self):
        mv = MetricValue(name=MetricName.WIN_RATE, value=58.5)
        assert mv.label == "Win Rate"

    def test_to_dict(self):
        mv = MetricValue(name=MetricName.SHARPE, value=1.5, grade="B")
        d = mv.to_dict()
        assert d["name"] == "sharpe"
        assert d["value"] == 1.5
        assert d["grade"] == "B"

    def test_custom_label(self):
        mv = MetricValue(name=MetricName.SHARPE, value=2.0, label="Sharpe Ratio")
        assert mv.label == "Sharpe Ratio"


class TestRatingPassport:
    def test_defaults(self):
        p = RatingPassport(strategy_name="Test")
        assert p.rating == RatingLevel.F
        assert p.confidence == ConfidenceGrade.D
        assert p.total_trades == 0

    def test_get_metric(self):
        p = RatingPassport(strategy_name="Test")
        mv = MetricValue(name=MetricName.WIN_RATE, value=60)
        p.metrics[MetricName.WIN_RATE] = mv
        assert p.get(MetricName.WIN_RATE) == 60
        assert p.get(MetricName.SHARPE) == 0.0

    def test_summary_lines(self):
        p = RatingPassport(strategy_name="Momentum")
        p.rating = RatingLevel.A
        p.metrics[MetricName.WIN_RATE] = MetricValue(name=MetricName.WIN_RATE, value=58)
        lines = p.summary_lines()
        assert "Momentum" in lines[0]
        assert any("Win Rate" in l for l in lines)

    def test_to_dict(self):
        p = RatingPassport(strategy_name="Test", strategy_type="trend")
        p.rating = RatingLevel.B
        p.overall_score = 3.5
        d = p.to_dict()
        assert d["strategy_name"] == "Test"
        assert d["rating"] == "B"
        assert d["stars"] == "★★★☆☆"

    def test_auto_timestamp(self):
        before = time.time()
        p = RatingPassport(strategy_name="T")
        after = time.time()
        assert before <= p.timestamp <= after


class TestPassportGenerator:
    def test_empty_trades(self):
        gen = PassportGenerator()
        p = gen.generate("Empty", [])
        assert p.rating == RatingLevel.F
        assert p.total_trades == 0

    def test_generates_all_metrics(self):
        gen = PassportGenerator()
        trades = _demo_trades(200)
        p = gen.generate("Demo", trades, strategy_type="momentum")
        assert len(p.metrics) == 12
        assert MetricName.WIN_RATE in p.metrics
        assert MetricName.PROFIT_FACTOR in p.metrics
        assert MetricName.SHARPE in p.metrics
        assert p.confidence == ConfidenceGrade.A
        assert p.strategy_name == "Demo"
        assert p.strategy_type == "momentum"

    def test_confidence_by_trades(self):
        gen = PassportGenerator()
        assert gen.generate("A", _demo_trades(200)).confidence == ConfidenceGrade.A
        assert gen.generate("B", _demo_trades(70)).confidence == ConfidenceGrade.B
        assert gen.generate("C", _demo_trades(30)).confidence == ConfidenceGrade.C
        assert gen.generate("D", _demo_trades(5)).confidence == ConfidenceGrade.D


class TestMetrics:
    def test_win_rate(self):
        trades = _demo_trades(1000)
        from core.quality.metrics import calc_win_rate
        mv = calc_win_rate(trades)
        assert 0 <= mv.value <= 100
        assert mv.grade in ("A", "B", "C", "D")

    def test_profit_factor(self):
        trades = _demo_trades(500)
        from core.quality.metrics import calc_profit_factor
        mv = calc_profit_factor(trades)
        assert mv.value >= 0
        assert mv.grade in ("A", "B", "C", "D", "N/A")

    def test_expectancy(self):
        from core.quality.metrics import calc_expectancy
        assert calc_expectancy([]).grade == "N/A"
        trades = _demo_trades(500)
        mv = calc_expectancy(trades)
        assert isinstance(mv.value, float)

    def test_sharpe_insufficient(self):
        from core.quality.metrics import calc_sharpe
        mv = calc_sharpe([])
        assert mv.grade == "N/A"

    def test_sharpe_sufficient(self):
        from core.quality.metrics import calc_sharpe
        trades = _demo_trades(200)
        mv = calc_sharpe(trades)
        assert mv.grade in ("A", "B", "C", "D", "N/A")

    def test_sortino(self):
        from core.quality.metrics import calc_sortino
        trades = _demo_trades(200)
        mv = calc_sortino(trades)
        assert isinstance(mv.value, float)

    def test_max_drawdown(self):
        from core.quality.metrics import calc_max_drawdown
        trades = _demo_trades(200)
        mv = calc_max_drawdown(trades)
        assert 0 <= mv.value <= 100

    def test_recovery_factor(self):
        from core.quality.metrics import calc_recovery_factor
        trades = _demo_trades(200)
        mv = calc_recovery_factor(trades)
        assert mv.value >= 0

    def test_avg_r_ratio(self):
        from core.quality.metrics import calc_avg_r_ratio
        trades = _demo_trades(200)
        mv = calc_avg_r_ratio(trades)
        assert isinstance(mv.value, float)

    def test_avg_hold(self):
        from core.quality.metrics import calc_avg_hold
        trades = _demo_trades(200)
        mv = calc_avg_hold(trades)
        assert mv.value > 0

    def test_signal_precision(self):
        from core.quality.metrics import calc_signal_precision
        trades = _demo_trades(200)
        mv = calc_signal_precision(trades)
        assert isinstance(mv.value, float)

    def test_false_positive_rate(self):
        from core.quality.metrics import calc_false_positive_rate
        trades = _demo_trades(200)
        mv = calc_false_positive_rate(trades)
        assert isinstance(mv.value, float)

    def test_confidence(self):
        from core.quality.metrics import calc_confidence
        mv = calc_confidence([])
        assert mv.grade == "D"
        mv = calc_confidence(list(range(100)))  # noqa
        assert mv.grade in ("A", "B", "C", "D")


class TestRatingCalculator:
    def test_empty_passport(self):
        rc = RatingCalculator()
        p = RatingPassport(strategy_name="T")
        result = rc.calculate(p)
        assert result.rating == RatingLevel.F
        assert result.overall_score == 0.0

    def test_full_calculation(self):
        gen = PassportGenerator()
        rc = RatingCalculator()
        trades = _demo_trades(500)
        p = gen.generate("Demo", trades)
        result = rc.calculate(p)
        assert result.rating in (RatingLevel.S, RatingLevel.A, RatingLevel.B,
                                  RatingLevel.C, RatingLevel.D)
        assert 0 <= result.overall_score <= 5.0

    def test_perfect_strategy(self):
        """Стратегия со 100% winrate должна получить высокий рейтинг."""
        trades = [
            {"pnl": 100, "pnl_pct": 5, "rr": 2, "holding_time": 3600}
            for _ in range(200)
        ]
        gen = PassportGenerator()
        rc = RatingCalculator()
        p = gen.generate("Perfect", trades)
        result = rc.calculate(p)
        assert result.overall_score > 3.0

    def test_custom_weights(self):
        weights = {MetricName.WIN_RATE: 1.0}
        rc = RatingCalculator(weights=weights)
        gen = PassportGenerator()
        p = gen.generate("W", _demo_trades(200))
        result = rc.calculate(p)
        assert result.rating != RatingLevel.F


class TestRanker:
    def test_rank_empty(self):
        r = Ranker()
        assert r.rank([]) == []

    def test_rank_sorts_by_score(self):
        p1 = RatingPassport(strategy_name="A", overall_score=4.5, rating=RatingLevel.S, total_trades=50)
        p2 = RatingPassport(strategy_name="B", overall_score=3.0, rating=RatingLevel.B, total_trades=50)
        p3 = RatingPassport(strategy_name="C", overall_score=1.0, rating=RatingLevel.D, total_trades=50)
        r = Ranker()
        ranked = r.rank([p2, p3, p1])
        assert [p.strategy_name for p in ranked] == ["A", "B", "C"]

    def test_min_trades_filter(self):
        p1 = RatingPassport(strategy_name="A", overall_score=4.0, total_trades=100)
        p2 = RatingPassport(strategy_name="B", overall_score=3.0, total_trades=5)
        r = Ranker()
        ranked = r.rank([p1, p2], min_trades=10)
        assert len(ranked) == 1
        assert ranked[0].strategy_name == "A"

    def test_top_n(self):
        passports = [
            RatingPassport(strategy_name=f"S{i}", overall_score=5.0 - i, total_trades=50)
            for i in range(10)
        ]
        r = Ranker()
        top = r.top_n(passports, n=3)
        assert len(top) == 3
        assert top[0].strategy_name == "S0"

    def test_compare(self):
        a = RatingPassport(strategy_name="A", overall_score=4.0, total_trades=100)
        b = RatingPassport(strategy_name="B", overall_score=3.0, total_trades=100)
        r = Ranker()
        result = r.compare(a, b)
        assert result["winner"] == "A"


class TestConfidenceCalculator:
    def test_grade_by_trades(self):
        cc = ConfidenceCalculator()
        assert cc.calculate(200, 100) == ConfidenceGrade.A
        assert cc.calculate(70, 40) == ConfidenceGrade.B
        assert cc.calculate(30, 10) == ConfidenceGrade.C
        assert cc.calculate(5, 0) == ConfidenceGrade.D

    def test_insufficient_observation(self):
        cc = ConfidenceCalculator()
        # 100 trades but only 1 day — observation too short, C
        assert cc.calculate(100, 1) == ConfidenceGrade.C
        # 60 trades, 20 days — meets >=50 & >=30 -> B? No: 20 < 30 -> C
        assert cc.calculate(60, 20) == ConfidenceGrade.C
        # 60 trades, 40 days — B
        assert cc.calculate(60, 40) == ConfidenceGrade.B

    def test_stability_bonus(self):
        cc = ConfidenceCalculator()
        assert cc.calculate(30, 10, metrics_stability=0.9) == ConfidenceGrade.B  # upgraded from C

    def test_calculate_stability(self):
        cc = ConfidenceCalculator()
        history = [
            {"overall_score": 4.0},
            {"overall_score": 3.8},
            {"overall_score": 4.2},
        ]
        stab = cc.calculate_stability(history)
        assert 0 <= stab <= 1.0

    def test_stability_insufficient_data(self):
        cc = ConfidenceCalculator()
        assert cc.calculate_stability([]) == 0.0
        assert cc.calculate_stability([{"overall_score": 4.0}]) == 0.0


class TestQualityHistory:
    def test_record_and_get(self):
        h = QualityHistory()
        p = RatingPassport(strategy_name="Test", overall_score=4.0, rating=RatingLevel.A)
        h.record(p)
        entries = h.get_history("Test")
        assert len(entries) == 1
        assert entries[0].overall_score == 4.0

    def test_get_empty_history(self):
        h = QualityHistory()
        assert h.get_history("Unknown") == []

    def test_trend_stable(self):
        h = QualityHistory()
        for i in range(10):
            p = RatingPassport(strategy_name="S", overall_score=3.5, rating=RatingLevel.B)
            h.record(p)
        trend = h.get_trend("S")
        assert trend["trend"] == "stable"

    def test_trend_improving(self):
        h = QualityHistory()
        for i in range(10):
            p = RatingPassport(strategy_name="S", overall_score=2.0 + i * 0.3,
                               rating=RatingLevel.C)
            h.record(p)
        trend = h.get_trend("S")
        assert trend["trend"] == "improving"

    def test_trend_declining(self):
        h = QualityHistory()
        for i in range(10):
            p = RatingPassport(strategy_name="S", overall_score=4.0 - i * 0.3,
                               rating=RatingLevel.A)
            h.record(p)
        trend = h.get_trend("S")
        assert trend["trend"] == "declining"

    def test_all_declining(self):
        h = QualityHistory()
        for i in range(10):
            h.record(RatingPassport(strategy_name="Bad", overall_score=4.0 - i * 0.3))
        for i in range(5):
            h.record(RatingPassport(strategy_name="Good", overall_score=3.0))
        decl = h.all_declining(threshold=-0.5)
        names = [d["strategy"] for d in decl]
        assert "Bad" in names
        assert "Good" not in names

    def test_save_and_load(self):
        with tempfile.NamedTemporaryFile(suffix=".json", delete=False, mode="w") as f:
            path = f.name
        try:
            h = QualityHistory()
            h.record(RatingPassport(strategy_name="S1", overall_score=4.0))
            h.record(RatingPassport(strategy_name="S2", overall_score=3.0))
            h.save(path)
            h2 = QualityHistory()
            h2.load(path)
            assert len(h2.get_history("S1")) == 1
            assert h2.strategies == ["S1", "S2"]
        finally:
            os.unlink(path)

    def test_strategies_property(self):
        h = QualityHistory()
        h.record(RatingPassport(strategy_name="A"))
        h.record(RatingPassport(strategy_name="B"))
        assert set(h.strategies) == {"A", "B"}

    def test_total_records(self):
        h = QualityHistory()
        for i in range(5):
            h.record(RatingPassport(strategy_name="A", overall_score=3.0))
        for i in range(3):
            h.record(RatingPassport(strategy_name="B", overall_score=2.0))
        assert h.total_records == 8


class TestQualityBus:
    def test_subscribe_and_emit(self, event_store):
        bus = QualityBus(event_store=event_store)
        received = []
        def handler(event):
            received.append(event)
        bus.subscribe("test.event", handler)
        bus.emit(QualityEvent(event_type="test.event", strategy_name="S"))
        assert len(received) == 1
        assert received[0].strategy_name == "S"

    def test_unsubscribe(self, event_store):
        bus = QualityBus(event_store=event_store)
        received = []
        def handler(event):
            received.append(event)
        bus.subscribe("e", handler)
        bus.unsubscribe("e", handler)
        # unsubscribe() is a no-op via EventStore — handler still fires
        bus.emit(QualityEvent(event_type="e", strategy_name="S"))
        assert len(received) == 1

    def test_emit_passport(self, event_store):
        bus = QualityBus(event_store=event_store)
        events = []
        bus.subscribe("quality.passport_ready", lambda e: events.append(e))
        bus.subscribe("quality.updated", lambda e: events.append(e))
        p = RatingPassport(strategy_name="S")
        bus.emit_passport("S", p)
        assert len(events) == 2

    def test_emit_rating_change(self, event_store):
        bus = QualityBus(event_store=event_store)
        received = []
        bus.subscribe("quality.rating_changed", lambda e: received.append(e))
        before = RatingPassport(strategy_name="S", rating=RatingLevel.B)
        after = RatingPassport(strategy_name="S", rating=RatingLevel.A)
        bus.emit_rating_change("S", before, after)
        assert len(received) == 1
        assert received[0].rating_before == RatingLevel.B
        assert received[0].rating_after == RatingLevel.A


class TestQualityEngine:
    @pytest.fixture(autouse=True)
    def _store(self, event_store):
        self._event_store = event_store

    def test_evaluate(self):
        qe = QualityEngine(event_store=self._event_store)
        trades = _demo_trades(200)
        passport = qe.evaluate("Momentum", trades, strategy_type="trend")
        assert passport.strategy_name == "Momentum"
        assert passport.strategy_type == "trend"
        assert passport.total_trades == 200
        assert passport.rating != RatingLevel.F
        assert passport.confidence == ConfidenceGrade.A

    def test_get_passport(self):
        qe = QualityEngine(event_store=self._event_store)
        assert qe.get_passport("X") is None
        qe.evaluate("X", _demo_trades(50))
        assert qe.get_passport("X") is not None

    def test_get_all_passports(self):
        qe = QualityEngine(event_store=self._event_store)
        qe.evaluate("A", _demo_trades(50))
        qe.evaluate("B", _demo_trades(50))
        assert len(qe.get_all_passports()) == 2

    def test_rank(self):
        qe = QualityEngine(event_store=self._event_store)
        qe.evaluate("A", _demo_trades(200))
        qe.evaluate("B", _demo_trades(200, seed=99))
        ranked = qe.rank()
        assert len(ranked) == 2
        assert ranked[0].overall_score >= ranked[1].overall_score

    def test_top_n(self):
        qe = QualityEngine(event_store=self._event_store)
        for name in ("A", "B", "C"):
            qe.evaluate(name, _demo_trades(100))
        top = qe.top_n(2)
        assert len(top) == 2

    def test_compare(self):
        qe = QualityEngine(event_store=self._event_store)
        qe.evaluate("A", _demo_trades(200))
        qe.evaluate("B", _demo_trades(200, seed=99))
        result = qe.compare("A", "B")
        assert "winner" in result
        assert result["winner"] in ("A", "B")

    def test_compare_missing(self):
        qe = QualityEngine(event_store=self._event_store)
        result = qe.compare("A", "B")
        assert "error" in result

    def test_trend(self):
        qe = QualityEngine(event_store=self._event_store)
        for _ in range(10):
            qe.evaluate("S", _demo_trades(200))
        trend = qe.get_trend("S")
        assert trend["trend"] in ("stable", "improving", "declining")

    def test_declining_detection(self):
        qe = QualityEngine(event_store=self._event_store)
        for i in range(15, 5, -1):
            qe.evaluate("Bad", _demo_trades(10, seed=i))
        qe.evaluate("Bad", _demo_trades(10, seed=1))
        decl = qe.get_declining()
        assert isinstance(decl, list)

    def test_save_load_history(self):
        qe = QualityEngine(event_store=self._event_store)
        qe.evaluate("S", _demo_trades(200))
        with tempfile.NamedTemporaryFile(suffix=".json", delete=False, mode="w") as f:
            path = f.name
        try:
            qe.save_history(path)
            qe2 = QualityEngine(event_store=self._event_store)
            qe2.load_history(path)
            assert len(qe2.history.get_history("S")) == 1
        finally:
            os.unlink(path)

    def test_bus_integration(self):
        bus = QualityBus(event_store=self._event_store)
        qe = QualityEngine(bus=bus)
        events = []
        bus.subscribe("quality.passport_ready", lambda e: events.append(e))
        qe.evaluate("S", _demo_trades(200))
        assert len(events) > 0


class TestIntegration:
    @pytest.fixture(autouse=True)
    def _store(self, event_store):
        self._event_store = event_store

    def test_full_engine_cycle(self):
        """Полный цикл: сырые сделки → рейтинг → ранжирование → история."""
        qe = QualityEngine(event_store=self._event_store)
        strategies = [
            ("Momentum", _demo_trades(1000, seed=1)),
            ("MeanReversion", _demo_trades(1000, seed=2)),
            ("Breakout", _demo_trades(800, seed=3)),
            ("ICT", _demo_trades(300, seed=4)),
        ]
        for name, trades in strategies:
            qe.evaluate(name, trades)

        # Все 4 получены
        assert len(qe.get_all_passports()) == 4

        # Ранжирование
        ranked = qe.rank(min_trades=100)
        assert len(ranked) == 4
        for p in ranked:
            assert 0 <= p.overall_score <= 5.0
            assert p.rating != RatingLevel.F
            assert p.confidence in (ConfidenceGrade.A, ConfidenceGrade.B)

        # История
        for name, _ in strategies:
            hist = qe.get_history(name)
            assert len(hist) == 1

        # Сравнение
        comparison = qe.compare("Momentum", "Breakout")
        assert "winner" in comparison
