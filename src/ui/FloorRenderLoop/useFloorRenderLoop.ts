import { useCallback, useEffect, useRef, useState } from 'react';
import type { EventBus } from '../../game/EventBus';
import type { FloorSim } from '../../game/FloorSim';
import { loadTunables } from '../../game/data';

const RENDER_LOOP = loadTunables().renderLoop;

export interface FloorRenderLoop {
  /** Active speed multiplier (one of the configured `speeds`). */
  speed: number;
  /** Configured selectable multipliers; first is the default. */
  speeds: readonly number[];
  /** Player-paused, or auto-paused by a forced exception. */
  paused: boolean;
  /** Pick a speed multiplier. Cadence = baseTickIntervalMs / speed. */
  setSpeed: (speed: number) => void;
  /** Toggle the player pause (also the resume after an auto-pause). */
  togglePause: () => void;
  /** Skip-to-close: burn the rest of the day in one deterministic jump. */
  skipToClose: () => void;
}

/**
 * The live clock (#121). A wall-clock interval calls `floor.step()` at a
 * tunable base cadence scaled by the speed multiplier; Pause halts the
 * interval; `floor:exception_raised` auto-pauses and surfaces the alert.
 * Ambient grabbables (walks / cherry-picks) do NOT auto-pause.
 *
 * Game logic never sees wall-clock: speed/pause are pure render multipliers
 * over the deterministic `step()` — headless `runDay()` is unaffected.
 */
export function useFloorRenderLoop(deps: {
  /** The owned FloorSim for the open day, or null when not FLOOR_OPEN. */
  floor: FloorSim | null;
  /** FLOOR_OPEN and the loop should be driving (false ⇒ idle). */
  active: boolean;
  bus: EventBus;
  /** Re-render after each step (and on skip-to-close). */
  onTick: () => void;
  /**
   * External suspend independent of the player pause — e.g. a hand-play
   * modal open in auto-pause mode. The interval halts but the pause button
   * state is untouched.
   */
  hold?: boolean;
}): FloorRenderLoop {
  const { floor, active, bus, onTick, hold = false } = deps;
  const speeds = RENDER_LOOP.speedMultipliers;
  const [speed, setSpeed] = useState<number>(speeds[0]);
  const [paused, setPaused] = useState(false);

  // Keep the latest onTick without re-arming the interval each render.
  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;

  // Forced-exception auto-pause. Ambient walks/cherry-picks deliberately do
  // not subscribe here — only escalations halt the floor.
  useEffect(() => {
    if (!active) return;
    const onException = () => setPaused(true);
    bus.subscribe('floor:exception_raised', onException);
    return () => bus.unsubscribe('floor:exception_raised', onException);
  }, [bus, active]);

  // Fresh day ⇒ clear any lingering auto-pause and reset to default speed.
  useEffect(() => {
    if (floor && active) {
      setPaused(false);
      setSpeed(speeds[0]);
    }
  }, [floor, active, speeds]);

  const running =
    active && floor != null && !floor.dayComplete && !paused && !hold;

  useEffect(() => {
    if (!running || !floor) return;
    const intervalMs = RENDER_LOOP.baseTickIntervalMs / speed;
    const id = setInterval(() => {
      if (floor.dayComplete) {
        clearInterval(id);
        return;
      }
      floor.step();
      onTickRef.current();
    }, intervalMs);
    return () => clearInterval(id);
  }, [running, floor, speed]);

  const togglePause = useCallback(() => setPaused((p) => !p), []);

  const skipToClose = useCallback(() => {
    if (!floor || floor.dayComplete) return;
    floor.runDay();
    onTickRef.current();
  }, [floor]);

  return { speed, speeds, paused, setSpeed, togglePause, skipToClose };
}
