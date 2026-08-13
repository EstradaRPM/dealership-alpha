import type { CoachmarkModel } from '../ui/kit';
import type { Hints } from './useHints';
import {
  loadSpine,
  nextAdviceId,
  type SpineConfig,
  type SpineReading,
  type SpineStepId,
} from './spine';

export interface SpineDeps {
  /** The teaching cluster (#386). The spine owns no store of its own. */
  hints: Hints;
  /** Injectable catalog for tests; the app always reads `data/spine-steps.json`. */
  config?: SpineConfig;
}

export interface Spine {
  /**
   * The coachmark this region should draw, or null. Non-null for exactly one
   * region at a time — the anchor of the first unfinished step — so a surface
   * asks about itself and never has to know where the player is in the flow.
   */
  coachmarkFor: (anchor: string) => CoachmarkModel | null;
  /** A spine step just happened. Idempotent; safe to call after it is done. */
  complete: (id: SpineStepId) => void;
  /**
   * The answer to "What should I do?": the next unfinished spine step while the
   * spine is running, and the best next action off the live reading once it is
   * finished. Never empty — the ladder's last rung is always true.
   */
  advice: (reading: SpineReading) => string;
}

/**
 * The first-run spine (#213).
 *
 * It introduces **no state of its own**. A step is done because its own id sits
 * in the slot's `teaching:<id>` cell, or because the hint whose control
 * performs it has already retired into that same cell — so "the player has
 * bought a car at the auction" is one fact stored once, and "Show hints again"
 * re-arms the spine with everything else because there is nothing else to
 * re-arm.
 *
 * Completion is per-step; the ORDER only decides which unfinished step draws.
 * A player who runs a day before stocking has genuinely run a day, and the
 * spine does not go back and teach it to them afterwards.
 */
export function useSpine({ hints, config = loadSpine() }: SpineDeps): Spine {
  const isDone = (step: SpineConfig['steps'][number]): boolean =>
    hints.hasTaught(step.id) ||
    (step.completedBy != null && hints.hintFor(step.completedBy) === null);

  const currentIndex = (): number => config.steps.findIndex((s) => !isDone(s));

  const complete = (id: SpineStepId) => hints.markTaught(id);

  const coachmarkFor = (anchor: string): CoachmarkModel | null => {
    const index = currentIndex();
    if (index < 0) return null;
    const step = config.steps[index];
    if (step.anchor !== anchor) return null;
    return {
      id: step.id,
      step: index + 1,
      of: config.steps.length,
      title: step.title,
      text: step.text,
      onDone: () => complete(step.id),
    };
  };

  const advice = (reading: SpineReading): string => {
    const index = currentIndex();
    if (index >= 0) return config.steps[index].text;
    const id = nextAdviceId(reading);
    // The loader guarantees every id is declared, so this find cannot miss.
    return config.advice.find((a) => a.id === id)!.text;
  };

  return { coachmarkFor, complete, advice };
}
