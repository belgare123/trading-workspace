"""Tests for Plugin Repository (Phase 6.10)."""

import os
import tempfile
import yaml

import pytest

from core.strategy.repository import (
    PluginRepository,
    RepositoryPlugin,
    RepositorySource,
    SourceType,
)


class TestSourceType:
    """SourceType enum."""

    def test_values(self):
        assert SourceType.LOCAL.value == "local"
        assert SourceType.GIT.value == "git"
        assert SourceType.GITHUB.value == "github"
        assert SourceType.ZIP.value == "zip"


class TestRepositorySource:
    """RepositorySource dataclass."""

    def test_local_factory(self):
        src = RepositorySource.local("mylocal", "/tmp/plugins")
        assert src.name == "mylocal"
        assert src.source_type == SourceType.LOCAL
        assert src.url == "/tmp/plugins"

    def test_remote_factory(self):
        src = RepositorySource.remote(
            "remote", "https://github.com/user/plugins.git",
        )
        assert src.name == "remote"
        assert src.source_type == SourceType.GIT

    def test_to_dict(self):
        src = RepositorySource.local("test", "/tmp", priority=5)
        d = src.to_dict()
        assert d["name"] == "test"
        assert d["source_type"] == "local"
        assert d["priority"] == 5
        assert d["enabled"] is True

    def test_hashable(self):
        src1 = RepositorySource.local("a", "/tmp")
        src2 = RepositorySource.local("a", "/tmp")
        assert hash(src1) == hash(src2)
        assert {src1, src2} == {src1}  # dedup by name


class TestRepositoryPlugin:
    """RepositoryPlugin dataclass."""

    def test_to_dict(self):
        src = RepositorySource.local("src", "/tmp")
        plugin = RepositoryPlugin(
            name="test", version="1.0.0", source=src,
            description="A test plugin",
        )
        d = plugin.to_dict()
        assert d["name"] == "test"
        assert d["version"] == "1.0.0"
        assert d["source"] == "src"
        assert d["description"] == "A test plugin"


class TestPluginRepositorySources:
    """Source management."""

    def test_add_source(self):
        repo = PluginRepository()
        src = RepositorySource.local("test", "/tmp")
        repo.add_source(src)
        assert repo.get_source("test") is src

    def test_get_source_missing(self):
        repo = PluginRepository()
        assert repo.get_source("missing") is None

    def test_remove_source(self):
        repo = PluginRepository()
        repo.add_source(RepositorySource.local("test", "/tmp"))
        repo.remove_source("test")
        assert repo.get_source("test") is None

    def test_list_sources_ordered_by_priority(self):
        repo = PluginRepository()
        repo.add_source(RepositorySource.local("low", "/tmp", priority=0))
        repo.add_source(RepositorySource.local("high", "/tmp", priority=10))
        sources = repo.list_sources()
        assert sources[0].name == "high"
        assert sources[1].name == "low"

    def test_list_enabled_sources(self):
        repo = PluginRepository()
        src1 = RepositorySource.local("active", "/a", priority=0)
        src2 = RepositorySource.local("disabled", "/b", priority=0)
        src2.enabled = False
        repo.add_source(src1)
        repo.add_source(src2)
        enabled = repo.list_enabled_sources()
        assert len(enabled) == 1
        assert enabled[0].name == "active"

    def test_save_load_sources(self):
        repo = PluginRepository()
        repo.add_source(RepositorySource.local("test", "/tmp"))

        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            path = f.name
            repo.save_sources(f.name)

        repo2 = PluginRepository()
        repo2.load_sources(path)
        assert repo2.get_source("test") is not None
        assert repo2.get_source("test").url == "/tmp"

        os.unlink(path)


class TestPluginRepositoryDiscovery:
    """Local source discovery."""

    def test_scan_local_empty_directory(self):
        with tempfile.TemporaryDirectory() as tmp:
            repo = PluginRepository()
            repo.add_source(RepositorySource.local("src", tmp))
            plugins = repo.list_available()
            assert len(plugins) == 0

    def test_scan_local_finds_plugins(self):
        with tempfile.TemporaryDirectory() as tmp:
            # Create a plugin directory with manifest.yaml
            plugin_dir = os.path.join(tmp, "Momentum")
            os.makedirs(plugin_dir)
            manifest = {
                "id": "momentum",
                "name": "Momentum",
                "version": "1.0.0",
                "description": "Momentum strategy",
            }
            with open(os.path.join(plugin_dir, "manifest.yaml"), "w") as f:
                yaml.dump(manifest, f)

            repo = PluginRepository()
            repo.add_source(RepositorySource.local("src", tmp))
            plugins = repo.list_available()
            assert len(plugins) == 1
            assert plugins[0].name == "momentum"
            assert plugins[0].version == "1.0.0"

    def test_scan_skips_dirs_without_manifest(self):
        with tempfile.TemporaryDirectory() as tmp:
            os.makedirs(os.path.join(tmp, "empty_dir"))
            os.makedirs(os.path.join(tmp, "no_manifest"))
            with open(os.path.join(tmp, "no_manifest", "strategy.py"), "w") as f:
                f.write("# no manifest")

            repo = PluginRepository()
            repo.add_source(RepositorySource.local("src", tmp))
            plugins = repo.list_available()
            assert len(plugins) == 0

    def test_search_by_name(self):
        with tempfile.TemporaryDirectory() as tmp:
            # Create two plugins
            for name in ("Alpha", "Beta"):
                d = os.path.join(tmp, name)
                os.makedirs(d)
                with open(os.path.join(d, "manifest.yaml"), "w") as f:
                    yaml.dump({"id": name.lower(), "name": name, "version": "1.0.0"}, f)

            repo = PluginRepository()
            repo.add_source(RepositorySource.local("src", tmp))
            results = repo.search("alpha")
            assert len(results) == 1
            assert results[0].name == "alpha"

    def test_search_cached(self):
        with tempfile.TemporaryDirectory() as tmp:
            repo = PluginRepository()
            repo.add_source(RepositorySource.local("src", tmp))
            # First call — empty
            assert len(repo.list_available()) == 0
            # Add a plugin after first scan (should still be cached)
            d = os.path.join(tmp, "Momentum")
            os.makedirs(d)
            with open(os.path.join(d, "manifest.yaml"), "w") as f:
                yaml.dump({"id": "momentum", "version": "1.0.0"}, f)
            # Without refresh — cache hit, still empty
            assert len(repo.list_available()) == 0
            # With refresh — finds new plugin
            assert len(repo.list_available(refresh=True)) == 1

    def test_clear_cache(self):
        repo = PluginRepository()
        src = RepositorySource.local("src", "/tmp")
        repo.add_source(src)
        repo._plugin_cache["src"] = [RepositoryPlugin("test", "1.0.0", src)]
        repo.clear_cache()
        assert "src" not in repo._plugin_cache


class TestPluginRepositoryGetPlugin:
    """get_plugin method."""

    def test_get_plugin_nonexistent(self):
        repo = PluginRepository()
        assert repo.get_plugin("missing") is None

    def test_get_plugin_by_name(self):
        with tempfile.TemporaryDirectory() as tmp:
            d = os.path.join(tmp, "Momentum")
            os.makedirs(d)
            with open(os.path.join(d, "manifest.yaml"), "w") as f:
                yaml.dump({"id": "momentum", "version": "1.0.0"}, f)

            repo = PluginRepository()
            repo.add_source(RepositorySource.local("src", tmp))
            plugin = repo.get_plugin("momentum")
            assert plugin is not None
            assert plugin.version == "1.0.0"

    def test_get_plugin_by_name_and_version(self):
        with tempfile.TemporaryDirectory() as tmp:
            d = os.path.join(tmp, "Momentum")
            os.makedirs(d)
            with open(os.path.join(d, "manifest.yaml"), "w") as f:
                yaml.dump({"id": "momentum", "version": "1.0.0"}, f)

            repo = PluginRepository()
            repo.add_source(RepositorySource.local("src", tmp))
            plugin = repo.get_plugin("momentum", "1.0.0")
            assert plugin is not None
            assert plugin.version == "1.0.0"

            plugin = repo.get_plugin("momentum", "2.0.0")
            assert plugin is None


class TestPluginRepositoryInstall:
    """Install method."""

    @pytest.mark.asyncio
    async def test_install_missing_plugin(self):
        repo = PluginRepository()
        with pytest.raises(FileNotFoundError):
            await repo.install("nonexistent")

    @pytest.mark.asyncio
    async def test_install_local_plugin(self):
        with tempfile.TemporaryDirectory() as tmp:
            # Create source plugin
            src_dir = os.path.join(tmp, "src", "Momentum")
            os.makedirs(src_dir)
            with open(os.path.join(src_dir, "manifest.yaml"), "w") as f:
                yaml.dump({"id": "momentum", "version": "1.0.0"}, f)

            repo = PluginRepository()
            repo.add_source(RepositorySource.local("src", os.path.join(tmp, "src")))

            dest = os.path.join(tmp, "installed")
            path = await repo.install("momentum", dest=dest)
            assert os.path.isdir(path)
            assert os.path.exists(os.path.join(path, "manifest.yaml"))

    @pytest.mark.asyncio
    async def test_install_already_installed(self):
        with tempfile.TemporaryDirectory() as tmp:
            src_dir = os.path.join(tmp, "src", "Momentum")
            os.makedirs(src_dir)
            with open(os.path.join(src_dir, "manifest.yaml"), "w") as f:
                yaml.dump({"id": "momentum", "version": "1.0.0"}, f)

            repo = PluginRepository()
            repo.add_source(RepositorySource.local("src", os.path.join(tmp, "src")))

            dest = os.path.join(tmp, "installed", "momentum", "1.0.0")
            os.makedirs(dest)  # already exists
            path = await repo.install("momentum", dest=dest)
            assert path == dest  # returns existing path

    def test_summary(self):
        repo = PluginRepository()
        src = RepositorySource.local("src", "/tmp")
        repo.add_source(src)
        s = repo.summary()
        assert "PluginRepository" in s
        assert "src" in s


class TestPluginRepositoryListVersions:
    """list_versions method."""

    def test_list_versions_empty(self):
        repo = PluginRepository()
        assert repo.list_versions("nonexistent") == []

    def test_list_versions_multiple_sources(self):
        with tempfile.TemporaryDirectory() as tmp:
            # Same plugin in two sources
            for src_name in ("src1", "src2"):
                d = os.path.join(tmp, src_name, "Momentum")
                os.makedirs(d)
                with open(os.path.join(d, "manifest.yaml"), "w") as f:
                    yaml.dump({"id": "momentum", "version": "1.0.0"}, f)

            repo = PluginRepository()
            repo.add_source(RepositorySource.local("src1", os.path.join(tmp, "src1")))
            repo.add_source(RepositorySource.local("src2", os.path.join(tmp, "src2")))

            # Force cache refresh
            versions = repo.list_versions("momentum")
            assert len(versions) >= 1
            # Versions are sorted descending
            # Both sources have same plugin, version 1.0.0
