"""Shared pytest fixtures for Trading Workspace Platform."""
from __future__ import annotations

import pytest


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
