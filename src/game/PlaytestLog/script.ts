// ── The guided playtest script (#333) ────────────────────────────────────────
// `docs/planning/playtest-round-1.md` stays the human-readable source of truth;
// `data/playtest-script.json` is the same script in the shape the phone renders.
// Pure read model — it derives *where you are in the round* from the log's own
// entries, so there is no second cursor to persist and nothing to keep in sync.

import rawScript from '../../../data/playtest-script.json';
import type { PlaytestEntry } from './types';

/** Reserved step id marking a script day node finished. It is what advances the
 *  guide's cursor — individual ticks are evidence, this is the "next day". */
export const DAY_DONE_STEP_ID = '__day_done';

export type ProbeWhen = 'day_open' | 'day_close';

export interface PlaytestProbe {
  id: string;
  /** `day_open` probes ride the morning card; `day_close` probes are presented
   *  after the Reveal, when they are actually answerable. */
  when: ProbeWhen;
  prompt: string;
  /** One-tap answers. Free text is always available alongside them. */
  quick: readonly string[];
}

export interface PlaytestScriptStep {
  id: string;
  text: string;
}

export interface PlaytestScriptDay {
  id: string;
  /** Session id (`'A'` / `'B'`) and its human label, flattened onto the day so
   *  the card can title itself without walking back up the tree. */
  session: string;
  sessionLabel: string;
  title: string;
  brief: string;
  steps: readonly PlaytestScriptStep[];
  probes: readonly PlaytestProbe[];
}

export interface PlaytestScript {
  round: string;
  /** "Already known — don't bother reporting these", shown on every card. */
  knownDark: readonly string[];
  /** Sessions flattened in order: the round is one linear list of day nodes. */
  days: readonly PlaytestScriptDay[];
}

interface RawDay {
  id: string;
  title: string;
  brief: string;
  steps: { id: string; text: string }[];
  probes: { id: string; when: string; prompt: string; quick: string[] }[];
}

interface RawScript {
  round: string;
  knownDark: string[];
  sessions: { id: string; label: string; days: RawDay[] }[];
}

const script: PlaytestScript = (() => {
  const raw = rawScript as RawScript;
  const days: PlaytestScriptDay[] = [];
  for (const session of raw.sessions) {
    for (const day of session.days) {
      days.push({
        id: day.id,
        session: session.id,
        sessionLabel: session.label,
        title: day.title,
        brief: day.brief,
        steps: day.steps,
        probes: day.probes.map((p) => ({
          ...p,
          when: p.when === 'day_open' ? 'day_open' : 'day_close',
        })),
      });
    }
  }
  return { round: raw.round, knownDark: raw.knownDark, days };
})();

/** The round-1 script, flattened across sessions. Static data — one instance. */
export function loadPlaytestScript(): PlaytestScript {
  return script;
}

export interface PlaytestGuideState {
  /** The day node the player is on, or `null` once every node is done — which
   *  is the round-complete state, not an error. */
  day: PlaytestScriptDay | null;
  /** 1-based position of `day` in the round; `dayCount` when complete. */
  dayIndex: number;
  dayCount: number;
  /** Last-write-wins tick state, keyed by step id. */
  stepsDone: Readonly<Record<string, boolean>>;
  /** Last-write-wins answers, keyed by probe id. */
  answers: Readonly<Record<string, string>>;
  /** Ticked / total for the current day (excludes the day-done marker). */
  stepsComplete: number;
  stepsTotal: number;
  complete: boolean;
}

function dayDoneKey(dayId: string): string {
  return `${dayId}:${DAY_DONE_STEP_ID}`;
}

/**
 * Where the player is in the round, derived purely from the log.
 *
 * The cursor is "the first day node not marked done" rather than an in-game day
 * number, which is what makes the guide survive the things a playtest actually
 * does to it: a reset save, a second career for session B, an extra unscripted
 * day played for the feel of it.
 */
export function deriveGuideState(
  scriptIn: PlaytestScript,
  entries: readonly PlaytestEntry[],
): PlaytestGuideState {
  const stepsDone: Record<string, boolean> = {};
  const answers: Record<string, string> = {};
  // Ordered by seq so "last write wins" means the player's latest tap.
  for (const e of [...entries].sort((a, b) => a.seq - b.seq)) {
    if (e.kind === 'step') stepsDone[`${e.dayId}:${e.stepId}`] = e.done;
    else if (e.kind === 'answer') answers[e.probeId] = e.response;
  }

  const index = scriptIn.days.findIndex((d) => stepsDone[dayDoneKey(d.id)] !== true);
  const complete = index === -1;
  const day = complete ? null : scriptIn.days[index];
  const stepsTotal = day?.steps.length ?? 0;
  const stepsComplete =
    day == null
      ? 0
      : day.steps.filter((s) => stepsDone[`${day.id}:${s.id}`] === true).length;

  return {
    day,
    dayIndex: complete ? scriptIn.days.length : index + 1,
    dayCount: scriptIn.days.length,
    stepsDone,
    answers,
    stepsComplete,
    stepsTotal,
    complete,
  };
}

/** The current day's probes for a moment that still need an answer. */
export function pendingProbes(
  state: PlaytestGuideState,
  when: ProbeWhen,
): readonly PlaytestProbe[] {
  if (state.day == null) return [];
  return state.day.probes.filter(
    (p) => p.when === when && (state.answers[p.id] ?? '') === '',
  );
}
