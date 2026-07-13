"""
9.9 Replay Package — работа с .market-форматом.

Структура .market-пакета:
  manifest.json   — метаданные
  events.bin      — бинарные события (JSON lines)
  metadata.json   — дополнительная информация
  checksums       — контрольные суммы
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import time
from pathlib import Path
from typing import Any

from core.replay.models import (
    ReplayEvent,
    ReplayManifest,
    ReplayPackage,
)

logger = logging.getLogger(__name__)


class PackageWriter:
    """Запись .market-пакета на диск."""

    def __init__(self, output_dir: str) -> None:
        self._output_dir = Path(output_dir)
        self._output_dir.mkdir(parents=True, exist_ok=True)

    def write(self, package: ReplayPackage, name: str | None = None) -> str:
        """Записать пакет на диск.

        Args:
            package: Пакет для записи.
            name: Имя файла (без расширения). По умолчанию из манифеста.

        Returns:
            Путь к директории пакета.
        """
        pkg_name = name or package.manifest.name or f"replay_{int(time.time())}"
        pkg_dir = self._output_dir / f"{pkg_name}.market"
        pkg_dir.mkdir(parents=True, exist_ok=True)

        # Manifest
        manifest_path = pkg_dir / "manifest.json"
        with open(manifest_path, "w") as f:
            json.dump(package.manifest.to_dict(), f, indent=2, default=str)

        # Events (JSON lines — одно событие на строку)
        events_path = pkg_dir / "events.bin"
        checksum = hashlib.sha256()
        with open(events_path, "w") as f:
            for event in package.events:
                line = json.dumps(event.to_dict(), default=str)
                f.write(line + "\n")
                checksum.update(line.encode())

        # Checksum
        checksum_hex = checksum.hexdigest()
        checksum_path = pkg_dir / "checksum.sha256"
        with open(checksum_path, "w") as f:
            f.write(f"{checksum_hex}  events.bin\n")

        # Metadata
        if package.metadata:
            meta_path = pkg_dir / "metadata.json"
            with open(meta_path, "w") as f:
                json.dump(package.metadata, f, indent=2, default=str)

        # Обновить манифест с checksum
        package.manifest.checksum = checksum_hex
        with open(manifest_path, "w") as f:
            json.dump(package.manifest.to_dict(), f, indent=2, default=str)

        logger.info(
            "Package written: %s (%d events, %.1fKB)",
            pkg_dir, len(package.events), os.path.getsize(events_path) / 1024,
        )
        return str(pkg_dir)


class PackageReader:
    """Чтение .market-пакета с диска."""

    def __init__(self) -> None:
        self._last_manifest: ReplayManifest | None = None

    def read(self, path: str) -> ReplayPackage:
        """Прочитать .market-пакет с диска.

        Args:
            path: Путь к .market-директории.

        Returns:
            ReplayPackage.
        """
        pkg_dir = Path(path)
        if not pkg_dir.is_dir():
            raise FileNotFoundError(f"Package directory not found: {path}")

        # Manifest
        manifest_path = pkg_dir / "manifest.json"
        with open(manifest_path) as f:
            manifest_data = json.load(f)

        manifest = ReplayManifest(**manifest_data)
        self._last_manifest = manifest

        # Events
        events_path = pkg_dir / "events.bin"
        events: list[ReplayEvent] = []
        if events_path.exists():
            with open(events_path) as f:
                for line in f:
                    line = line.strip()
                    if line:
                        data = json.loads(line)
                        events.append(ReplayEvent(**data))

        # Metadata
        metadata: dict[str, Any] = {}
        meta_path = pkg_dir / "metadata.json"
        if meta_path.exists():
            with open(meta_path) as f:
                metadata = json.load(f)

        # Verify checksum
        if manifest.checksum:
            checksum = hashlib.sha256()
            with open(events_path) as f:
                for line in f:
                    checksum.update(line.encode())
            if checksum.hexdigest() != manifest.checksum:
                logger.warning(
                    "Package checksum mismatch: %s vs %s",
                    checksum.hexdigest()[:16], manifest.checksum[:16],
                )
            else:
                logger.debug("Package checksum verified")

        logger.info("Package read: %s (%d events)", path, len(events))
        return ReplayPackage(
            manifest=manifest,
            events=events,
            metadata=metadata,
            path=path,
        )
