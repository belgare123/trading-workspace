"""Shared pytest fixtures for Trading Workspace Platform."""
from __future__ import annotations

import tempfile
from pathlib import Path

import pytest

from core.event_store import EventStore
from core.event_store.sqlite_repo import SQLiteEventRepository


@pytest.fixture
def event_store():
    """Create a temporary EventStore for testing."""
    import shutil
    tmpdir = tempfile.mkdtemp()
    repo = SQLiteEventRepository(db_path=Path(tmpdir) / "test.db")
    store = EventStore(repository=repo)
    yield store
    shutil.rmtree(tmpdir, ignore_errors=True)


@pytest.fixture
def sample_symbol() -> str:
    return "BTC/USDT"


@pytest.fixture
def sample_price() -> float:
    return 20000.0


@pytest.fixture
def sample_atr() -> float:
    return 50.0


@pytest.fixture
def sample_capital() -> float:
    return 1000.0


@pytest.fixture
def sample_regime() -> str:
    return "trending"
