"""
Momentum Strategy — трендовая стратегия на основе EMA + RSI + ATR.

Логика:
  - EMA 9/21 crossover определяет направление тренда
  - RSI фильтрует входы (не входить при экстремумах)
  - ATR для размера позиции и stop-loss

Config (config.yaml):
  fast_period: 9       # быстрая EMA
  slow_period: 21      # медленная EMA
  rsi_period: 14       # период RSI
  rsi_overbought: 70   # порог перекупленности
  rsi_oversold: 30     # порог перепроданности
  atr_period: 14       # период ATR
  atr_multiplier: 2.0  # множитель для stop-loss
  min_confidence: 50   # минимальный confidence для сигнала
  symbols:             # список инструментов
    - BTC/USDT
    - ETH/USDT
"""

from __future__ import annotations

from typing import Any

from screener_sdk import (
    BaseStrategy,
    Signal,
    SignalBundle,
    SignalDirection,
    StrategyContext,
)


class MomentumStrategy(BaseStrategy):
    """Трендовая momentum стратегия на EMA + RSI + ATR."""

    # ── Настройки по умолчанию ──
    FAST_PERIOD = 9
    SLOW_PERIOD = 21
    RSI_PERIOD = 14
    RSI_OVERBOUGHT = 70
    RSI_OVERSOLD = 30
    ATR_PERIOD = 14
    ATR_MULTIPLIER = 2.0
    MIN_CONFIDENCE = 50
    DEFAULT_SYMBOLS = ["BTC/USDT", "ETH/USDT"]

    async def analyze(self, ctx: StrategyContext) -> SignalBundle:
        """Основной цикл анализа.

        Для каждого символа:
          1. Получить свечи и индикаторы
          2. Определить направление тренда (EMA crossover)
          3. Проверить RSI фильтр
          4. Рассчитать confidence
          5. Сформировать сигнал

        Returns:
            SignalBundle со всеми найденными сигналами.
        """
        # ══ Читаем config ══════════════════════════════════════
        cfg = ctx.config
        fast_period = cfg.get("fast_period", self.FAST_PERIOD)
        slow_period = cfg.get("slow_period", self.SLOW_PERIOD)
        rsi_period = cfg.get("rsi_period", self.RSI_PERIOD)
        rsi_overbought = cfg.get("rsi_overbought", self.RSI_OVERBOUGHT)
        rsi_oversold = cfg.get("rsi_oversold", self.RSI_OVERSOLD)
        atr_multiplier = cfg.get("atr_multiplier", self.ATR_MULTIPLIER)
        min_confidence = cfg.get("min_confidence", self.MIN_CONFIDENCE)
        symbols = cfg.get("symbols", self.DEFAULT_SYMBOLS)

        signals: list[Signal] = []

        for symbol in symbols:
            try:
                signal = await self._analyze_symbol(
                    ctx=ctx,
                    symbol=symbol,
                    fast_period=fast_period,
                    slow_period=slow_period,
                    rsi_period=rsi_period,
                    rsi_overbought=rsi_overbought,
                    rsi_oversold=rsi_oversold,
                    atr_multiplier=atr_multiplier,
                    min_confidence=min_confidence,
                )
                if signal is not None:
                    signals.append(signal)
            except Exception as e:
                self._logger.warning(
                    "Momentum[%s] error: %s", symbol, e
                )
                continue

        return SignalBundle(
            strategy=self.name,
            signals=signals,
        )

    async def _analyze_symbol(
        self,
        ctx: StrategyContext,
        symbol: str,
        fast_period: int,
        slow_period: int,
        rsi_period: int,
        rsi_overbought: float,
        rsi_oversold: float,
        atr_multiplier: float,
        min_confidence: float,
    ) -> Signal | None:
        """Анализ одного символа."""
        # ══ 1. Данные ═══════════════════════════════════════════
        # Пытаемся получить предвычисленные индикаторы из FeatureAPI
        ema_fast = await ctx.features.get(
            "ema", symbol=symbol, period=fast_period
        )
        ema_slow = await ctx.features.get(
            "ema", symbol=symbol, period=slow_period
        )
        rsi = await ctx.features.get(
            "rsi", symbol=symbol, period=rsi_period
        )
        atr = await ctx.features.get(
            "atr", symbol=symbol, period=self.ATR_PERIOD
        )

        # Если нет индикаторов — вычисляем из свечей
        if ema_fast is None or ema_slow is None:
            candles = await ctx.features.get_candles(
                symbol=symbol, limit=slow_period + 10
            )
            if not candles or len(candles) < slow_period:
                self._logger.debug(
                    "Momentum[%s]: недостаточно данных (%d свечей)",
                    symbol,
                    len(candles) if candles else 0,
                )
                return None

            closes = [c["close"] for c in candles]
            ema_fast = self._compute_ema(closes, fast_period)
            ema_slow = self._compute_ema(closes, slow_period)

            if rsi is None:
                rsi = self._compute_rsi(closes, rsi_period)

            if atr is None:
                atr = self._compute_atr(candles, self.ATR_PERIOD)

        if ema_fast is None or ema_slow is None:
            return None

        # ══ 2. Направление тренда (EMA crossover) ══════════════
        current_price = await ctx.market.price(symbol)
        if current_price is None and rsi is None:
            return None

        # Direction: LONG если fast > slow, SHORT если fast < slow
        direction = SignalDirection.NEUTRAL
        if ema_fast > ema_slow:
            direction = SignalDirection.LONG
        elif ema_fast < ema_slow:
            direction = SignalDirection.SHORT

        if direction == SignalDirection.NEUTRAL:
            return None

        # ══ 3. RSI фильтр ══════════════════════════════════════
        # LONG только если RSI не перекуплен (< overbought)
        # SHORT только если RSI не перепродан (> oversold)
        if rsi is not None:
            if direction == SignalDirection.LONG and rsi >= rsi_overbought:
                self._logger.debug(
                    "Momentum[%s]: RSI=%.1f overbought, skip LONG",
                    symbol,
                    rsi,
                )
                return None
            if direction == SignalDirection.SHORT and rsi <= rsi_oversold:
                self._logger.debug(
                    "Momentum[%s]: RSI=%.1f oversold, skip SHORT",
                    symbol,
                    rsi,
                )
                return None

        # ══ 4. Confidence ══════════════════════════════════════
        # Чем сильнее расхождение EMA — тем выше уверенность
        ema_diff_pct = abs(ema_fast - ema_slow) / ema_slow * 100
        confidence = min(95.0, 50.0 + ema_diff_pct * 5.0)

        # RSI-strength modifier
        if rsi is not None:
            if direction == SignalDirection.LONG:
                # RSI от 30 до 50 = сильный сигнал
                if 30 <= rsi <= 50:
                    confidence = min(95.0, confidence + 10.0)
                # RSI от 50 до 60 = средний
                elif 50 < rsi <= 60:
                    confidence = min(85.0, confidence)
            elif direction == SignalDirection.SHORT:
                # RSI от 50 до 70 = сильный сигнал
                if 50 <= rsi <= 70:
                    confidence = min(95.0, confidence + 10.0)
                # RSI от 40 до 50 = средний
                elif 40 <= rsi < 50:
                    confidence = min(85.0, confidence)

        if confidence < min_confidence:
            self._logger.debug(
                "Momentum[%s]: confidence=%.1f < min=%.0f, skip",
                symbol,
                confidence,
                min_confidence,
            )
            return None

        # ══ 5. Stop-loss (ATR-based) ═══════════════════════════
        stop_loss: float | None = None
        take_profit: float | None = None
        if atr is not None and atr > 0 and current_price is not None:
            atr_distance = atr * atr_multiplier
            if direction == SignalDirection.LONG:
                stop_loss = current_price - atr_distance
                take_profit = current_price + atr_distance * 2.0
            else:
                stop_loss = current_price + atr_distance
                take_profit = current_price - atr_distance * 2.0

        # ══ 6. Metadata ════════════════════════════════════════
        metadata: dict[str, Any] = {
            "ema_fast": round(ema_fast, 2),
            "ema_slow": round(ema_slow, 2),
            "ema_diff_pct": round(ema_diff_pct, 2),
        }
        if rsi is not None:
            metadata["rsi"] = round(rsi, 1)
        if atr is not None:
            metadata["atr"] = round(atr, 2)
        if current_price is not None:
            metadata["price"] = current_price
        if stop_loss is not None:
            metadata["stop_loss"] = round(stop_loss, 2)
            metadata["take_profit"] = round(take_profit, 2)

        self._logger.info(
            "Momentum[%s]: %s confidence=%.1f fast=%.2f slow=%.2f rsi=%s",
            symbol,
            direction.value.upper(),
            confidence,
            ema_fast,
            ema_slow,
            f"{rsi:.1f}" if rsi is not None else "N/A",
        )

        return Signal(
            symbol=symbol,
            direction=direction,
            score=confidence,
            confidence=confidence,
            metadata=metadata,
            strategy=self.name,
        )

    # ══════════════════════════════════════════════════════════════
    #  Технические индикаторы (standalone fallback)
    # ══════════════════════════════════════════════════════════════

    @staticmethod
    def _compute_ema(prices: list[float], period: int) -> float | None:
        """EMA по последним period значениям.

        Простая реализация для случаев, когда FeatureAPI не предоставляет EMA.
        """
        if len(prices) < period:
            return None
        k = 2.0 / (period + 1)
        ema = sum(prices[:period]) / period
        for price in prices[period:]:
            ema = price * k + ema * (1 - k)
        return ema

    @staticmethod
    def _compute_rsi(prices: list[float], period: int = 14) -> float | None:
        """RSI по последним period + 1 значениям."""
        if len(prices) < period + 1:
            return None
        gains = []
        losses = []
        for i in range(len(prices) - period, len(prices)):
            if i == 0:
                continue
            change = prices[i] - prices[i - 1]
            if change >= 0:
                gains.append(change)
                losses.append(0.0)
            else:
                gains.append(0.0)
                losses.append(abs(change))
        avg_gain = sum(gains) / period if gains else 0.0
        avg_loss = sum(losses) / period if losses else 1e-10
        rs = avg_gain / avg_loss if avg_loss > 0 else float("inf")
        rsi = 100.0 - (100.0 / (1.0 + rs))
        return rsi

    @staticmethod
    def _compute_atr(
        candles: list[dict[str, float]], period: int = 14
    ) -> float | None:
        """ATR по свечам (H-L)."""
        if len(candles) < period + 1:
            return None
        ranges = []
        for i in range(-period, 0):
            high = candles[i].get("high", candles[i]["close"])
            low = candles[i].get("low", candles[i]["close"])
            prev_close = candles[i - 1]["close"] if i > -period else low
            tr = max(
                high - low,
                abs(high - prev_close),
                abs(low - prev_close),
            )
            ranges.append(tr)
        return sum(ranges) / len(ranges) if ranges else None
