#!/usr/bin/env python
"""Marketplace Package Demo — создание и управление пакетом стратегии.

Демонстрирует:
  - Работу с PackageManager (local registry)
  - Модель Package

Run:
    python examples/marketplace_demo/run.py
"""
import os
import sys
import tempfile
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from marketplace import PackageManager
from marketplace.models import (
    Package,
    PackageVersion,
    TrustLevel,
    UpdateChannel,
)


def main():
    print("=" * 55)
    print("  Marketplace Package Demo")
    print("=" * 55)

    # 1. Create a package object
    print("\n1. Creating Package model...")

    version = PackageVersion(
        version="1.0.0",
        published_at=time.time(),
        download_url="https://marketplace.example.com/packages/demo-sma-crossover-1.0.0.tar.gz",
        sha256="abc123def456" * 4,
        size_bytes=1024,
        channel=UpdateChannel.STABLE,
        requires_capabilities=["candle", "sma"],
        min_core_version="0.15.0",
        dependencies={"screener-sdk": ">=0.15.0"},
    )
    print(f"   ✓ Version created: {version.version}")

    pkg = Package(
        name="demo-sma-crossover",
        display_name="SMA Crossover Demo",
        description="Simple SMA crossover strategy — demo package",
        author="demo",
        package_type="strategy",
        tags=["sma", "crossover", "demo"],
        trust_level=TrustLevel.COMMUNITY,
        versions={"1.0.0": version},
        latest_version="1.0.0",
    )
    print(f"   ✓ Created: {pkg.name} (latest: v{pkg.latest_version})")
    print(f"   ✓ Trust: {pkg.trust_level.value}")
    print(f"   ✓ Requires capabilities: {version.requires_capabilities}")

    # 2. Simulate install via PackageManager
    print("\n2. Simulating package manager operations...")
    pkg_dir = Path(tempfile.mkdtemp(prefix="demo_plugins_"))

    mgr = PackageManager(plugins_dir=str(pkg_dir))
    print(f"   ✓ PackageManager initialized")
    print(f"   ✓ Plugins dir: {pkg_dir}")

    # List packages
    installed = mgr.list_installed()
    print(f"   ✓ Installed packages: {len(installed)}")

    # 4. Package info display
    print("\n3. Package info:")
    print(f"   • Name:         {pkg.name}")
    print(f"   • Display:      {pkg.display_name}")
    print(f"   • Description:  {pkg.description}")
    print(f"   • Author:       {pkg.author}")
    print(f"   • Version:      {pkg.latest_version}")
    print(f"   • Requires:     {version.requires_capabilities}")
    print(f"   • Trust level:  {pkg.trust_level.value}")
    print(f"   • Channel:      {version.channel.value}")

    # Cleanup
    import shutil
    shutil.rmtree(pkg_dir)
    print(f"\n✅ Marketplace demo complete")


if __name__ == "__main__":
    main()
