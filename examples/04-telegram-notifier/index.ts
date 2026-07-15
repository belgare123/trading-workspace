/**
 * Telegram Notifier — мост между strategy.signal и Telegram-уведомлениями
 *
 * Добавляет к Example 3:
 * - Подписка на стратегические события (strategy.signal)
 * - Notification API
 * - Plugin Settings
 * - Команда тестирования
 *
 * @since 2.0.0
 */

import { useState, useEffect } from 'react'
import { WidgetRegistry } from '../../workspace-ui/src/runtime/WidgetRegistry'
import type { WidgetDefinition } from '../../workspace-ui/src/runtime/types'
import type { PluginContext } from '../../workspace-ui/src/runtime/PluginLoader'
import { runtimeEventBus } from '../../workspace-ui/src/runtime/EventBus'

/* ============================================================
 * Types
 * ============================================================ */

interface StrategySignal {
  id: string
  direction: 'buy' | 'sell'
  symbol: string
  confidence: number
  price: number
}

interface PluginSettings {
  botToken: string
  chatId: string
  minConfidence: number
  enabled: boolean
}

const DEFAULT_SETTINGS: PluginSettings = {
  botToken: '',
  chatId: '',
  minConfidence: 0.7,
  enabled: true,
}

/* ============================================================
 * 1. Settings Storage (localStorage)
 * ============================================================ */

const STORAGE_KEY = 'telegram-notifier-settings'

function loadSettings(): PluginSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}

function saveSettings(settings: PluginSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

/* ============================================================
 * 2. Widget — Settings Panel
 * ============================================================ */

function TelegramSettingsWidget() {
  const [settings, setSettings] = useState(loadSettings)

  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  return (
    <div style={{ padding: 16 }}>
      <h3>📬 Telegram Notifier Settings</h3>
      <label>
        Bot Token:
        <input
          type="password"
          value={settings.botToken}
          onChange={(e) => setSettings({ ...settings, botToken: e.target.value })}
          style={{ width: '100%', marginBottom: 8 }}
        />
      </label>
      <label>
        Chat ID:
        <input
          type="text"
          value={settings.chatId}
          onChange={(e) => setSettings({ ...settings, chatId: e.target.value })}
          style={{ width: '100%', marginBottom: 8 }}
        />
      </label>
      <label>
        Min Confidence: {settings.minConfidence}
        <input
          type="range"
          min={0.1}
          max={1.0}
          step={0.05}
          value={settings.minConfidence}
          onChange={(e) => setSettings({ ...settings, minConfidence: +e.target.value })}
          style={{ width: '100%' }}
        />
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
        <input
          type="checkbox"
          checked={settings.enabled}
          onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
        />
        Enabled
      </label>
    </div>
  )
}

/* ============================================================
 * 3. Команда тестирования
 * ============================================================ */

async function testNotification(ctx: PluginContext): Promise<void> {
  const settings = loadSettings()
  if (!settings.enabled || !settings.botToken) {
    console.warn('[Telegram] Not configured')
    return
  }
  // Эмулируем отправку через Notification API
  ctx.notifications.send({
    title: '🔔 Telegram Test',
    message: 'If configured, this would send a Telegram message',
    level: 'info',
    plugin: 'telegram-notifier',
  })
  console.log('[Telegram] Test notification sent')
}

/* ============================================================
 * 4. Основная логика — подписка на strategy.signal
 * ============================================================ */

function subscribeToStrategySignals(ctx: PluginContext): () => void {
  return runtimeEventBus.on('strategy.signal', (evt) => {
    const signal = evt.payload as StrategySignal
    const settings = loadSettings()

    if (!settings.enabled) return
    if (signal.confidence < settings.minConfidence) return

    const emoji = signal.direction === 'buy' ? '🟢' : '🔴'
    const message = `${emoji} ${signal.symbol}\n` +
      `${signal.direction.toUpperCase()} @ $${signal.price}\n` +
      `Confidence: ${(signal.confidence * 100).toFixed(0)}%`

    // Отправляем через NotificationApi
    ctx.notifications.send({
      title: `Signal: ${signal.symbol}`,
      message,
      level: 'info',
      data: { signalId: signal.id },
      plugin: 'telegram-notifier',
    })

    // Эмулируем отправку в Telegram
    console.log(`[Telegram] Would send: ${message}`)
  })
}

/* ============================================================
 * 5. register / unregister
 * ============================================================ */

export function register(ctx: PluginContext): void {
  console.log('[Telegram Notifier] Installing...')

  // 5a. Widget настроек
  WidgetRegistry.register({
    id: 'telegram-settings',
    name: 'Telegram Notifier',
    description: 'Configure Telegram bot and notification rules',
    category: 'custom',
    defaultSize: { w: 3, h: 4 },
    component: TelegramSettingsWidget,
  })

  // 5b. Команда тестирования
  ctx.commands.register({
    id: 'telegram.test',
    name: 'Test Telegram Notification',
    shortcut: 'Ctrl+Shift+T',
    execute: () => testNotification(ctx),
  })

  // 5c. Подписка на сигналы
  const unsub = subscribeToStrategySignals(ctx)

  // Сохраняем cleanup для unregister
  ;(window as any).__telegramNotifierCleanup = unsub

  console.log('[Telegram Notifier] Ready — listening to strategy.signal')
}

export function unregister(): void {
  console.log('[Telegram Notifier] Cleaning up...')
  WidgetRegistry.unregister('telegram-settings')

  const cleanup = (window as any).__telegramNotifierCleanup
  if (cleanup) {
    cleanup()
    delete (window as any).__telegramNotifierCleanup
  }

  console.log('[Telegram Notifier] Unregistered')
}
