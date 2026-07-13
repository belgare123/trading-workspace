"""
Tests for Marketplace Platform (Phase 15).
"""

import json
import os
import sys
import time

import pytest

from marketplace.models import (
    Package,
    PackageVersion,
    PackageIndex,
    TrustLevel,
    UpdateChannel,
    SignatureInfo,
    StrategyPassport,
    BenchmarkResult,
    CommunityStats,
    CompatibilityReport,
    InstallRecord,
)
from marketplace.registry import RegistryClient, PackageIndexBuilder
from marketplace.package_manager import PackageManager
from marketplace.dependency import MarketplaceDependencyResolver
from marketplace.trust import TrustSystem, SignatureVerifier
from marketplace.passport import PassportBuilder
from marketplace.benchmark import BenchmarkRepository
from marketplace.compatibility import CompatibilityChecker
from marketplace.channels import ChannelManager
from marketplace.store import create_marketplace_api


# ── Models ───────────────────────────────────────────────────────

class TestModels:
    def test_package_creation(self):
        pkg = Package(
            name="test-strat",
            display_name="Test Strategy",
            description="A test",
            package_type="strategy",
            author="Tester",
        )
        assert pkg.name == "test-strat"
        assert pkg.trust_level == TrustLevel.COMMUNITY

    def test_package_version(self):
        pv = PackageVersion(
            version="1.0.0",
            published_at=1000.0,
            download_url="https://example.com/pkg.tar.gz",
            sha256="abcd" * 16,
        )
        assert pv.version == "1.0.0"
        assert pv.channel == UpdateChannel.STABLE
        d = pv.to_dict()
        assert d['version'] == "1.0.0"

    def test_package_latest(self):
        pv1 = PackageVersion(version="1.0.0", published_at=100.0,
                              download_url="u", sha256="a"*64)
        pv2 = PackageVersion(version="2.0.0", published_at=200.0,
                              download_url="u", sha256="b"*64)
        pkg = Package(name="test", display_name="Test",
                      description="Test",
                      latest_version="2.0.0",
                      versions={"1.0.0": pv1, "2.0.0": pv2})
        assert pkg.latest is pv2

    def test_package_index_search(self):
        idx = PackageIndex()
        idx.packages["a"] = Package(name="momentum-pro", display_name="Momentum",
                                     description="Trend following", package_type="strategy",
                                     install_count=100, trust_level=TrustLevel.OFFICIAL,
                                     tags=["momentum"])
        idx.packages["b"] = Package(name="ict-concepts", display_name="ICT",
                                     description="Smart money", package_type="strategy",
                                     install_count=50, trust_level=TrustLevel.VERIFIED,
                                     tags=["ict"])
        idx.packages["c"] = Package(name="news-sentiment", display_name="News",
                                     description="NLP analysis", package_type="indicator",
                                     install_count=10, trust_level=TrustLevel.EXPERIMENTAL,
                                     tags=["nlp"])
        results = idx.search("momentum")
        assert len(results) == 1
        assert results[0].name == "momentum-pro"

    def test_trust_level_sort_key(self):
        assert TrustLevel.OFFICIAL.sort_key() < TrustLevel.COMMUNITY.sort_key()
        assert TrustLevel.COMMUNITY.sort_key() < TrustLevel.UNSAFE.sort_key()

    def test_signature_info(self):
        sig = SignatureInfo(author_id="test", signature_hex="a"*64)
        assert sig.algorithm == "ed25519"
        assert not sig.verify(b"some data")  # Won't match random

    def test_community_stats_stars_display(self):
        cs = CommunityStats(rating=4.2)
        assert "★" in cs.stars_display()
        assert len(cs.stars_display()) == 5

    def test_compatibility_report(self):
        report = CompatibilityReport(package_name="test", version="1.0.0")
        assert report.can_install
        report.errors.append("Missing exchange")
        report.can_install = False
        d = report.to_dict()
        assert d['errors'] == ["Missing exchange"]

    def test_install_record(self):
        rec = InstallRecord(package_name="test", version="1.0.0", installed_at=1000.0)
        d = rec.to_dict()
        assert d['package_name'] == "test"
        assert d['enabled']

    def test_benchmark_result(self):
        br = BenchmarkResult(strategy_name="test", version="1.0.0")
        br.winrate = 61.5
        br.profit_factor = 1.73
        d = br.to_dict()
        assert d['winrate'] == 61.5
        assert d['profit_factor'] == 1.73

    def test_strategy_passport(self):
        sp = StrategyPassport(name="test", display_name="Test",
                               version="1.0.0", author="Tester",
                               strategy_type="momentum",
                               timeframes=["1h", "4h"])
        d = sp.to_dict()
        assert d['strategy_type'] == "momentum"
        assert d['timeframes'] == ["1h", "4h"]

    def test_update_channel_enum(self):
        assert UpdateChannel.STABLE.value == "stable"
        assert UpdateChannel.BETA.value == "beta"
        assert UpdateChannel.NIGHTLY.value == "nightly"
        assert UpdateChannel.DEVELOPER.value == "developer"


# ── Registry ──────────────────────────────────────────────────────

class TestRegistry:
    def test_registry_client_fetch(self):
        client = RegistryClient(cache_dir=os.devnull)
        idx = client.fetch_index()
        assert idx.total_packages >= 5
        assert "momentum-pro" in idx.packages

    def test_registry_client_search(self):
        client = RegistryClient(cache_dir=os.devnull)
        results = client.search_remote("momentum")
        assert len(results) >= 1
        assert any(r.name == "momentum-pro" for r in results)

    def test_registry_client_get_package(self):
        client = RegistryClient(cache_dir=os.devnull)
        pkg = client.get_package("momentum-pro")
        assert pkg is not None
        assert pkg.display_name == "Momentum Pro"

    def test_registry_client_get_trending(self):
        client = RegistryClient(cache_dir=os.devnull)
        trending = client.get_trending(3)
        assert len(trending) <= 3

    def test_registry_client_get_by_category(self):
        client = RegistryClient(cache_dir=os.devnull)
        pkgs = client.get_by_category("signals")
        assert len(pkgs) >= 1

    def test_registry_client_get_by_type(self):
        client = RegistryClient(cache_dir=os.devnull)
        features = client.get_by_type("feature")
        assert len(features) >= 1

    def test_package_index_builder_no_dir(self):
        builder = PackageIndexBuilder()
        idx = builder.build_local_index()
        assert idx.total_packages == 0


# ── Trust System ─────────────────────────────────────────────────

class TestTrust:
    def test_evaluate_verified(self):
        ts = TrustSystem()
        result = ts.evaluate_trust(
            install_count=600,
            rating=4.5,
            age_days=60,
            has_signature=True,
        )
        assert result == TrustLevel.VERIFIED

    def test_evaluate_community(self):
        ts = TrustSystem()
        result = ts.evaluate_trust(
            install_count=100,
            rating=3.5,
            age_days=10,
        )
        assert result == TrustLevel.COMMUNITY

    def test_evaluate_experimental(self):
        ts = TrustSystem()
        result = ts.evaluate_trust(
            install_count=10,
            rating=3.0,
            age_days=5,
        )
        assert result == TrustLevel.EXPERIMENTAL

    def test_evaluate_unsafe(self):
        ts = TrustSystem()
        result = ts.evaluate_trust(
            install_count=1000,
            rating=4.0,
            age_days=100,
            reported_unsafe=True,
        )
        assert result == TrustLevel.UNSAFE

    def test_evaluate_official(self):
        ts = TrustSystem()
        result = ts.evaluate_trust(
            install_count=0,
            rating=0,
            age_days=0,
            is_official=True,
        )
        assert result == TrustLevel.OFFICIAL

    def test_trust_display(self):
        ts = TrustSystem()
        display = ts.get_trust_display(TrustLevel.OFFICIAL)
        assert display['label'] == 'Official'
        assert 'color' in display

    def test_signature_verify(self):
        data = b"test package content"
        sig = SignatureVerifier.create_signature(data, "test-key")
        assert sig.algorithm == "sha256"
        assert SignatureVerifier.verify_package(data, sig)

    def test_fingerprint(self):
        fp = SignatureVerifier.fingerprint("test-certificate-data")
        assert len(fp) == 16


# ── Package Manager ───────────────────────────────────────────────

class TestPackageManager:
    def test_install_success(self, tmp_path):
        pm = PackageManager(plugins_dir=str(tmp_path))
        result = pm.install("momentum-pro")
        assert result['success']
        assert result['package'] == "momentum-pro"

    def test_install_not_found(self, tmp_path):
        pm = PackageManager(plugins_dir=str(tmp_path))
        result = pm.install("nonexistent-package")
        assert not result['success']
        assert 'not found' in result.get('error', '')

    def test_remove(self, tmp_path):
        pm = PackageManager(plugins_dir=str(tmp_path))
        pm.install("momentum-pro")
        result = pm.remove("momentum-pro")
        assert result['success']

    def test_remove_not_installed(self, tmp_path):
        pm = PackageManager(plugins_dir=str(tmp_path))
        result = pm.remove("not-installed")
        assert not result['success']

    def test_list_installed(self, tmp_path):
        pm = PackageManager(plugins_dir=str(tmp_path))
        assert pm.list_installed() == []
        pm.install("momentum-pro")
        installed = pm.list_installed()
        assert len(installed) == 1
        assert installed[0]['name'] == "momentum-pro"

    def test_search(self, tmp_path):
        pm = PackageManager(plugins_dir=str(tmp_path))
        results = pm.search("momentum")
        assert len(results) >= 1
        assert results[0]['name'] == "momentum-pro"

    def test_info(self, tmp_path):
        pm = PackageManager(plugins_dir=str(tmp_path))
        info = pm.info("momentum-pro")
        assert info is not None
        assert info['display_name'] == "Momentum Pro"

    def test_info_not_found(self, tmp_path):
        pm = PackageManager(plugins_dir=str(tmp_path))
        assert pm.info("nonexistent") is None

    def test_update(self, tmp_path):
        pm = PackageManager(plugins_dir=str(tmp_path))
        pm.install("momentum-pro")
        result = pm.update("momentum-pro")
        assert result['success']

    def test_update_not_installed(self, tmp_path):
        pm = PackageManager(plugins_dir=str(tmp_path))
        result = pm.update("not-installed")
        assert not result['success']

    def test_compare_versions(self):
        assert PackageManager._compare_versions("1.0.0", "2.0.0") == -1
        assert PackageManager._compare_versions("2.0.0", "1.0.0") == 1
        assert PackageManager._compare_versions("1.0.0", "1.0.0") == 0
        assert PackageManager._compare_versions("1.5.0", "1.5.0") == 0


# ── Dependency Resolver ──────────────────────────────────────────

class TestDependencyResolver:
    def test_resolve_simple(self):
        resolver = MarketplaceDependencyResolver()
        result = resolver.resolve("momentum-pro")
        assert result['success']
        assert result['package'] == "momentum-pro"

    def test_resolve_not_found(self):
        resolver = MarketplaceDependencyResolver()
        result = resolver.resolve("unknown-pkg")
        assert result['success']  # Still succeeds, no deps found

    def test_check_constraints(self):
        resolver = MarketplaceDependencyResolver(
            installed_packages={"some-dep": "1.0.0"}
        )
        conflicts = resolver.check_constraints(
            "test", "1.0.0",
            {"some-dep": ">=1.0.0"}
        )
        assert len(conflicts) == 0

    def test_satisfies(self):
        resolver = MarketplaceDependencyResolver()
        assert resolver._satisfies("1.5.0", ">=1.0.0")
        assert resolver._satisfies("2.0.0", ">=1.0.0")
        assert not resolver._satisfies("0.9.0", ">=1.0.0")


# ── Passport Builder ──────────────────────────────────────────────

class TestPassport:
    def test_from_directory_no_manifest(self, tmp_path):
        pb = PassportBuilder()
        assert pb.from_directory(str(tmp_path)) is None

    def test_passport_enrich(self):
        pb = PassportBuilder()
        sp = StrategyPassport(name="test", display_name="Test",
                               version="1.0.0", author="Tester")
        bm = BenchmarkResult(strategy_name="test", version="1.0.0",
                             winrate=61.5, profit_factor=1.73,
                             max_drawdown=9.0, sharpe_ratio=1.5,
                             total_trades=100, period="2024")
        enriched = pb.enrich_with_benchmarks(sp, [bm])
        assert enriched.benchmark_winrate == 61.5
        assert enriched.benchmark_profit_factor == 1.73

    def test_passport_to_json(self):
        pb = PassportBuilder()
        sp = StrategyPassport(name="test", display_name="Test",
                               version="1.0.0", author="Tester")
        j = pb.to_json(sp)
        assert '"name": "test"' in j


# ── Benchmark Repository ─────────────────────────────────────────

class TestBenchmark:
    def test_add_and_get(self, tmp_path):
        br = BenchmarkRepository(data_dir=str(tmp_path / "benchmarks"))
        bm = BenchmarkResult(strategy_name="momentum-pro", version="2.0.0",
                             symbol="BTCUSDT", timeframe="1h",
                             period="2024-Q1", winrate=61.5,
                             profit_factor=1.73, max_drawdown=9.0,
                             total_trades=200)
        br.add(bm)
        results = br.get_for_strategy("momentum-pro")
        assert len(results) == 1
        assert results[0].winrate == 61.5

    def test_get_for_strategy_filter_version(self, tmp_path):
        br = BenchmarkRepository(data_dir=str(tmp_path / "benchmarks"))
        br.add(BenchmarkResult(strategy_name="test", version="1.0.0"))
        br.add(BenchmarkResult(strategy_name="test", version="2.0.0"))
        results = br.get_for_strategy("test", "2.0.0")
        assert len(results) == 1
        assert results[0].version == "2.0.0"

    def test_compare(self, tmp_path):
        br = BenchmarkRepository(data_dir=str(tmp_path / "benchmarks"))
        br.add(BenchmarkResult(strategy_name="a", version="1.0.0",
                               winrate=60.0, profit_factor=1.5,
                               max_drawdown=10.0, sharpe_ratio=1.2))
        br.add(BenchmarkResult(strategy_name="b", version="1.0.0",
                               winrate=55.0, profit_factor=1.3,
                               max_drawdown=15.0, sharpe_ratio=1.0))
        comp = br.compare("a", "b")
        assert 'comparison' in comp
        assert comp['comparison']['winrate']['a'] == 60.0

    def test_list_all(self, tmp_path):
        br = BenchmarkRepository(data_dir=str(tmp_path / "benchmarks"))
        br.add(BenchmarkResult(strategy_name="test", version="1.0.0"))
        assert len(br.list_all()) == 1

    def test_summary(self, tmp_path):
        br = BenchmarkRepository(data_dir=str(tmp_path / "benchmarks"))
        br.add(BenchmarkResult(strategy_name="test", version="1.0.0",
                               winrate=60.0, profit_factor=1.5,
                               max_drawdown=10.0, sharpe_ratio=1.2))
        s = br.summary("test")
        assert s is not None
        assert s['avg_winrate'] == 60.0


# ── Compatibility Center ─────────────────────────────────────────

class TestCompatibility:
    def test_check_compatible(self):
        pv = PackageVersion(version="1.0.0", published_at=0,
                             download_url="u", sha256="a"*64,
                             min_core_version="0.13.0")
        checker = CompatibilityChecker(core_version="0.14.0")
        report = checker.check_version("test", pv)
        assert report.can_install
        assert report.core_compatible

    def test_check_incompatible_core(self):
        pv = PackageVersion(version="1.0.0", published_at=0,
                             download_url="u", sha256="a"*64,
                             min_core_version="0.15.0")
        checker = CompatibilityChecker(core_version="0.14.0")
        report = checker.check_version("test", pv)
        assert not report.core_compatible

    def test_check_missing_exchange(self):
        pv = PackageVersion(version="1.0.0", published_at=0,
                             download_url="u", sha256="a"*64,
                             compatible_exchanges=["hyperliquid"])
        checker = CompatibilityChecker()
        report = checker.check_version("test", pv)
        assert "hyperliquid" in report.exchanges_missing

    def test_check_package(self):
        pkg = Package(name="test", display_name="Test",
                      description="Test", latest_version="1.0.0",
                      versions={"1.0.0": PackageVersion(
                          version="1.0.0", published_at=0,
                          download_url="u", sha256="a"*64,
                      )})
        checker = CompatibilityChecker()
        report = checker.check_package(pkg)
        assert report.can_install


# ── Channel Manager ──────────────────────────────────────────────

class TestChannels:
    def test_get_channel_versions(self):
        pkg = Package(name="test", display_name="Test",
                      description="Test",
                      versions={
                          "1.0.0": PackageVersion(version="1.0.0",
                              published_at=0, download_url="u",
                              sha256="a"*64, channel=UpdateChannel.STABLE),
                          "1.1.0-beta": PackageVersion(version="1.1.0-beta",
                              published_at=1, download_url="u",
                              sha256="b"*64, channel=UpdateChannel.BETA),
                      })
        cm = ChannelManager()
        channels = cm.get_channel_versions(pkg)
        assert "stable" in channels
        assert "beta" in channels
        assert "1.0.0" in channels["stable"]
        assert "1.1.0-beta" in channels["beta"]

    def test_get_latest_for_channel(self):
        pkg = Package(name="test", display_name="Test",
                      description="Test",
                      versions={
                          "1.0.0": PackageVersion(version="1.0.0",
                              published_at=0, download_url="u",
                              sha256="a"*64, channel=UpdateChannel.STABLE),
                          "2.0.0": PackageVersion(version="2.0.0",
                              published_at=2, download_url="u",
                              sha256="b"*64, channel=UpdateChannel.STABLE),
                      })
        cm = ChannelManager()
        latest = cm.get_latest_for_channel(pkg, "stable")
        assert latest is not None
        assert latest.version == "2.0.0"

    def test_all_channels(self):
        cm = ChannelManager()
        channels = cm.all_channels()
        assert len(channels) == 4


# ── Store API ────────────────────────────────────────────────────

class TestStoreAPI:
    def test_get_trending(self):
        api = create_marketplace_api()
        trending = api['get_trending'](limit=3)
        assert len(trending) <= 3
        if trending:
            assert 'name' in trending[0]

    def test_get_all_categories(self):
        api = create_marketplace_api()
        categories = api['get_all_categories']()
        assert len(categories) >= 1
        assert 'name' in categories[0]

    def test_get_package_detail(self):
        api = create_marketplace_api()
        detail = api['get_package_detail']('momentum-pro')
        assert isinstance(detail, dict)
        assert detail['name'] == 'momentum-pro'

    def test_get_package_detail_not_found(self):
        api = create_marketplace_api()
        detail = api['get_package_detail']('nonexistent')
        assert 'error' in detail

    def test_list_installed(self, tmp_path, monkeypatch):
        api = create_marketplace_api()
        # PackageManager uses default plugin dir, so override
        result = api['install_package']('momentum-pro')
        assert result['success']
