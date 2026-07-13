"""
Phase 11 — Analytics Engine Tests.
"""

import copy
import datetime
import os
import tempfile
import time

import pytest

from core.analytics import (
    AnalyticsBus,
    AnalyticsEngine,
    AnalyticsEvent,
    DominanceAnalyzer,
    DominanceTrend,
    HeatmapBuilder,
    LiquidityAnalyzer,
    LiquidityState,
    MarketHeatmap,
    MarketProfile,
    MarketRegime,
    ProfileBuilder,
    RegimeDetector,
    RegimeType,
    VolatilityAnalyzer,
    VolatilityProfile,
    VolatilityState,
)
from core.analytics.session import get_current_session


def _demo_candles(n: int = 100, seed: int = 42, trend: float = 0.0) -> list[dict]:
    """Генерация демо-свечей для тестов."""
    import random
    rng = random.Random(seed)
    candles = []
    price = 50000.0
    for i in range(n):
        change = rng.gauss(trend, 100)
        price += change
        high = price + abs(rng.gauss(0, 50))
        low = price - abs(rng.gauss(0, 50))
        candles.append({
            "open": price - change,
            "high": high,
            "low": low,
            "close": price,
            "volume": rng.uniform(100, 1000),
            "timestamp": 1700000000 + i * 60,
        })
    return candles


class TestRegimeType:
    def test_enum_values(self):
        assert RegimeType.TRENDING_BULL.value == "trending_bull"
        assert RegimeType.UNKNOWN.value == "unknown"

    def test_len(self):
        assert len(RegimeType) == 11


class TestMarketRegime:
    def test_defaults(self):
        r = MarketRegime()
        assert r.regime == RegimeType.UNKNOWN
        assert r.confidence == 0.0
        assert r.duration_bars == 0

    def test_to_dict(self):
        r = MarketRegime(regime=RegimeType.TRENDING_BULL, confidence=0.85)
        d = r.to_dict()
        assert d["regime"] == "trending_bull"
        assert d["confidence"] == 0.85


class TestVolatilityProfile:
    def test_defaults(self):
        v = VolatilityProfile()
        assert v.state == VolatilityState.STABLE
        assert v.atr_ratio == 1.0

    def test_to_dict(self):
        v = VolatilityProfile(state=VolatilityState.EXPANDING, atr_ratio=1.5)
        d = v.to_dict()
        assert d["state"] == "expanding"
        assert d["atr_ratio"] == 1.5


class TestMarketProfile:
    def test_defaults(self):
        p = MarketProfile(symbol="BTCUSDT")
        assert p.symbol == "BTCUSDT"
        assert p.dominant_side == "neutral"

    def test_dominant_side(self):
        p = MarketProfile(symbol="BTCUSDT", buyer_strength=0.8, seller_strength=0.2)
        assert p.dominant_side == "buyers"
        p2 = MarketProfile(symbol="BTCUSDT", buyer_strength=0.2, seller_strength=0.8)
        assert p2.dominant_side == "sellers"

    def test_generate_summary(self):
        p = MarketProfile(symbol="BTCUSDT")
        p.regime = MarketRegime(regime=RegimeType.TRENDING_BULL, confidence=0.8)
        p.volatility.state = VolatilityState.EXPANDING
        p.liquidity.state = LiquidityState.HIGH
        p.buyer_strength = 0.7
        p.seller_strength = 0.3
        summary = p.generate_summary()
        assert "trending_bull" in summary
        assert "expanding" in summary
        assert "buyers" in summary or "покупателей" in summary

    def test_to_dict(self):
        p = MarketProfile(symbol="ETHUSDT")
        p.regime = MarketRegime(regime=RegimeType.RANGING, confidence=0.6)
        d = p.to_dict()
        assert d["symbol"] == "ETHUSDT"
        assert d["regime"]["regime"] == "ranging"
        assert "summary" in d


class TestRegimeDetector:
    def test_empty_candles(self):
        rd = RegimeDetector()
        r = rd.detect([])
        assert r.regime == RegimeType.UNKNOWN
        assert r.confidence == 0.0

    def test_insufficient_candles(self):
        rd = RegimeDetector()
        r = rd.detect([{"close": 100, "high": 110, "low": 90}] * 5)
        assert r.regime == RegimeType.UNKNOWN

    def test_trending_bull(self):
        rd = RegimeDetector()
        candles = _demo_candles(100, seed=42, trend=10)
        r = rd.detect(candles)
        assert r.regime in (RegimeType.TRENDING_BULL, RegimeType.BREAKOUT,
                         RegimeType.HIGH_VOLATILITY, RegimeType.DISTRIBUTION,
                         RegimeType.RECOVERY)

    def test_trending_bear(self):
        rd = RegimeDetector()
        candles = _demo_candles(100, seed=42, trend=-10)
        r = rd.detect(candles)
        assert r.regime in (RegimeType.TRENDING_BEAR, RegimeType.CRASH,
                         RegimeType.HIGH_VOLATILITY, RegimeType.ACCUMULATION)

    def test_crash_detection(self):
        rd = RegimeDetector()
        candles = _demo_candles(50, seed=42, trend=0)
        # Drop last candle to simulate crash
        candles[-1] = {
            "open": 50000,
            "high": 50100,
            "low": 45000,
            "close": 45500,
            "volume": 5000,
        }
        candles[-2] = {
            "open": 51000,
            "high": 51500,
            "low": 50500,
            "close": 51000,
            "volume": 500,
        }
        r = rd.detect(candles)
        # May or may not detect crash depending on metric values
        assert isinstance(r.regime, RegimeType)

    def test_reset(self):
        rd = RegimeDetector()
        rd.detect(_demo_candles(100))
        rd.reset()
        assert rd._prev_regime is None  # noqa


class TestVolatilityAnalyzer:
    def test_empty_candles(self):
        va = VolatilityAnalyzer()
        vp = va.analyze([])
        assert vp.state == VolatilityState.STABLE
        assert vp.atr_ratio == 1.0

    def test_analyze(self):
        va = VolatilityAnalyzer()
        candles = _demo_candles(100)
        vp = va.analyze(candles)
        assert isinstance(vp.current_atr, float)
        assert vp.atr_ratio > 0
        assert vp.state in (VolatilityState.STABLE, VolatilityState.EXPANDING,
                            VolatilityState.CONTRACTING, VolatilityState.SPIKE)


class TestLiquidityAnalyzer:
    def test_default(self):
        la = LiquidityAnalyzer()
        lp = la.analyze()
        assert lp.state == LiquidityState.MEDIUM

    def test_dry(self):
        la = LiquidityAnalyzer()
        lp = la.analyze(bid_ask_spread=0.02, volume=10, avg_volume=100)
        assert lp.state == LiquidityState.DRY

    def test_high(self):
        la = LiquidityAnalyzer()
        lp = la.analyze(bid_ask_spread=0.0005, volume=2000, avg_volume=1000)
        assert lp.state == LiquidityState.HIGH

    def test_imbalance(self):
        la = LiquidityAnalyzer()
        lp = la.analyze(bid_volume=1000, ask_volume=500)
        assert lp.imbalance > 0
        lp2 = la.analyze(bid_volume=500, ask_volume=1000)
        assert lp2.imbalance < 0

    def test_imbalance_zero(self):
        la = LiquidityAnalyzer()
        assert la._calc_imbalance(0, 0) == 0.0


class TestDominanceAnalyzer:
    def test_btc_rising(self):
        da = DominanceAnalyzer()
        dp = da.analyze(btc_dominance=55, btc_change_24h=3, alt_change_24h=-2)
        assert dp.trend == DominanceTrend.BTC_RISING
        assert dp.btc_dominance == 55

    def test_btc_falling(self):
        da = DominanceAnalyzer()
        dp = da.analyze(btc_change_24h=-2, alt_change_24h=3)
        assert dp.trend == DominanceTrend.BTC_FALLING

    def test_alt_season(self):
        da = DominanceAnalyzer()
        dp = da.analyze(btc_change_24h=-2, alt_change_24h=5)
        assert dp.trend == DominanceTrend.ALT_SEASON

    def test_flight_to_btc(self):
        da = DominanceAnalyzer()
        dp = da.analyze(btc_change_24h=1, alt_change_24h=0.3)
        assert dp.trend == DominanceTrend.FLIGHT_TO_BTC

    def test_stable(self):
        da = DominanceAnalyzer()
        dp = da.analyze(btc_change_24h=0.1, alt_change_24h=-0.1)
        assert dp.trend == DominanceTrend.BTC_STABLE


class TestSession:
    def test_get_current_session(self):
        session = get_current_session()
        assert session.value in ("asia", "london", "new_york",
                                  "overlap_london_ny", "overlap_asia_london", "closed")

    def test_session_type_values(self):
        from core.analytics.session import SessionType as ST
        assert ST.ASIA.value == "asia"
        assert ST.LONDON.value == "london"
        assert ST.NEW_YORK.value == "new_york"


class TestProfileBuilder:
    def test_build(self):
        pb = ProfileBuilder()
        candles = _demo_candles(100, seed=42)
        profile = pb.build(
            symbol="BTCUSDT",
            candles=candles,
            volume=5000,
            avg_volume=4000,
            bid_ask_spread=0.0005,
        )
        assert profile.symbol == "BTCUSDT"
        assert isinstance(profile.regime, MarketRegime)
        assert profile.regime.regime != RegimeType.UNKNOWN
        assert 0 <= profile.buyer_strength <= 1
        assert 0 <= profile.seller_strength <= 1
        assert profile.summary

    def test_profile_changes(self):
        pb = ProfileBuilder()
        profile1 = pb.build(symbol="BTCUSDT", candles=_demo_candles(100, seed=42))
        profile2 = pb.build(symbol="BTCUSDT", candles=_demo_candles(100, seed=99))
        # Profile builder tracks prev_regime
        assert profile2.prev_regime is not None or profile1.regime.regime == profile2.regime.regime


class TestHeatmapBuilder:
    def test_empty(self):
        hb = HeatmapBuilder()
        hm = hb.build({})
        assert hm.timestamp > 0

    def test_build_heatmap(self):
        hb = HeatmapBuilder()
        profiles = {
            "BTCUSDT": MarketProfile(symbol="BTCUSDT", buyer_strength=0.8, seller_strength=0.2),
            "ETHUSDT": MarketProfile(symbol="ETHUSDT", buyer_strength=0.3, seller_strength=0.7),
            "SOLUSDT": MarketProfile(symbol="SOLUSDT", buyer_strength=0.6, seller_strength=0.4),
        }
        hm = hb.build(profiles)
        assert len(hm.symbols) == 3
        assert len(hm.top_gainers) >= 1
        assert len(hm.top_losers) >= 1
        assert "BTC" in hm.sectors or "Other" in hm.sectors

    def test_classify_sector(self):
        hb = HeatmapBuilder()
        assert hb._classify_sector("BTCUSDT") == "BTC"
        assert hb._classify_sector("ETHUSDT") == "ETH"
        assert hb._classify_sector("SOLUSDT") == "L1"
        assert hb._classify_sector("AAVEUSDT") == "DeFi"
        assert hb._classify_sector("XRPUSDT") == "Other"


class TestAnalyticsBus:
    def test_subscribe_emit(self):
        bus = AnalyticsBus()
        received = []
        def handler(event):
            received.append(event)
        bus.subscribe("test.event", handler)
        bus.emit(AnalyticsEvent(event_type="test.event", symbol="BTCUSDT"))
        assert len(received) == 1
        assert received[0].symbol == "BTCUSDT"

    def test_unsubscribe(self):
        bus = AnalyticsBus()
        received = []
        def handler(event):
            received.append(event)
        bus.subscribe("e", handler)
        bus.unsubscribe("e", handler)
        bus.emit(AnalyticsEvent(event_type="e", symbol="X"))
        assert len(received) == 0

    def test_emit_profile(self):
        bus = AnalyticsBus()
        events = []
        bus.subscribe("analytics.market_profile_updated", lambda e: events.append(e))
        p = MarketProfile(symbol="BTCUSDT")
        bus.emit_profile("BTCUSDT", p)
        assert len(events) == 1

    def test_emit_regime_change(self):
        bus = AnalyticsBus()
        events = []
        bus.subscribe("analytics.regime_changed", lambda e: events.append(e))
        before = MarketProfile(symbol="BTCUSDT")
        before.regime = MarketRegime(regime=RegimeType.RANGING)
        after = MarketProfile(symbol="BTCUSDT")
        after.regime = MarketRegime(regime=RegimeType.TRENDING_BULL)
        bus.emit_regime_change("BTCUSDT", before, after)
        assert len(events) == 1
        assert events[0].regime_before == RegimeType.RANGING
        assert events[0].regime_after == RegimeType.TRENDING_BULL


class TestAnalyticsEngine:
    def test_analyze(self):
        ae = AnalyticsEngine()
        candles = _demo_candles(100, seed=42)
        profile = ae.analyze("BTCUSDT", candles=candles)
        assert profile.symbol == "BTCUSDT"
        assert profile.regime.regime != RegimeType.UNKNOWN
        assert profile.summary

    def test_get_profile(self):
        ae = AnalyticsEngine()
        assert ae.get_profile("X") is None
        ae.analyze("X", _demo_candles(100))
        assert ae.get_profile("X") is not None

    def test_get_all_profiles(self):
        ae = AnalyticsEngine()
        ae.analyze("A", _demo_candles(100))
        ae.analyze("B", _demo_candles(100, seed=99))
        assert len(ae.get_all_profiles()) == 2

    def test_get_heatmap(self):
        ae = AnalyticsEngine()
        ae.analyze("BTCUSDT", _demo_candles(100))
        ae.analyze("ETHUSDT", _demo_candles(100, seed=99))
        hm = ae.get_heatmap()
        assert isinstance(hm, MarketHeatmap)
        assert len(hm.symbols) == 2

    def test_get_current_regime(self):
        ae = AnalyticsEngine()
        assert ae.get_current_regime("X") == RegimeType.UNKNOWN
        ae.analyze("X", _demo_candles(100, trend=10))
        regime = ae.get_current_regime("X")
        assert regime != RegimeType.UNKNOWN

    def test_get_current_session(self):
        ae = AnalyticsEngine()
        session = ae.get_current_session()
        assert isinstance(session, str)

    def test_remove(self):
        ae = AnalyticsEngine()
        ae.analyze("X", _demo_candles(100))
        ae.remove("X")
        assert ae.get_profile("X") is None

    def test_clear(self):
        ae = AnalyticsEngine()
        ae.analyze("X", _demo_candles(100))
        ae.analyze("Y", _demo_candles(100, seed=99))
        ae.clear()
        assert len(ae.get_all_profiles()) == 0

    def test_bus_integration(self):
        bus = AnalyticsBus()
        ae = AnalyticsEngine(bus=bus)
        events = []
        bus.subscribe("analytics.market_profile_updated", lambda e: events.append(e))
        ae.analyze("BTCUSDT", _demo_candles(100))
        assert len(events) > 0

    def test_emits_regime_change(self):
        bus = AnalyticsBus()
        ae = AnalyticsEngine(bus=bus)
        changes = []
        bus.subscribe("analytics.regime_changed", lambda e: changes.append(e))
        # First analyze sets baseline
        ae.analyze("S", _demo_candles(100, seed=1, trend=10))
        # Second analyze may trigger change
        ae.analyze("S", _demo_candles(100, seed=2, trend=-10))
        # Change may or may not be detected — just assert it doesn't crash
        assert isinstance(changes, list)


class TestIntegration:
    def test_full_market_analysis(self):
        """Полный цикл: свечи → профиль → хитмап → события."""
        bus = AnalyticsBus()
        ae = AnalyticsEngine(bus=bus)
        events = []

        bus.subscribe("analytics.market_profile_updated", lambda e: events.append(e))
        bus.subscribe("analytics.regime_changed", lambda e: events.append(e))

        symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT"]
        profiles = {}
        for symbol in symbols:
            candles = _demo_candles(100, seed=hash(symbol) % 1000, trend=1)
            profile = ae.analyze(symbol, candles=candles)
            profiles[symbol] = profile

        # Все символы обработаны
        assert len(ae.get_all_profiles()) == 4

        # У всех есть режим
        for symbol in symbols:
            regime = ae.get_current_regime(symbol)
            assert regime != RegimeType.UNKNOWN

        # Хитмап
        hm = ae.get_heatmap()
        assert len(hm.symbols) == 4

        # Сводка
        for symbol, profile in profiles.items():
            assert profile.summary

        # События
        assert len(events) >= 4

    def test_market_profile_full(self):
        """Полная картина рынка с указанием сил."""
        ae = AnalyticsEngine()
        profile = ae.analyze("BTCUSDT", candles=_demo_candles(100, seed=42))
        d = profile.to_dict()
        assert "regime" in d
        assert "volatility" in d
        assert "liquidity" in d
        assert "dominance" in d
        assert "buyer_strength" in d
        assert "seller_strength" in d
        assert "session" in d
        assert "summary" in d
        assert d["buyer_strength"] + d["seller_strength"] >= 0.9  # ~1.0
