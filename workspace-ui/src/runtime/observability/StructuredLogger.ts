/**
 * StructuredLogger — JSON-structured logger replacing console.*
 *
 * Every log produces a structured JSON object with mandatory fields:
 *   timestamp, level, module, message, traceId (if available)
 *
 * Levels: debug → info → warn → error → fatal
 *   fatal throws an error after logging (for unrecoverable situations)
 *
 * Usage:
 *   const log = new StructuredLogger('gateway')
 *   log.info({ message: 'Connected', endpoint: 'wss://...', duration_ms: 120 })
 *   log.error({ message: 'Disconnected', error: err.message, traceId })
 *
 * @since 6.1.0
 */

/* ── Level definitions ── */

export const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  FATAL: 4,
} as const

export type LogLevelValue = (typeof LogLevel)[keyof typeof LogLevel]

export type LogLevelName = 'debug' | 'info' | 'warn' | 'error' | 'fatal'

const LEVEL_NAMES: Record<number, LogLevelName> = {
  [LogLevel.DEBUG]: 'debug',
  [LogLevel.INFO]: 'info',
  [LogLevel.WARN]: 'warn',
  [LogLevel.ERROR]: 'error',
  [LogLevel.FATAL]: 'fatal',
}

/* ── Log entry shape ── */

export interface LogEntry {
  timestamp: string
  level: LogLevelName
  module: string
  message: string
  traceId?: string
  correlationId?: string
  duration_ms?: number
  error?: string
  [key: string]: unknown
}

/* ── Transport (pluggable output) ── */

export interface LogTransport {
  write(entry: LogEntry): void
}

/* ── Console transport (default) ── */

const LEVEL_COLORS: Record<number, string> = {
  [LogLevel.DEBUG]: '\x1b[90m',   // grey
  [LogLevel.INFO]: '\x1b[32m',    // green
  [LogLevel.WARN]: '\x1b[33m',    // yellow
  [LogLevel.ERROR]: '\x1b[31m',   // red
  [LogLevel.FATAL]: '\x1b[41m',   // red bg
}

const RESET = '\x1b[0m'

const ConsoleTransport: LogTransport = {
  write(entry: LogEntry): void {
    const color = LEVEL_COLORS[LogLevel[entry.level.toUpperCase() as keyof typeof LogLevel] as unknown as number] ?? ''
    const tag = entry.level.toUpperCase().padEnd(5)
    const trace = entry.traceId ? ` [${entry.traceId}]` : ''
    const duration = entry.duration_ms !== undefined ? ` +${entry.duration_ms}ms` : ''
    const line = `${color}${tag}${RESET} ${entry.module}${trace}${duration}: ${entry.message}`

    switch (entry.level) {
      case 'fatal':
      case 'error':
        console.error(line, entry.error ? `\n  ${entry.error}` : '', entry)
        break
      case 'warn':
        console.warn(line, entry)
        break
      default:
        console.log(line)
    }
  },
}

/* ── Logger ── */

export class StructuredLogger {
  /** Global minimum log level (can be changed at runtime) */
  static minLevel: LogLevelValue = LogLevel.DEBUG

  /** Global transports */
  static transports: LogTransport[] = [ConsoleTransport]

  /** Global hook called on every log entry (for metrics, alerting) */
  static onLog: ((entry: LogEntry) => void) | null = null

  constructor(
    public readonly module: string,
  ) {}

  debug(msg: string, ctx?: Record<string, unknown>): void {
    this._log(LogLevel.DEBUG, msg, ctx)
  }

  info(msg: string, ctx?: Record<string, unknown>): void {
    this._log(LogLevel.INFO, msg, ctx)
  }

  warn(msg: string, ctx?: Record<string, unknown>): void {
    this._log(LogLevel.WARN, msg, ctx)
  }

  error(msg: string, ctx?: Record<string, unknown>): void {
    this._log(LogLevel.ERROR, msg, ctx)
  }

  fatal(msg: string, ctx?: Record<string, unknown>): never {
    this._log(LogLevel.FATAL, msg, ctx)
    throw new Error(`[FATAL] ${this.module}: ${msg}`)
  }

  /** Create a child logger with a sub-module prefix */
  child(subModule: string): StructuredLogger {
    return new StructuredLogger(`${this.module}.${subModule}`)
  }

  /* ── Core ── */

  private _log(level: LogLevelValue, message: string, ctx?: Record<string, unknown>): void {
    if (level < StructuredLogger.minLevel) return

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LEVEL_NAMES[level] ?? 'info',
      module: this.module,
      message,
      ...(ctx ?? {}),
    }

    for (const transport of StructuredLogger.transports) {
      transport.write(entry)
    }

    StructuredLogger.onLog?.(entry)
  }
}

/** Convenience: a logger-creation function that reads ObservabilityRuntime's config */
let _defaultLogger: StructuredLogger | null = null

export function setDefaultLogger(logger: StructuredLogger): void {
  _defaultLogger = logger
}

export function getLogger(module?: string): StructuredLogger {
  if (module) return new StructuredLogger(module)
  return _defaultLogger ?? new StructuredLogger('runtime')
}
