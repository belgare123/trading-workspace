"""Tests for Plugin Permissions (Phase 6.7)."""

from core.strategy.permissions import (
    Permission,
    PermissionPolicy,
    PermissionRule,
    PermissionSet,
    PluginPermissions,
)


class TestPermissionSet:
    """PermissionSet — базовые операции."""

    def test_empty_has_none(self):
        ps = PermissionSet()
        assert not ps.has(Permission.MARKET_DATA)
        assert not ps.has(Permission.TRADES)

    def test_add_permissions(self):
        ps = PermissionSet(Permission.MARKET_DATA, Permission.SIGNALS)
        assert ps.has(Permission.MARKET_DATA)
        assert ps.has(Permission.SIGNALS)
        assert not ps.has(Permission.TRADES)

    def test_all_grants_everything(self):
        ps = PermissionSet(Permission.ALL)
        assert ps.has(Permission.MARKET_DATA)
        assert ps.has(Permission.SIGNALS)
        assert ps.has(Permission.TRADES)
        assert ps.has(Permission.FILESYSTEM_READ)
        assert ps.has(Permission.FILESYSTEM_WRITE)
        assert ps.has(Permission.NETWORK)

    def test_has_any(self):
        ps = PermissionSet(Permission.MARKET_DATA)
        assert ps.has_any(Permission.MARKET_DATA, Permission.TRADES)
        assert not ps.has_any(Permission.TRADES, Permission.NETWORK)

    def test_has_all(self):
        ps = PermissionSet(Permission.MARKET_DATA, Permission.SIGNALS)
        assert ps.has_all(Permission.MARKET_DATA, Permission.SIGNALS)
        assert not ps.has_all(Permission.MARKET_DATA, Permission.TRADES)

    def test_union(self):
        a = PermissionSet(Permission.MARKET_DATA)
        b = PermissionSet(Permission.SIGNALS)
        c = a.union(b)
        assert c.has(Permission.MARKET_DATA)
        assert c.has(Permission.SIGNALS)
        assert not c.has(Permission.TRADES)

    def test_intersection(self):
        a = PermissionSet(Permission.MARKET_DATA, Permission.SIGNALS)
        b = PermissionSet(Permission.SIGNALS, Permission.TRADES)
        c = a.intersection(b)
        assert not c.has(Permission.MARKET_DATA)
        assert c.has(Permission.SIGNALS)
        assert not c.has(Permission.TRADES)

    def test_from_list(self):
        ps = PermissionSet.from_list(["market_data", "signals"])
        assert ps.has(Permission.MARKET_DATA)
        assert ps.has(Permission.SIGNALS)
        assert not ps.has(Permission.TRADES)

    def test_from_list_empty(self):
        ps = PermissionSet.from_list([])
        assert not ps.has(Permission.MARKET_DATA)

    def test_to_list(self):
        ps = PermissionSet(Permission.MARKET_DATA, Permission.SIGNALS)
        result = ps.to_list()
        assert Permission.MARKET_DATA in result
        assert Permission.SIGNALS in result
        assert Permission.TRADES not in result

    def test_equality(self):
        a = PermissionSet(Permission.MARKET_DATA)
        b = PermissionSet(Permission.MARKET_DATA)
        assert a == b

    def test_repr_empty(self):
        assert repr(PermissionSet()) == "PermissionSet(<empty>)"

    def test_repr_with_perms(self):
        r = repr(PermissionSet(Permission.MARKET_DATA))
        assert "market_data" in r


class TestPluginPermissions:
    """PluginPermissions — per-plugin permission."""

    def test_basic(self):
        pp = PluginPermissions(
            plugin="TestPlugin",
            requested=PermissionSet(Permission.MARKET_DATA),
            granted=PermissionSet(Permission.MARKET_DATA),
        )
        assert pp.can(Permission.MARKET_DATA)
        assert not pp.can(Permission.TRADES)

    def test_grant(self):
        pp = PluginPermissions(plugin="TestPlugin")
        assert not pp.can(Permission.MARKET_DATA)
        pp.grant(Permission.MARKET_DATA)
        assert pp.can(Permission.MARKET_DATA)

    def test_revoke(self):
        pp = PluginPermissions(
            plugin="TestPlugin",
            granted=PermissionSet(Permission.MARKET_DATA, Permission.SIGNALS),
        )
        assert pp.can(Permission.MARKET_DATA)
        assert pp.can(Permission.SIGNALS)
        pp.revoke(Permission.SIGNALS)
        assert pp.can(Permission.MARKET_DATA)
        assert not pp.can(Permission.SIGNALS)

    def test_summary(self):
        pp = PluginPermissions(
            plugin="TP",
            requested=PermissionSet(Permission.MARKET_DATA),
            granted=PermissionSet(Permission.MARKET_DATA, Permission.SIGNALS),
        )
        s = pp.summary()
        assert s["plugin"] == "TP"
        assert "market_data" in s["requested"]
        assert "signals" in s["granted"]


class TestPermissionPolicy:
    """PermissionPolicy — default-deny политика."""

    def test_default_none(self):
        policy = PermissionPolicy()
        perms = policy.resolve("TestPlugin", PermissionSet(Permission.MARKET_DATA))
        assert not perms.can(Permission.MARKET_DATA)

    def test_default_grant(self):
        policy = PermissionPolicy(
            default_grant=PermissionSet(Permission.MARKET_DATA),
        )
        perms = policy.resolve("TestPlugin", PermissionSet(Permission.MARKET_DATA))
        assert perms.can(Permission.MARKET_DATA)
        assert not perms.can(Permission.SIGNALS)

    def test_rule_wildcard(self):
        policy = PermissionPolicy()
        policy.add_rule("*", Permission.MARKET_DATA, Permission.SIGNALS)
        perms = policy.resolve("AnyPlugin", PermissionSet(Permission.MARKET_DATA))
        assert perms.can(Permission.MARKET_DATA)

    def test_rule_prefix(self):
        policy = PermissionPolicy()
        policy.add_rule("Momentum*", Permission.TRADES)
        perms = policy.resolve("MomentumStrategy", PermissionSet(Permission.TRADES))
        assert perms.can(Permission.TRADES)
        perms2 = policy.resolve("OtherStrategy", PermissionSet(Permission.TRADES))
        assert not perms2.can(Permission.TRADES)

    def test_rule_exact(self):
        policy = PermissionPolicy()
        policy.add_rule("ExactPlugin", Permission.TRADES)
        perms = policy.resolve("ExactPlugin", PermissionSet(Permission.TRADES))
        assert perms.can(Permission.TRADES)
        perms2 = policy.resolve("OtherPlugin", PermissionSet(Permission.TRADES))
        assert not perms2.can(Permission.TRADES)

    def test_override_takes_precedence(self):
        policy = PermissionPolicy(
            default_grant=PermissionSet(Permission.MARKET_DATA),
        )
        policy.add_rule("T*", Permission.TRADES)
        policy.set_override("TestPlugin", Permission.SIGNALS)
        perms = policy.resolve("TestPlugin", PermissionSet(
            Permission.MARKET_DATA, Permission.SIGNALS, Permission.TRADES,
        ))
        # Override = only SIGNALS, intersected with requested
        assert not perms.can(Permission.MARKET_DATA)
        assert perms.can(Permission.SIGNALS)
        assert not perms.can(Permission.TRADES)

    def test_requested_limits_granted(self):
        """Даже если политика выдаёт больше, granted не превышает requested."""
        policy = PermissionPolicy(
            default_grant=PermissionSet(Permission.ALL),
        )
        perms = policy.resolve("TestPlugin", PermissionSet(Permission.MARKET_DATA))
        assert perms.can(Permission.MARKET_DATA)
        assert not perms.can(Permission.TRADES)  # Not requested

    def test_check_permission(self):
        policy = PermissionPolicy()
        perms = PluginPermissions(
            plugin="TP",
            granted=PermissionSet(Permission.MARKET_DATA),
        )
        assert policy.check("TP", Permission.MARKET_DATA, perms)
        assert not policy.check("TP", Permission.TRADES, perms)

    def test_summary(self):
        policy = PermissionPolicy()
        policy.add_rule("*", Permission.MARKET_DATA)
        policy.add_rule("Premium*", Permission.TRADES)
        s = policy.summary()
        assert len(s) == 2
        assert s[0]["pattern"] == "*"
