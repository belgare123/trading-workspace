"""Tests for Dependency Resolver (Phase 6.2)."""

import pytest

from core.strategy.dependency import (
    CircularDependencyError,
    DependencyError,
    DependencyGraph,
    DependencyResolver,
    MissingDependencyError,
    ResolveReport,
    VersionMismatchError,
    _check_version_constraint,
    _parse_version,
)


# ═══════════════════════════════════════════════════════════════════
#  SemVer helpers
# ═══════════════════════════════════════════════════════════════════

class TestParseVersion:
    def test_simple(self):
        assert _parse_version("1.0.0") == (1, 0, 0)
        assert _parse_version("2.1") == (2, 1)
        assert _parse_version("3") == (3,)

    def test_with_prefix(self):
        assert _parse_version("v1.0.0") == (1, 0, 0)
        assert _parse_version("V2.1.0") == (2, 1, 0)

    def test_wildcard(self):
        assert _parse_version("*") == (0,)
        assert _parse_version("any") == (0,)
        assert _parse_version("") == (0,)


class TestCheckVersionConstraint:
    def test_exact(self):
        assert _check_version_constraint("1.0.0", "1.0.0")
        assert not _check_version_constraint("1.0.0", "2.0.0")

    def test_gte(self):
        assert _check_version_constraint("2.0.0", ">=1.0.0")
        assert _check_version_constraint("1.0.0", ">=1.0.0")
        assert not _check_version_constraint("0.9.0", ">=1.0.0")

    def test_gt(self):
        assert _check_version_constraint("2.0.0", ">1.0.0")
        assert not _check_version_constraint("1.0.0", ">1.0.0")

    def test_lte(self):
        assert _check_version_constraint("1.0.0", "<=1.0.0")
        assert _check_version_constraint("0.9.0", "<=1.0.0")
        assert not _check_version_constraint("2.0.0", "<=1.0.0")

    def test_lt(self):
        assert _check_version_constraint("0.9.0", "<1.0.0")
        assert not _check_version_constraint("1.0.0", "<1.0.0")

    def test_caret(self):
        assert _check_version_constraint("2.1.0", "^2.0.0")
        assert _check_version_constraint("2.5.0", "^2.0.0")
        assert not _check_version_constraint("3.0.0", "^2.0.0")
        assert not _check_version_constraint("1.9.0", "^2.0.0")

    def test_tilde(self):
        assert _check_version_constraint("2.1.0", "~2.1.0")
        assert _check_version_constraint("2.1.5", "~2.1.0")
        assert not _check_version_constraint("2.2.0", "~2.1.0")
        assert not _check_version_constraint("3.0.0", "~2.1.0")

    def test_wildcard(self):
        assert _check_version_constraint("3.0.0", "*")
        assert _check_version_constraint("0.0.1", "*")


class TestDependencyGraph:
    def test_add_node(self):
        g = DependencyGraph()
        g.add_node("A", version="1.0.0")
        assert g.has_node("A")
        assert g.get_node("A").version == "1.0.0"
        assert g.size == 1

    def test_add_dependency(self):
        g = DependencyGraph()
        g.add_node("A", version="1.0.0")
        g.add_node("B", version="2.0.0")
        g.add_dependency("B", "A")
        assert g.dependencies_of("B") == {"A"}
        assert g.dependents_of("A") == ["B"]

    def test_add_dependency_auto_adds_node(self):
        g = DependencyGraph()
        g.add_node("A", version="1.0.0")
        g.add_dependency("B", "A")  # B auto-added
        assert g.has_node("B")
        assert g.get_node("B").version == "0.0.0"

    def test_add_dependency_missing_target_raises(self):
        g = DependencyGraph()
        g.add_node("A", version="1.0.0")
        with pytest.raises(DependencyError, match="not in the graph"):
            g.add_dependency("A", "MISSING")

    def test_remove_node(self):
        g = DependencyGraph()
        g.add_node("A")
        g.add_node("B")
        g.add_dependency("B", "A")
        g.remove_node("A")
        assert not g.has_node("A")
        assert g.dependencies_of("B") == set()

    def test_transitive_dependencies(self):
        g = DependencyGraph()
        g.add_node("A")
        g.add_node("B")
        g.add_node("C")
        g.add_dependency("C", "B")
        g.add_dependency("B", "A")
        assert g.transitive_dependencies("C") == {"A", "B"}
        assert g.transitive_dependencies("B") == {"A"}
        assert g.transitive_dependencies("A") == set()

    def test_dependents_of(self):
        g = DependencyGraph()
        g.add_node("A")
        g.add_node("B")
        g.add_node("C")
        g.add_dependency("B", "A")
        g.add_dependency("C", "A")
        assert sorted(g.dependents_of("A")) == ["B", "C"]

    def test_has_cycle_false(self):
        g = DependencyGraph()
        g.add_node("A")
        g.add_node("B")
        g.add_node("C")
        g.add_dependency("B", "A")
        g.add_dependency("C", "B")
        assert not g.has_cycle()

    def test_has_cycle_true(self):
        g = DependencyGraph()
        g.add_node("A")
        g.add_node("B")
        g.add_node("C")
        g.add_dependency("A", "B")
        g.add_dependency("B", "C")
        g.add_dependency("C", "A")
        assert g.has_cycle()

    def test_find_cycle(self):
        g = DependencyGraph()
        g.add_node("A")
        g.add_node("B")
        g.add_node("C")
        g.add_dependency("A", "B")
        g.add_dependency("B", "C")
        g.add_dependency("C", "A")
        cycle = g.find_cycle()
        assert cycle is not None
        assert len(cycle) >= 2

    def test_topological_sort_simple(self):
        g = DependencyGraph()
        g.add_node("A")
        g.add_node("B")
        g.add_dependency("B", "A")
        order = g.topological_sort()
        assert order == ["A", "B"]

    def test_topological_sort_complex(self):
        g = DependencyGraph()
        g.add_node("A")
        g.add_node("B")
        g.add_node("C")
        g.add_node("D")
        g.add_dependency("B", "A")
        g.add_dependency("C", "A")
        g.add_dependency("D", "B")
        g.add_dependency("D", "C")
        order = g.topological_sort()
        # A must be before B and C; B and C before D
        assert order.index("A") < order.index("B")
        assert order.index("A") < order.index("C")
        assert order.index("B") < order.index("D")
        assert order.index("C") < order.index("D")

    def test_cycle_detection(self):
        g = DependencyGraph()
        g.add_node("A")
        g.add_node("B")
        g.add_node("C")
        g.add_dependency("A", "B")
        g.add_dependency("B", "C")
        g.add_dependency("C", "A")
        assert g.has_cycle()
        cycle = g.find_cycle()
        assert cycle is not None
        assert len(cycle) >= 2

    def test_topological_sort_cycle_raises(self):
        g = DependencyGraph()
        g.add_node("A")
        g.add_node("B")
        g.add_dependency("A", "B")
        g.add_dependency("B", "A")
        with pytest.raises(CircularDependencyError):
            g.topological_sort()

    def test_transitive_dependencies(self):
        g = DependencyGraph()
        g.add_node("A")
        g.add_node("B")
        g.add_node("C")
        g.add_dependency("C", "B")
        g.add_dependency("B", "A")
        assert g.transitive_dependencies("C") == {"A", "B"}
        assert g.transitive_dependencies("B") == {"A"}

    def test_dependents_of(self):
        g = DependencyGraph()
        g.add_node("A")
        g.add_node("B")
        g.add_node("C")
        g.add_dependency("B", "A")
        g.add_dependency("C", "A")
        assert sorted(g.dependents_of("A")) == ["B", "C"]

    def test_remove_node(self):
        g = DependencyGraph()
        g.add_node("A")
        g.add_node("B")
        g.add_dependency("B", "A")
        g.remove_node("A")
        assert not g.has_node("A")
        assert g.dependencies_of("B") == set()

    def test_validate_clean(self):
        g = DependencyGraph()
        g.add_node("A")
        g.add_node("B")
        g.add_dependency("B", "A")
        errors = g.validate()
        assert errors == []

    def test_validate_cycle(self):
        g = DependencyGraph()
        g.add_node("A")
        g.add_node("B")
        g.add_dependency("A", "B")
        g.add_dependency("B", "A")
        errors = g.validate()
        assert any(isinstance(e, CircularDependencyError) for e in errors)

    def test_reverse_sort(self):
        g = DependencyGraph()
        g.add_node("A")
        g.add_node("B")
        g.add_dependency("B", "A")
        assert g.reverse_sort() == ["B", "A"]


class TestDependencyResolver:
    def test_resolve_simple(self):
        resolver = DependencyResolver()
        report = resolver.resolve_from_registry([
            ("A", "1.0.0", []),
            ("B", "2.0.0", [("A", ">=1.0", False)]),
        ])
        assert report.success
        assert report.start_order == ["A", "B"]

    def test_resolve_cycle(self):
        resolver = DependencyResolver()
        report = resolver.resolve_from_registry([
            ("A", "1.0.0", [("B", "*", False)]),
            ("B", "1.0.0", [("A", "*", False)]),
        ])
        assert not report.success
        assert any(isinstance(e, CircularDependencyError) for e in report.errors)

    def test_resolve_missing_dep(self):
        resolver = DependencyResolver()
        report = resolver.resolve_from_registry([
            ("A", "1.0.0", [("MISSING", "*", False)]),
        ])
        assert not report.success
        assert any(isinstance(e, MissingDependencyError) for e in report.errors)

    def test_resolve_optional_missing(self):
        resolver = DependencyResolver()
        report = resolver.resolve_from_registry([
            ("A", "1.0.0", [("MISSING", "*", True)]),
        ])
        # Optional missing — success, but warning
        assert report.success
        assert len(report.warnings) == 1

    def test_resolve_optional_missing_strict(self):
        resolver = DependencyResolver()
        report = resolver.resolve_from_registry([
            ("A", "1.0.0", [("MISSING", "*", True)]),
        ], strict=True)
        assert not report.success

    def test_version_mismatch(self):
        resolver = DependencyResolver()
        report = resolver.resolve_from_registry([
            ("A", "1.0.0", []),
            ("B", "2.0.0", [("A", ">=2.0", False)]),
        ])
        assert not report.success
        assert any(isinstance(e, VersionMismatchError) for e in report.errors)

    def test_version_match(self):
        resolver = DependencyResolver()
        report = resolver.resolve_from_registry([
            ("A", "2.0.0", []),
            ("B", "1.0.0", [("A", ">=2.0", False)]),
        ])
        assert report.success

    def test_complex_dag(self):
        resolver = DependencyResolver()
        report = resolver.resolve_from_registry([
            ("A", "1.0.0", []),
            ("B", "1.0.0", [("A", "*", False)]),
            ("C", "1.0.0", [("A", "*", False)]),
            ("D", "1.0.0", [("B", "*", False), ("C", "*", False)]),
        ])
        assert report.success
        order = report.start_order
        assert order.index("A") < order.index("B")
        assert order.index("A") < order.index("C")
        assert order.index("B") < order.index("D")
        assert order.index("C") < order.index("D")

    def test_transitive_resolution(self):
        resolver = DependencyResolver()
        report = resolver.resolve_from_registry([
            ("A", "1.0.0", []),
            ("B", "1.0.0", [("A", "*", False)]),
            ("C", "1.0.0", [("B", "*", False)]),
        ])
        assert report.success
        assert report.start_order == ["A", "B", "C"]

    def test_clear(self):
        resolver = DependencyResolver()
        resolver.add_plugin("A", "1.0.0", [])
        assert resolver.graph.size == 1
        resolver.clear()
        assert resolver.graph.size == 0

    def test_version_mismatch(self):
        resolver = DependencyResolver()
        report = resolver.resolve_from_registry([
            ("A", "1.0.0", []),
            ("B", "2.0.0", [("A", ">=2.0", False)]),
        ])
        assert not report.success
        assert any(isinstance(e, VersionMismatchError) for e in report.errors)

    def test_version_match(self):
        resolver = DependencyResolver()
        report = resolver.resolve_from_registry([
            ("A", "2.0.0", []),
            ("B", "1.0.0", [("A", ">=2.0", False)]),
        ])
        assert report.success

    def test_caret_version(self):
        resolver = DependencyResolver()
        report = resolver.resolve_from_registry([
            ("A", "2.5.0", []),
            ("B", "1.0.0", [("A", "^2.0.0", False)]),
        ])
        assert report.success

    def test_caret_version_mismatch(self):
        resolver = DependencyResolver()
        report = resolver.resolve_from_registry([
            ("A", "3.0.0", []),
            ("B", "1.0.0", [("A", "^2.0.0", False)]),
        ])
        assert not report.success

    def test_clear(self):
        resolver = DependencyResolver()
        resolver.add_plugin("A", "1.0.0", [])
        assert resolver.graph.size == 1
        resolver.clear()
        assert resolver.graph.size == 0

    def test_report_properties(self):
        report = ResolveReport()
        assert report.is_valid
        report.errors.append(MissingDependencyError("A", "B"))
        assert not report.is_valid
