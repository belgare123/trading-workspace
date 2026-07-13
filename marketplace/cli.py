"""
Marketplace Platform — CLI (tw command).

Usage:
    tw install <name> [version]
    tw update <name>
    tw remove <name>
    tw list
    tw search <query>
    tw info <name>
    tw resolve <name>
    tw compare <name-a> <name-b>
    tw channels
"""

from __future__ import annotations

import argparse
import json
import sys
from typing import Any

from marketplace.package_manager import PackageManager
from marketplace.registry import RegistryClient
from marketplace.dependency import MarketplaceDependencyResolver
from marketplace.benchmark import BenchmarkRepository
from marketplace.compatibility import CompatibilityChecker
from marketplace.channels import ChannelManager
from marketplace.trust import TrustSystem


def main(argv: list[str] | None = None) -> int:
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        prog='tw',
        description='Trading Workspace Marketplace — Package Manager',
    )
    sub = parser.add_subparsers(dest='command', required=True)

    # install
    p_install = sub.add_parser('install', help='Install a package')
    p_install.add_argument('name', help='Package name')
    p_install.add_argument('version', nargs='?', default=None, help='Version (default: latest)')

    # update
    p_update = sub.add_parser('update', help='Update a package')
    p_update.add_argument('name', help='Package name')
    p_update.add_argument('--channel', '-c', default=None, help='Update channel')

    # remove
    p_remove = sub.add_parser('remove', help='Remove a package')
    p_remove.add_argument('name', help='Package name')

    # list
    sub.add_parser('list', help='List installed packages')

    # search
    p_search = sub.add_parser('search', help='Search marketplace')
    p_search.add_argument('query', help='Search query')

    # info
    p_info = sub.add_parser('info', help='Package info')
    p_info.add_argument('name', help='Package name')

    # resolve (dependency check)
    p_resolve = sub.add_parser('resolve', help='Resolve dependencies')
    p_resolve.add_argument('name', help='Package name')
    p_resolve.add_argument('version', nargs='?', default=None)

    # compare
    p_compare = sub.add_parser('compare', help='Compare two strategies')
    p_compare.add_argument('name_a', help='First strategy name')
    p_compare.add_argument('name_b', help='Second strategy name')

    # channels
    sub.add_parser('channels', help='List update channels')

    # check (compatibility)
    p_check = sub.add_parser('check', help='Check compatibility')
    p_check.add_argument('name', help='Package name')

    args = parser.parse_args(argv)
    return _handle(args)


def _handle(args: argparse.Namespace) -> int:
    """Route command to handler."""
    pm = PackageManager()
    registry = RegistryClient()
    resolver = MarketplaceDependencyResolver(registry)
    benchmark = BenchmarkRepository()

    try:
        if args.command == 'install':
            result = pm.install(args.name, args.version)
            _print(result)
            return 0 if result.get('success') else 1

        elif args.command == 'update':
            result = pm.update(args.name, args.channel)
            _print(result)
            return 0 if result.get('success') else 1

        elif args.command == 'remove':
            result = pm.remove(args.name)
            _print(result)
            return 0

        elif args.command == 'list':
            pkgs = pm.list_installed()
            if not pkgs:
                print("No packages installed.")
                return 0
            print(f"{'Package':<25} {'Version':<12} {'Channel':<10} {'Installed':<10}")
            print('-' * 60)
            for p in pkgs:
                print(f"{p['name']:<25} {p['version']:<12} {p['channel']:<10} {p['installed_at']:<10.0f}")
            return 0

        elif args.command == 'search':
            results = pm.search(args.query)
            if not results:
                print(f"No results for '{args.query}'")
                return 0
            print(f"{'Name':<25} {'Type':<12} {'Trust':<12} {'Rating':<8} {'Installs':<10}")
            print('-' * 70)
            for r in results:
                rating = f"{r.get('rating', 0):.1f}★" if r.get('rating') else '-'
                print(f"{r['name']:<25} {r['package_type']:<12} {r['trust_level']:<12} {rating:<8} {r.get('install_count', 0):<10}")
            return 0

        elif args.command == 'info':
            info = pm.info(args.name)
            if not info:
                print(f"Package '{args.name}' not found.")
                return 1
            print(json.dumps(info, indent=2, ensure_ascii=False))
            return 0

        elif args.command == 'resolve':
            result = resolver.resolve(args.name, args.version)
            print(json.dumps(result, indent=2, ensure_ascii=False))
            return 0 if result.get('success') else 1

        elif args.command == 'compare':
            result = benchmark.compare(args.name_a, args.name_b)
            print(json.dumps(result, indent=2, ensure_ascii=False))
            return 0

        elif args.command == 'channels':
            cm = ChannelManager()
            channels = cm.all_channels()
            print(f"{'Channel':<12} {'Priority':<10} {'Description'}")
            print('-' * 50)
            for ch in channels:
                print(f"{ch['name']:<12} {ch['priority']:<10} {ch['description']}")
            return 0

        elif args.command == 'check':
            checker = CompatibilityChecker()
            pkg = registry.get_package(args.name)
            if not pkg:
                print(f"Package '{args.name}' not found.")
                return 1
            report = checker.check_package(pkg)
            print(json.dumps(report.to_dict(), indent=2, ensure_ascii=False))
            return 0 if report.can_install else 1

        return 0

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1


def _print(data: dict) -> None:
    """Pretty-print a result dict."""
    success = data.get('success', False)
    if success:
        print(f"✓ {data.get('message', 'OK')}")
        for k, v in data.items():
            if k not in ('success',):
                print(f"  {k}: {v}")
    else:
        print(f"✗ {data.get('error', 'Unknown error')}")


if __name__ == '__main__':
    sys.exit(main())
