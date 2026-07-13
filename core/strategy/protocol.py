"""
IStrategy — полный протокол стратегии.

Стратегия — это не функция analyze().
Это полноценный компонент платформы со своим жизненным циклом,
совместимый с ServiceRuntime.

Фазы жизненного цикла:
  1. initialize(ctx)   — получить контекст, загрузить config
  2. warmup(data)      — прогрев (дозагрузка истории)
  3. start()           — начать обработку
  4. analyze(ctx)      — главный метод: вычислить сигнал
  5. health()          — отчёт о состоянии
  6. metrics()         — метрики для Monitoring
  7. stop()            — приостановить
  8. shutdown()        — освободить ресурсы
  9. reset()           — сброс до начального состояния

Имплементация:
  - Стратегия реализует IStrategy (structural typing).
  - BaseStrategy (4.4) предоставляет готовую реализацию всех методов.
  - Пользователь пишет только analyze().
"""

from __future__ import annotations

from typing import Any, Optional, Protocol, runtime_checkable

from core.strategy.context import StrategyContext
from core.strategy.signal import SignalBundle


# ═══════════════════════════════════════════════════════════════════
# IStrategy
# ═══════════════════════════════════════════════════════════════════


@runtime_checkable
class IStrategy(Protocol):
    """Полный протокол стратегии.

    Совместим с IService из Service Runtime — стратегия может быть
    зарегистрирована как сервис и управляться ServiceRuntime.

    Structural typing — наследовать IStrategy не обязательно.
    """

    name: str
    """Уникальное имя стратегии (совпадает с manifest.yaml 'name')."""

    @property
    def state(self) -> str:
        """Текущее состояние жизненного цикла.

        Returns:
            Одно из: discovered | validated | loaded | initialized |
                     started | running | paused | stopped | unloaded | failed
        """
        ...

    @property
    def context(self) -> Optional[StrategyContext]:
        """Текущий контекст стратегии (заполняется после initialize())."""
        ...

    # ── Lifecycle ────────────────────────────────────────────────

    async def initialize(self, ctx: StrategyContext) -> None:
        """Инициализация стратегии.

        Вызывается один раз при загрузке стратегии.
        Здесь стратегия:
          - Получает контекст (ctx)
          - Загружает config.yaml
          - Проверяет доступность необходимых признаков
          - Создаёт внутренние структуры (буферы, счётчики)

        Args:
            ctx: Контекст стратегии (feature api, market api, config).
        """
        ...

    async def warmup(self, data: Any | None = None) -> None:
        """Прогрев стратегии (опционально).

        Вызывается после initialize(), перед start().
        Здесь стратегия может:
          - Догрузить исторические данные
          - Прогреть индикаторы на N свечей
          - Загрузить кэш

        Если стратегия может работать без прогрева — оставить пустым.
        """
        ...

    async def start(self) -> None:
        """Запуск стратегии.

        Вызывается после warmup().
        Здесь стратегия:
          - Регистрирует обработчики событий
          - Запускает фоновые задачи (если есть)
          - Переходит в состояние STARTED
        """
        ...

    async def stop(self) -> None:
        """Остановка стратегии.

        Вызывается при graceful shutdown или отключении стратегии.
        Здесь стратегия:
          - Отписывается от событий
          - Сохраняет состояние (checkpoint)
          - Освобождает временные ресурсы

        После stop() может быть start() — например, при restart.
        """
        ...

    async def shutdown(self) -> None:
        """Финальное завершение стратегии.

        Вызывается при полной выгрузке стратегии.
        Здесь стратегия:
          - Освобождает все ресурсы
          - Удаляет временные данные
          - Переходит в состояние UNLOADED

        После shutdown() стратегия не может быть переиспользована
        (только полная перезагрузка через Plugin Loader).
        """
        ...

    async def reset(self) -> None:
        """Сброс стратегии до начального состояния.

        Используется при:
          - Смене конфига (hot-reload)
          - Перезапуске стратегии
          - Ошибке и восстановлении

        После reset() стратегия переходит в LOADED состояние
        и может быть инициализирована заново.
        """
        ...

    # ── Core ──────────────────────────────────────────────────────

    async def analyze(self, ctx: StrategyContext) -> SignalBundle:
        """Главный метод — вычисление сигналов.

        Вызывается Engine по расписанию (каждую свечу, каждый тик).

        Args:
            ctx: Актуальный контекст с текущими данными.

        Returns:
            SignalBundle — набор сигналов (может быть пустым).

        Пример:
            async def analyze(self, ctx):
                candles = await ctx.features.get_candles("BTC/USDT")
                ema_fast = await ctx.features.get("ema", period=20)
                price = await ctx.market.price("BTC/USDT")
                ...
                return SignalBundle(strategy=self.name, signals=[...])
        """
        ...

    # ── Monitoring ───────────────────────────────────────────────

    async def health(self) -> dict[str, Any]:
        """Проверка состояния стратегии.

        Returns:
            dict:
                - state: str         — running | degraded | stopped | error
                - latency_ms: float  — время последнего analyze()
                - last_signal: float — timestamp последнего сигнала
                - signal_count: int  — всего сигналов
                - error_count: int   — ошибок с последнего успеха
                - detail: str        — описание (при degraded/error)
        """
        ...

    async def metrics(self) -> dict[str, Any]:
        """Метрики стратегии для Monitoring.

        Returns:
            dict с ключами:
                - name: str
                - state: str
                - uptime_seconds: float
                - signals_generated: int
                - signals_actionable: int
                - avg_confidence: float
                - avg_score: float
                - last_analyze_ms: float
                - error_rate: float
        """
        ...

    # ── Introspection ─────────────────────────────────────────────

    @property
    def capabilities(self) -> list[str]:
        """Список необходимых признаков (из manifest.yaml)."""
        ...

    @property
    def is_running(self) -> bool:
        """Стратегия активна."""
        ...

    @property
    def is_healthy(self) -> bool:
        """Стратегия в нормальном состоянии."""
        ...
