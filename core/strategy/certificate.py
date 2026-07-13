"""
Plugin Certificate — криптографическая подпись стратегии.

Обеспечивает:
  - SHA256 хеш всех файлов стратегии
  - Хеш manifest.yaml (отдельно)
  - Фиксацию API версии
  - Проверку целостности (не было ли изменений после установки)

Marketplace использует Certificate для:
  - Гарантии, что стратегия не изменена после публикации
  - Сравнения установленной версии с опубликованной
  - Обнаружения битых или подменённых файлов
"""

from __future__ import annotations

import hashlib
import json
import os
from dataclasses import dataclass, field
from typing import Any


@dataclass
class PluginCertificate:
    """Криптографический сертификат стратегии.

    Содержит SHA256 хеши всех файлов стратегии + manifest hash + api version.
    Позволяет Marketplace и Plugin Manager проверять целостность.

    Attributes:
        name:          Имя стратегии.
        version:       Версия стратегии.
        api_version:   Версия API платформы.
        manifest_hash: SHA256 от manifest.yaml.
        file_hashes:   {относительный_путь → SHA256} для всех файлов.
        total_files:   Количество файлов.
        total_size:    Суммарный размер в байтах.
    """

    name: str
    version: str
    api_version: str = ""
    manifest_hash: str = ""
    file_hashes: dict[str, str] = field(default_factory=dict)
    total_files: int = 0
    total_size: int = 0

    @classmethod
    def from_directory(cls, path: str) -> PluginCertificate:
        """Создать сертификат из директории стратегии.

        Args:
            path: Путь к директории стратегии.

        Returns:
            PluginCertificate с хешами всех файлов.
        """
        import os

        if not os.path.isdir(path):
            raise ValueError(f"Not a directory: {path}")

        # Читаем manifest для name/version
        manifest_path = os.path.join(path, "manifest.yaml")
        manifest_hash = ""
        name = ""
        version = ""
        api_version = ""

        if os.path.exists(manifest_path):
            import hashlib
            with open(manifest_path, "rb") as f:
                content = f.read()
            manifest_hash = hashlib.sha256(content).hexdigest()

            # Парсим manifest для name/version
            import yaml
            try:
                data = yaml.safe_load(content)
                if isinstance(data, dict):
                    name = str(data.get("name", ""))
                    version = str(data.get("version", "0.0.0"))
                    api_version = str(data.get("api_version", data.get("api", "")))
            except Exception:
                pass

        file_hashes: dict[str, str] = {}
        total_size = 0

        for root, dirs, files in os.walk(path):
            # Пропускаем __pycache__ и .git
            dirs[:] = [d for d in dirs if d not in ("__pycache__", ".git", ".venv", "node_modules")]
            for fname in sorted(files):
                fpath = os.path.join(root, fname)
                rel = os.path.relpath(fpath, path)
                try:
                    with open(fpath, "rb") as f:
                        content = f.read()
                    file_hash = hashlib.sha256(content).hexdigest()
                    file_hashes[rel] = file_hash
                    total_size += len(content)
                except (OSError, PermissionError):
                    continue

        return cls(
            name=name,
            version=version,
            api_version=api_version,
            manifest_hash=manifest_hash,
            file_hashes=file_hashes,
            total_files=len(file_hashes),
            total_size=total_size,
        )

    def verify(self, other: PluginCertificate) -> bool:
        """Проверить, совпадает ли сертификат с другим.

        Args:
            other: Другой сертификат (например, из Marketplace).

        Returns:
            True если все хеши совпадают.
        """
        if self.name != other.name:
            return False
        if self.version != other.version:
            return False
        if self.manifest_hash != other.manifest_hash:
            return False
        if self.file_hashes != other.file_hashes:
            return False
        return True

    def verify_integrity(self, path: str) -> list[str]:
        """Проверить целостность директории стратегии.

        Args:
            path: Путь к директории стратегии.

        Returns:
            Список несовпадений (пустой = OK).
        """
        import os

        violations: list[str] = []
        current = self.from_directory(path)

        if self.manifest_hash != current.manifest_hash:
            violations.append("manifest.yaml hash mismatch")

        for rel_path, expected_hash in self.file_hashes.items():
            full_path = os.path.join(path, rel_path)
            if not os.path.exists(full_path):
                violations.append(f"Missing file: {rel_path}")
                continue
            with open(full_path, "rb") as f:
                actual_hash = hashlib.sha256(f.read()).hexdigest()
            if actual_hash != expected_hash:
                violations.append(f"Hash mismatch: {rel_path}")

        for rel_path in current.file_hashes:
            if rel_path not in self.file_hashes:
                violations.append(f"Extra file: {rel_path}")

        return violations

    def to_dict(self) -> dict[str, object]:
        """Сериализация в dict для хранения/передачи."""
        return {
            "name": self.name,
            "version": self.version,
            "api_version": self.api_version,
            "manifest_hash": self.manifest_hash,
            "file_hashes": dict(self.file_hashes),
            "total_files": self.total_files,
            "total_size": self.total_size,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> PluginCertificate:
        """Восстановить сертификат из dict."""
        return cls(
            name=str(data.get("name", "")),
            version=str(data.get("version", "")),
            api_version=str(data.get("api_version", "")),
            manifest_hash=str(data.get("manifest_hash", "")),
            file_hashes=dict(data.get("file_hashes", {})),
            total_files=int(data.get("total_files", 0)),
            total_size=int(data.get("total_size", 0)),
        )

    def __repr__(self) -> str:
        return (
            f"PluginCertificate(name={self.name!r}, v{self.version}, "
            f"{self.total_files} files, {self._format_size(self.total_size)})"
        )

    @staticmethod
    def _format_size(bytes_: int) -> str:
        if bytes_ < 1024:
            return f"{bytes_} B"
        elif bytes_ < 1024 * 1024:
            return f"{bytes_ / 1024:.1f} KB"
        return f"{bytes_ / (1024 * 1024):.1f} MB"
