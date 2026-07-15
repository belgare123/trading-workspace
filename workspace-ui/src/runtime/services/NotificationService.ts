
import type { NotificationRuntime, NotificationEntry } from './types';

let _nextId = 1;

export class NotificationService implements NotificationRuntime {
  readonly id = 'notification' as const;
  private _history: NotificationEntry[] = [];

  send(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    const entry: NotificationEntry = { id: `notif-${_nextId++}`, message, level, timestamp: Date.now() };
    this._history.push(entry);
    console.log(`[Notif] [${level.toUpperCase()}] ${message}`);
  }

  history(): NotificationEntry[] { return [...this._history]; }
  clear(): void { this._history = []; }
}
