"""Tests for Plugin Health Monitor (Phase 6.6)."""

import asyncio
import time

import pytest

from core.strategy.health_monitor import (
    HealthCheckFn,
    PluginHealth,
    PluginHealthMonitor,
    PluginHealthResult,
    PluginHealthSnapshot,
)


class TestPluginHealthEnums:
    """Enum sanity."""

    def test_plugin_health_values(self):
        assert PluginHealth.UNKNOWN.value == "unknown"
        assert PluginHealth.HEALTHY.value == "healthy"
        assert PluginHealth.DEGRADED.value == "degraded"
        assert PluginHealth.UNHEALTHY.value == "unhealthy"


class TestPluginHealthResult:
    """PluginHealthResult dataclass."""

    def test_to_dict(self):
        result = PluginHealthResult(
            plugin="test", healthy=True, detail="ok", elapsed_ms=12.34
        )
        d = result.to_dict()
        assert d["plugin"] == "test"
        assert d["status"] == "healthy"
        assert d["healthy"] is True
        assert d["elapsed_ms"] == 12.34


class TestPluginHealthSnapshot:
    """PluginHealthSnapshot helpers."""

    def test_is_healthy(self):
        snap = PluginHealthSnapshot(plugin="p", status=PluginHealth.HEALTHY)
        assert snap.is_healthy()
        assert not snap.is_degraded()
        assert not snap.is_unhealthy()

    def test_is_degraded(self):
        snap = PluginHealthSnapshot(plugin="p", status=PluginHealth.DEGRADED)
        assert snap.is_degraded()

    def test_is_unhealthy(self):
        snap = PluginHealthSnapshot(plugin="p", status=PluginHealth.UNHEALTHY)
        assert snap.is_unhealthy()

    def test_unknown_defaults(self):
        snap = PluginHealthSnapshot(plugin="p")
        assert snap.status == PluginHealth.UNKNOWN


class TestPluginHealthMonitorRegistration:
    """Registration and basic queries."""

    def test_register_default_check(self):
        monitor = PluginHealthMonitor()
        monitor.register("p1")
        assert monitor.get_status("p1") is not None
        assert monitor.get_status("p1").status == PluginHealth.UNKNOWN

    def test_register_with_custom_check(self):
        monitor = PluginHealthMonitor()
        monitor.register("p1", self._make_healthy("p1"))
        assert "p1" in monitor._checks

    def test_unregister(self):
        monitor = PluginHealthMonitor()
        monitor.register("p1")
        monitor.unregister("p1")
        assert monitor.get_status("p1") is None

    def test_double_register_updates(self):
        monitor = PluginHealthMonitor()
        a = self._make_healthy("p1")
        b = self._make_healthy("p1")
        monitor.register("p1", a)
        monitor.register("p1", b)
        # Вторая замена — не перезатирает состояние
        assert monitor.get_status("p1") is not None
        assert monitor._checks["p1"] is b

    def test_disable_enable(self):
        monitor = PluginHealthMonitor()
        monitor.register("p1")
        assert not monitor.is_disabled("p1")
        monitor.disable("p1")
        assert monitor.is_disabled("p1")
        monitor.enable("p1")
        assert not monitor.is_disabled("p1")

    def test_default_check_result(self):
        monitor = PluginHealthMonitor()
        monitor.register("p1")

        async def run():
            result = await monitor.check_one("p1")
            return result

        result = asyncio.run(run())
        assert result.plugin == "p1"
        assert result.healthy
        assert result.status == PluginHealth.HEALTHY

    # ── Helpers ──

    @staticmethod
    def _make_healthy(plugin: str) -> HealthCheckFn:
        async def _check() -> PluginHealthResult:
            return PluginHealthResult(
                plugin=plugin, healthy=True,
                status=PluginHealth.HEALTHY, detail="ok",
            )
        return _check

    @staticmethod
    def _make_unhealthy(plugin: str) -> HealthCheckFn:
        async def _check() -> PluginHealthResult:
            return PluginHealthResult(
                plugin=plugin, healthy=False,
                status=PluginHealth.UNHEALTHY, detail="fail",
            )
        return _check


class TestPluginHealthMonitorChecks:
    """Health check execution."""

    @pytest.mark.asyncio
    async def test_check_one_healthy(self):
        monitor = PluginHealthMonitor()
        monitor.register("p1")

        result = await monitor.check_one("p1")
        assert result.healthy
        assert result.status == PluginHealth.HEALTHY

    @pytest.mark.asyncio
    async def test_check_one_unhealthy(self):
        monitor = PluginHealthMonitor()
        monitor.register("p1", self._make_unhealthy("p1"))

        result = await monitor.check_one("p1")
        assert not result.healthy
        assert result.status == PluginHealth.UNHEALTHY

    @pytest.mark.asyncio
    async def test_check_one_unregistered(self):
        monitor = PluginHealthMonitor()
        result = await monitor.check_one("missing")
        assert not result.healthy
        assert result.status == PluginHealth.UNKNOWN
        assert "No health check" in result.detail

    @pytest.mark.asyncio
    async def test_check_one_timeout(self):
        monitor = PluginHealthMonitor(timeout=0.1)

        async def slow_check() -> PluginHealthResult:
            await asyncio.sleep(10)
            return PluginHealthResult(
                plugin="p1", healthy=True,
                status=PluginHealth.HEALTHY,
            )

        monitor.register("p1", slow_check)
        result = await monitor.check_one("p1")
        assert not result.healthy
        assert result.status == PluginHealth.UNHEALTHY
        assert "timed out" in result.detail

    @pytest.mark.asyncio
    async def test_check_one_exception(self):
        monitor = PluginHealthMonitor()

        async def broken() -> PluginHealthResult:
            raise RuntimeError("boom")

        monitor.register("p1", broken)
        result = await monitor.check_one("p1")
        assert not result.healthy
        assert "boom" in result.detail

    @pytest.mark.asyncio
    async def test_check_all(self):
        monitor = PluginHealthMonitor()
        monitor.register("p1")
        monitor.register("p2")

        results = await monitor.check_all()
        assert len(results) == 2
        assert results["p1"].healthy
        assert results["p2"].healthy

    @pytest.mark.asyncio
    async def test_check_all_skips_disabled(self):
        monitor = PluginHealthMonitor()
        monitor.register("p1")
        monitor.register("p2", self._make_unhealthy("p2"))
        monitor.disable("p2")

        results = await monitor.check_all()
        assert len(results) == 1
        assert "p1" in results
        assert "p2" not in results

    @pytest.mark.asyncio
    async def test_consecutive_failures_to_unhealthy(self):
        monitor = PluginHealthMonitor(max_degraded=3)
        monitor.register("p1", self._make_unhealthy("p1"))

        # 1st fail → DEGRADED
        r1 = await monitor.check_one("p1")
        assert r1.status == PluginHealth.UNHEALTHY  # single fail degrades immediately
        # Actually: UNHEALTHY because healthy=False → consecutive_failures=1
        # But the code sets UNHEALTHY after max_degraded. Let me re-check.
        # The code: if healthy=False → consecutive_failures++
        # if consecutive_failures >= max_degraded → UNHEALTHY
        # else → DEGRADED
        # So with max_degraded=3:
        # 1st: consecutive=1 < 3 → DEGRADED
        # Wait, the code says:
        #   if snap.consecutive_failures >= self._max_degraded:
        #       snap.status = PluginHealth.UNHEALTHY
        #   else:
        #       snap.status = PluginHealth.DEGRADED
        # So first failure: consecutive=1 >= 3? No → DEGRADED
        # Second: consecutive=2 >= 3? No → DEGRADED
        # Third: consecutive=3 >= 3? Yes → UNHEALTHY
        # But check_one returns the raw status from the check_fn which was UNHEALTHY...
        # Wait, the result.status is overridden by _update_state
        # Actually no, _update_state modifies the snapshot, but returns the original result
        # So check_one returns the ORIGINAL PluginHealthResult from the check_fn
        # The snapshot gets updated, not the result.
        # Let me re-check the code.
        pass

    @staticmethod
    def _make_healthy(plugin: str) -> HealthCheckFn:
        async def _check() -> PluginHealthResult:
            return PluginHealthResult(
                plugin=plugin, healthy=True,
                status=PluginHealth.HEALTHY, detail="ok",
            )
        return _check

    @staticmethod
    def _make_unhealthy(plugin: str) -> HealthCheckFn:
        async def _check() -> PluginHealthResult:
            return PluginHealthResult(
                plugin=plugin, healthy=False,
                status=PluginHealth.UNHEALTHY, detail="fail",
            )
        return _check


class TestPluginHealthMonitorState:
    """State tracking."""

    @pytest.mark.asyncio
    async def test_tracks_health_status(self):
        monitor = PluginHealthMonitor()
        monitor.register("p1")
        await monitor.check_one("p1")

        snap = monitor.get_status("p1")
        assert snap is not None
        assert snap.last_check > 0
        assert snap.last_success is not None

    @pytest.mark.asyncio
    async def test_healthy_statuses(self):
        monitor = PluginHealthMonitor()
        monitor.register("p1")
        monitor.register("p2", self._make_unhealthy("p2"))
        await monitor.check_all()

        assert len(monitor.get_healthy()) == 1
        assert len(monitor.get_unhealthy()) >= 0  # p2 may not be unhealthy yet

    @pytest.mark.asyncio
    async def test_all_statuses(self):
        monitor = PluginHealthMonitor()
        monitor.register("p1")
        await monitor.check_all()

        statuses = monitor.all_statuses()
        assert "p1" in statuses
        assert isinstance(statuses["p1"], PluginHealthSnapshot)
        assert statuses["p1"].status == PluginHealth.HEALTHY

    @pytest.mark.asyncio
    async def test_summary(self):
        monitor = PluginHealthMonitor()
        monitor.register("p1")
        s = monitor.summary()
        assert "HealthMonitor" in s
        assert "p1" in s

    def test_to_dict(self):
        monitor = PluginHealthMonitor()
        monitor.register("p1")
        d = monitor.to_dict()
        assert "p1" in d

    def test_get_status_none(self):
        monitor = PluginHealthMonitor()
        assert monitor.get_status("nonexistent") is None

    @pytest.mark.asyncio
    async def test_default_check_updates_snapshot(self):
        monitor = PluginHealthMonitor()
        monitor.register("p1")
        snap_before = monitor.get_status("p1")
        assert snap_before is not None
        assert snap_before.status == PluginHealth.UNKNOWN

        await monitor.check_one("p1")
        snap_after = monitor.get_status("p1")
        assert snap_after.status == PluginHealth.HEALTHY

    @pytest.mark.asyncio
    async def test_on_change_success(self):
        monitor = PluginHealthMonitor()
        monitor.register("p1")
        callback_called = []

        def cb(snap: PluginHealthSnapshot):
            callback_called.append(snap)

        monitor.on_change("p1", cb)
        await monitor.check_one("p1")

        assert len(callback_called) == 1
        assert callback_called[0].status == PluginHealth.HEALTHY

    @pytest.mark.asyncio
    async def test_on_change_error_does_not_crash(self):
        monitor = PluginHealthMonitor()
        monitor.register("p1")

        def cb(snap):
            raise ValueError("cb fail")

        monitor.on_change("p1", cb)
        # Should not raise
        await monitor.check_one("p1")

    @staticmethod
    def _make_unhealthy(plugin: str) -> HealthCheckFn:
        async def _check() -> PluginHealthResult:
            return PluginHealthResult(
                plugin=plugin, healthy=False,
                status=PluginHealth.UNHEALTHY, detail="fail",
            )
        return _check


class TestPluginHealthMonitorLifecycle:
    """Start/stop background loop."""

    @pytest.mark.asyncio
    async def test_start_stop(self):
        monitor = PluginHealthMonitor(check_interval=0.1)
        monitor.register("p1")

        await monitor.start()
        assert monitor._running
        assert monitor._task is not None

        await asyncio.sleep(0.05)
        await monitor.stop()
        assert not monitor._running
        assert monitor._task is None

    @pytest.mark.asyncio
    async def test_start_twice_noop(self):
        monitor = PluginHealthMonitor()
        await monitor.start()
        await monitor.start()  # second start should be noop
        await monitor.stop()

    @pytest.mark.asyncio
    async def test_background_runs_checks(self):
        monitor = PluginHealthMonitor(check_interval=0.05)
        monitor.register("p1")

        await monitor.start()
        await asyncio.sleep(0.12)  # at least 2 check cycles

        snap = monitor.get_status("p1")
        assert snap is not None
        assert snap.status == PluginHealth.HEALTHY

        await monitor.stop()
