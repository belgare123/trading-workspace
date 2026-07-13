"""Tests for Plugin API (Phase 6.8)."""

from core.strategy.health_monitor import PluginHealth, PluginHealthMonitor
from core.strategy.plugin_api import (
    APICallRecord,
    PermissionChecker,
    PluginAPI,
    PluginAPIFactory,
    PluginAPIVersion,
)


class TestPluginAPI:
    """PluginAPI — публичный интерфейс плагина."""

    def test_basic(self):
        api = PluginAPI(plugin="TestPlugin")
        assert api.plugin_name == "TestPlugin"
        assert api.api_version == "2.0"
        assert api.call_count == 0

    def test_api_version_v1(self):
        api = PluginAPI(plugin="TP", api_version=PluginAPIVersion.V1)
        assert api.api_version == "1.0"

    def test_permission_checks_no_checker(self):
        """Без permission_checker все методы возвращают True."""
        api = PluginAPI(plugin="TP")
        assert api.can_read_market_data()
        assert api.can_send_signals()
        assert api.can_trade()
        assert api.can_read_filesystem()
        assert api.can_write_filesystem()
        assert api.can_network()

    def test_permission_checks_with_checker(self):
        def checker(plugin: str, permission: str) -> bool:
            return permission == "market_data"

        api = PluginAPI(plugin="TP", permission_checker=checker)
        assert api.can_read_market_data()
        assert not api.can_send_signals()
        assert not api.can_trade()

    def test_permission_checker_plugin_scoped(self):
        def checker(plugin: str, permission: str) -> bool:
            if plugin == "Privileged":
                return True
            return permission == "market_data"

        priv = PluginAPI(plugin="Privileged", permission_checker=checker)
        assert priv.can_trade()

        normal = PluginAPI(plugin="Normal", permission_checker=checker)
        assert not normal.can_trade()

    def test_call_tracking(self):
        api = PluginAPI(plugin="TP")
        assert api.call_count == 0

        api.report_health(PluginHealth.HEALTHY)
        assert api.call_count == 1

        api.report_health(PluginHealth.DEGRADED, "slow")
        assert api.call_count == 2

    def test_call_log(self):
        api = PluginAPI(plugin="TP")
        api.report_health(PluginHealth.HEALTHY)
        log = api.call_log
        assert len(log) == 1
        assert log[0].method == "report_health"
        assert log[0].plugin == "TP"
        assert log[0].duration == 0.0

    def test_clear_call_log(self):
        api = PluginAPI(plugin="TP")
        api.report_health(PluginHealth.HEALTHY)
        assert api.call_count == 1
        api.clear_call_log()
        assert api.call_count == 0

    def test_report_health_with_monitor(self):
        monitor = PluginHealthMonitor()
        api = PluginAPI(plugin="TP", health_monitor=monitor)
        result = api.report_health(PluginHealth.HEALTHY)
        assert result is not None
        assert result.plugin == "TP"
        assert result.status == PluginHealth.HEALTHY

    def test_report_health_without_monitor(self):
        api = PluginAPI(plugin="TP")
        result = api.report_health(PluginHealth.HEALTHY)
        assert result is None

    def test_summary(self):
        def checker(plugin: str, permission: str) -> bool:
            return permission in ("market_data", "signals")

        api = PluginAPI(plugin="TP", permission_checker=checker)
        s = api.summary()
        assert s["plugin"] == "TP"
        assert s["api_version"] == "2.0"
        assert s["call_count"] == 0
        assert s["permissions"]["market_data"] is True
        assert s["permissions"]["trades"] is False

    def test_repr(self):
        api = PluginAPI(plugin="TP")
        r = repr(api)
        assert "TP" in r
        assert "2.0" in r


class TestPluginAPIFactory:
    """PluginAPIFactory — фабрика API для плагинов."""

    def test_create_api(self):
        factory = PluginAPIFactory()
        api = factory.for_plugin("TestPlugin")
        assert isinstance(api, PluginAPI)
        assert api.plugin_name == "TestPlugin"

    def test_caching(self):
        factory = PluginAPIFactory()
        api1 = factory.for_plugin("TP")
        api2 = factory.for_plugin("TP")
        assert api1 is api2
        assert factory.active_count == 1

    def test_multiple_plugins(self):
        factory = PluginAPIFactory()
        a = factory.for_plugin("A")
        b = factory.for_plugin("B")
        assert a is not b
        assert factory.active_count == 2

    def test_clear(self):
        factory = PluginAPIFactory()
        factory.for_plugin("TP")
        assert factory.active_count == 1
        factory.clear()
        assert factory.active_count == 0

    def test_set_permission_checker_clears_cache(self):
        factory = PluginAPIFactory()
        api1 = factory.for_plugin("TP")
        factory.set_permission_checker(lambda p, perm: True)
        api2 = factory.for_plugin("TP")
        assert api1 is not api2  # new instance

    def test_default_checker(self):
        factory = PluginAPIFactory()
        api = factory.for_plugin("TP")
        assert api.can_trade()  # no checker = True

    def test_checker_via_factory(self):
        def checker(plugin: str, permission: str) -> bool:
            return permission == "market_data"

        factory = PluginAPIFactory(permission_checker=checker)
        api = factory.for_plugin("TP")
        assert api.can_read_market_data()
        assert not api.can_trade()


class TestAPICallRecord:
    """APICallRecord."""

    def test_to_dict(self):
        rec = APICallRecord(
            method="report_health",
            plugin="TP",
            duration=0.05,
            timestamp=1000.0,
        )
        d = rec.to_dict()
        assert d["method"] == "report_health"
        assert d["plugin"] == "TP"
        assert d["duration"] == 0.05
        assert d["timestamp"] == 1000.0
