
import type { ReplayRuntime } from './types';

export class ReplayService implements ReplayRuntime {
  readonly id = 'replay' as const;
  private _active = false;
  private _time = '09:42:30';

  isActive(): boolean { return this._active; }
  currentTime(): string { return this._time; }
  play(): void { this._active = true; console.log('[Replay] Play'); }
  pause(): void { this._active = false; console.log('[Replay] Pause'); }
  seek(time: string): void { this._time = time; console.log(`[Replay] Seek ${time}`); }
  setSpeed(speed: number): void { console.log(`[Replay] Speed ${speed}x`); }
}
