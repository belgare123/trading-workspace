"""Tests for Feature Graph (Phase 6.5)."""

import pytest

from core.strategy.capability_db import CapabilityInfo
from core.strategy.feature_graph import (
    FeatureConflict,
    FeatureConflictError,
    FeatureGraph,
    FeatureGraphError,
    FeatureMissingError,
    FeatureResolution,
)


class TestFeatureGraphBasics:
    """Базовые тесты FeatureGraph."""

    def test_empty_graph(self):
        fg = FeatureGraph()
        assert fg.all_features()
        assert len(fg._declarations) == 0
        assert len(fg.find_conflicts()) == 0

    def test_graph_has_builtins(self):
        fg = FeatureGraph()
        # Builtins from CapabilityRegistry should be available
        assert fg.has_feature("candles")
        assert fg.has_feature("rsi")
        assert fg.has_feature("ema")
        assert fg.has_feature("orderbook")

    def test_register_and_declare(self):
        fg = FeatureGraph()
        fg.declare_plugin("my-plugin", provides={"rsi", "ema"})
        assert "my-plugin" in fg._declarations
        assert fg.plugin_provides("my-plugin") == {"rsi", "ema"}

    def test_declare_with_requires(self):
        fg = FeatureGraph()
        fg.declare_plugin("consumer", provides={"signal"}, requires={"candles", "rsi"})
        assert fg.plugin_requires("consumer") == {"candles", "rsi"}
        assert fg.plugin_provides("consumer") == {"signal"}

    def test_find_providers(self):
        fg = FeatureGraph()
        fg.declare_plugin("ta-lib", provides={"rsi", "ema", "macd"})
        assert fg.find_providers("rsi") == ["ta-lib"]
        assert fg.find_providers("nonexistent") == []

    def test_find_consumers(self):
        fg = FeatureGraph()
        fg.declare_plugin("strat", requires={"candles", "rsi"})
        consumers = fg.find_consumers("candles")
        assert "strat" in consumers
        assert fg.find_consumers("rsi") == ["strat"]

    def test_register_feature(self):
        fg = FeatureGraph()
        fg.register_feature("custom", "Custom feature", "custom-group")
        assert fg.has_feature("custom")
        info = fg.get_feature_info("custom")
        assert info is not None
        assert info.description == "Custom feature"
        assert info.group == "custom-group"

    def test_auto_register_on_declare(self):
        fg = FeatureGraph()
        fg.declare_plugin("p1", provides={"unknown-feature"})
        assert fg.has_feature("unknown-feature")


class TestFeatureGraphConflicts:
    """Тесты детекции конфликтов."""

    def test_no_conflict_single_provider(self):
        fg = FeatureGraph()
        fg.declare_plugin("p1", provides={"rsi"})
        assert len(fg.find_conflicts()) == 0

    def test_conflict_two_providers(self):
        fg = FeatureGraph()
        fg.declare_plugin("p1", provides={"rsi"})
        fg.declare_plugin("p2", provides={"rsi"})
        conflicts = fg.find_conflicts()
        assert len(conflicts) == 1
        assert conflicts[0].feature == "rsi"
        assert "p1" in conflicts[0].plugins
        assert "p2" in conflicts[0].plugins

    def test_conflict_detected_after_registration(self):
        fg = FeatureGraph()
        fg.declare_plugin("p1", provides={"feature-x"})
        fg.declare_plugin("p2", provides={"feature-x"})
        conflicts = fg.find_conflicts()
        assert len(conflicts) == 1
        assert conflicts[0].feature == "feature-x"

    def test_no_conflict_different_features(self):
        fg = FeatureGraph()
        fg.declare_plugin("p1", provides={"rsi"})
        fg.declare_plugin("p2", provides={"ema"})
        assert len(fg.find_conflicts()) == 0

    def test_resolve_conflict_with_preference(self):
        fg = FeatureGraph()
        fg.declare_plugin("p1", provides={"feature-x"})
        fg.declare_plugin("p2", provides={"feature-x"})
        conflicts = fg.find_conflicts()
        assert len(conflicts) == 1

        resolution = fg.resolve(prefer={"feature-x": "p1"})
        assert resolution.provider_map["feature-x"] == "p1"
        # Conflict should be resolved
        assert resolution.conflicts[0].resolved
        assert resolution.conflicts[0].chosen == "p1"


class TestFeatureGraphOrphans:
    """Тесты поиска orphan-фич."""

    def test_no_orphans(self):
        fg = FeatureGraph()
        fg.declare_plugin("provider", provides={"candles"})
        fg.declare_plugin("consumer", requires={"candles"})
        assert len(fg.find_orphans()) == 0

    def test_orphan_detected(self):
        fg = FeatureGraph()
        fg.declare_plugin("consumer", requires={"candles"})
        # candles is builtin and has builtin consumer marker
        # Actually, `find_orphans` checks if any plugin PROVIDES it
        # Builtins are in CapabilityRegistry but not in _providers
        # So candles will show as orphan IF some plugin requires it
        assert "candles" in fg.find_orphans()

    def test_orphan_resolved_by_adding_provider(self):
        fg = FeatureGraph()
        fg.declare_plugin("consumer", requires={"feature-z"})
        assert "feature-z" in fg.find_orphans()
        fg.declare_plugin("provider", provides={"feature-z"})
        assert len(fg.find_orphans()) == 0

    def test_orphan_in_resolution(self):
        fg = FeatureGraph()
        fg.declare_plugin("consumer", requires={"feature-y"})
        resolution = fg.resolve()
        assert "feature-y" in resolution.missing
        assert not resolution.success  # strict=False by default but orphan is still a problem


class TestFeatureGraphResolution:
    """Тесты разрешения фич."""

    def test_simple_resolution(self):
        fg = FeatureGraph()
        fg.declare_plugin("ta", provides={"rsi", "ema"})
        fg.declare_plugin("strat", requires={"rsi", "candles"})
        resolution = fg.resolve()
        assert resolution.provider_map["rsi"] == "ta"
        assert "candles" not in resolution.provider_map  # no provider registered

    def test_resolution_all_ok(self):
        fg = FeatureGraph()
        fg.declare_plugin("ta", provides={"rsi", "ema", "macd"})
        fg.declare_plugin("strat", requires={"rsi", "ema"})
        resolution = fg.resolve()
        assert resolution.success
        assert resolution.provider_map["rsi"] == "ta"
        assert resolution.provider_map["ema"] == "ta"

    def test_resolve_single_plugin(self):
        fg = FeatureGraph()
        fg.declare_plugin("ta", provides={"rsi", "ema"})
        fg.declare_plugin("strat", requires={"rsi", "ema"})
        resolution = fg.resolve_plugin("strat")
        assert resolution.provider_map["rsi"] == "ta"
        assert resolution.provider_map["ema"] == "ta"

    def test_resolve_unregistered_plugin(self):
        fg = FeatureGraph()
        resolution = fg.resolve_plugin("nonexistent")
        assert not resolution.success
        assert "not registered" in resolution.missing[0]

    def test_strict_resolution_with_missing(self):
        fg = FeatureGraph()
        fg.declare_plugin("strat", requires={"missing-feature"})
        # strict=True — любые проблемы = failure
        resolution = fg.resolve(strict=True)
        assert not resolution.success
        assert "missing-feature" in resolution.missing


class TestFeatureGraphAutoDiscovery:
    """Тесты auto-discovery."""

    def test_auto_discover_by_feature(self):
        fg = FeatureGraph()
        fg.declare_plugin("ta", provides={"rsi", "ema", "macd"})
        fg.declare_plugin("volume", provides={"vwap", "volume_profile"})
        result = fg.auto_discover({"rsi", "ema"})
        assert "ta" in result

    def test_auto_discover_with_optional(self):
        fg = FeatureGraph()
        fg.declare_plugin("premium", provides={"feature-a", "feature-b", "feature-c"})
        fg.declare_plugin("standard", provides={"feature-a", "feature-b"})
        result = fg.auto_discover({"feature-a", "feature-b"}, optional_features={"feature-c"})
        # premium covers optional too
        assert result.index("premium") < result.index("standard")

    def test_auto_discover_partial_ranking(self):
        fg = FeatureGraph()
        fg.declare_plugin("full", provides={"feature-a", "feature-b", "feature-c"})
        fg.declare_plugin("partial", provides={"feature-a", "feature-b"})
        fg.declare_plugin("minimal", provides={"feature-a"})
        result = fg.auto_discover({"feature-a", "feature-b"})
        # full ranks highest (covers 2), then partial (covers 2), then minimal (covers 1)
        assert result.index("full") < result.index("partial")
        assert result.index("partial") < result.index("minimal")


class TestFeatureGraphComputeOrder:
    """Тесты топологического порядка вычисления."""

    def test_compute_order_simple(self):
        fg = FeatureGraph()
        # Builtins have deps: rsi → candles, bollinger → sma → candles
        order = fg.compute_order(["rsi", "bollinger"])
        assert len(order) >= 3
        names = [c.name for c in order]
        # candles must come before rsi and bollinger
        assert names.index("candles") < names.index("rsi")
        assert names.index("candles") < names.index("bollinger")
        # sma must come before bollinger
        assert names.index("sma") < names.index("bollinger")

    def test_compute_order_all(self):
        fg = FeatureGraph()
        order = fg.compute_order()
        assert len(order) >= 14  # all builtins
        names = [c.name for c in order]
        # Check transitive dependency: macd → candles
        assert names.index("candles") < names.index("macd")

    def test_compute_order_cycle(self):
        fg = FeatureGraph()
        # Manually register a cycle
        fg.register_feature("a", dependencies=["b"])
        fg.register_feature("b", dependencies=["a"])
        with pytest.raises(FeatureGraphError):
            fg.compute_order(["a"])


class TestFeatureGraphIntegration:
    """Тесты интеграции между FeatureGraph и другими компонентами."""

    def test_plugin_dependencies_from_features(self):
        fg = FeatureGraph()
        fg.declare_plugin("signal", requires={"rsi", "ema"}, provides={"signal_alerts"})
        fg.declare_plugin("ta", provides={"rsi", "ema"})
        resolution = fg.resolve()
        deps = fg.build_plugin_dependencies(resolution)
        # signal depends on ta
        assert "ta" in deps.get("signal", [])

    def test_remove_plugin_cleans_up(self):
        fg = FeatureGraph()
        fg.declare_plugin("p1", provides={"feature-a"})
        fg.declare_plugin("p2", provides={"feature-b"})
        fg.remove_plugin("p1")
        assert "p1" not in fg._declarations
        assert fg.find_providers("feature-a") == []

    def test_remove_plugin_orphan_effect(self):
        fg = FeatureGraph()
        fg.declare_plugin("provider", provides={"feature-z"})
        fg.declare_plugin("consumer", requires={"feature-z"})
        assert len(fg.find_orphans()) == 0
        fg.remove_plugin("provider")
        assert "feature-z" in fg.find_orphans()

    def test_clear_resets_state(self):
        fg = FeatureGraph()
        fg.declare_plugin("p1", provides={"rsi"})
        fg.clear()
        assert len(fg._declarations) == 0
        assert len(fg._providers) == 0

    def test_query_methods(self):
        fg = FeatureGraph()
        fg.declare_plugin("p1", provides={"rsi"}, requires={"candles"})
        assert fg.plugin_provides("p1") == {"rsi"}
        assert fg.plugin_requires("p1") == {"candles"}
        assert fg.get_declaration("p1") is not None
        assert fg.get_declaration("nonexistent") is None


class TestFeatureGraphEdgeCases:
    """Edge cases."""

    def test_redeclare_plugin_updates(self):
        fg = FeatureGraph()
        fg.declare_plugin("p1", provides={"rsi"})
        fg.declare_plugin("p1", provides={"ema"})
        # Should have been updated
        assert fg.plugin_provides("p1") == {"ema"}
        assert fg.plugin_provides("p1") != {"rsi"}

    def test_feature_info_from_builtins(self):
        fg = FeatureGraph()
        info = fg.get_feature_info("candles")
        assert info is not None
        assert info.name == "candles"
        assert info.group == "data"  # from _BUILTIN_CAPABILITY_DB

    def test_feature_info_custom(self):
        fg = FeatureGraph()
        fg.register_feature("my_feature", "Test feature", "test", ["candles"])
        info = fg.get_feature_info("my_feature")
        assert info is not None
        assert info.description == "Test feature"
        assert "candles" in info.dependencies

    def test_conflict_features(self):
        """Проверка структуры FeatureConflict."""
        c = FeatureConflict(feature="rsi", plugins=["p1", "p2"])
        assert c.feature == "rsi"
        assert c.plugins == ["p1", "p2"]
        assert not c.resolved

        c.resolved = True
        c.chosen = "p1"
        assert c.resolved


class TestFeatureGraphSummary:
    """Тесты summary."""

    def test_summary_empty(self):
        fg = FeatureGraph()
        summary = fg.summary()
        assert "plugins" in summary

    def test_summary_with_plugins(self):
        fg = FeatureGraph()
        fg.declare_plugin("p1", provides={"rsi"})
        fg.declare_plugin("p2", requires={"rsi"})
        summary = fg.summary()
        assert "p1" not in summary  # plugin names not in summary (uses counts)
        assert "plugins" in summary
