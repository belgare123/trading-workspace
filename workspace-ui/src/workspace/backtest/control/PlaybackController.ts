// ── PlaybackController — Control backtest playback (play/pause/stop/step) ──
//
// @since 3.5.3

import type { SpeedPreset, PlaybackState } from '../types'
import { PlaybackSpeed } from './PlaybackSpeed'

export class PlaybackController {
  private _state: PlaybackState = {
    speed: 1,
    isPlaying: false,
    isStepMode: false,
    stepForward: false,
  }

  // ── Callbacks ──
  private _onPlay: (() => void) | null = null
  private _onPause: (() => void) | null = null
  private _onStop: (() => void) | null = null
  private _onSpeedChange: ((speed: SpeedPreset) => void) | null = null
  private _onStep: (() => void) | null = null

  onPlay(cb: () => void): void { this._onPlay = cb }
  onPause(cb: () => void): void { this._onPause = cb }
  onStop(cb: () => void): void { this._onStop = cb }
  onSpeedChange(cb: (speed: SpeedPreset) => void): void { this._onSpeedChange = cb }
  onStep(cb: () => void): void { this._onStep = cb }

  get state(): PlaybackState {
    return { ...this._state }
  }

  get speed(): SpeedPreset {
    return this._state.speed
  }

  get isPlaying(): boolean {
    return this._state.isPlaying
  }

  get isPaused(): boolean {
    return !this._state.isPlaying
  }

  play(): void {
    this._state.isPlaying = true
    this._state.isStepMode = false
    this._state.stepForward = false
    this._onPlay?.()
  }

  pause(): void {
    this._state.isPlaying = false
    this._onPause?.()
  }

  stop(): void {
    this._state.isPlaying = false
    this._state.isStepMode = false
    this._state.stepForward = false
    this._onStop?.()
  }

  setSpeed(speed: SpeedPreset): void {
    this._state.speed = speed
    this._onSpeedChange?.(speed)
  }

  faster(): void {
    this.setSpeed(PlaybackSpeed.faster(this._state.speed))
  }

  slower(): void {
    this.setSpeed(PlaybackSpeed.slower(this._state.speed))
  }

  /** Step forward (single bar) */
  stepForward(): void {
    this._state.isStepMode = true
    this._state.stepForward = true
    this._onStep?.()
  }
}
