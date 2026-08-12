import {
  loadClockBites,
  type BiteId,
  type ClockBitesConfig,
  type CoverageFactId,
  type HaltReasonId,
} from './clockBiteData';

/**
 * ClockBite (#381) — the bite lifecycle, one altitude above DayLoopController's
 * day lifecycle.
 *
 * The player chooses how big a bite of the calendar to run before they look
 * again, and the size of the bite is itself a bet: a bigger bite wagers that
 * your standing policy and your staff carry the store without your judgment.
 *
 * ONE rule governs the ladder — **you can skip ahead exactly as far as your
 * people can cover for you.** A day can only run headless when nothing
 * escalates to the player, and what stops things escalating is a desk that is
 * staffed and at threshold. The door and the capability are the same fact, so
 * the player never learns a second rule.
 *
 * This module imports no sibling module: it never sees StaffOrg,
 * DayLoopController or FloorSim. The composition root resolves coverage from
 * the live roster with the existing act-gate predicates and injects the two
 * closures the runner drives.
 */

export interface BiteOption {
  id: BiteId;
  label: string;
  days: number;
  unlocked: boolean;
  /**
   * Plain-language statement of the shut door, or null when the bite is open.
   * The picker states this verbatim — a locked bite is never a silently greyed
   * control.
   */
  lockedReason: string | null;
  /**
   * What picking this bite wagers (#383), stated verbatim by the picker before
   * the player commits — a bet you cannot read before placing is not a
   * decision. Null only for the day, which is watched as it happens; the schema
   * refuses any bite above the day that omits it.
   */
  stakes: string | null;
}

/** Why a run stopped short, and the sentence the surface states. */
export interface HaltReason {
  id: HaltReasonId;
  sentence: string;
}

/**
 * What the composition root hands back when a run has to stop (#384).
 *
 * One seam carries every class of halt. `subject` fills the `{subject}` slot in
 * the reason's catalog sentence and is how the overnight channel names the
 * person or the thing that needs the owner — the halt cadence is written once,
 * in `data/clock-bites.json`, and the subject once, beside the moment that
 * raised it. A reason whose sentence carries no slot ignores it.
 */
export interface BiteHalt {
  id: HaltReasonId;
  subject?: string;
}

export interface BiteRunDeps {
  /**
   * Advance the clock exactly one day and exhaust it — the composition root's
   * `nextDay()` + `floor.runDay()`, the same primitive `skipToClose` drives.
   * Per-day beats must be captured as each day closes: the daily refs are
   * cleared before the next `nextDay()`, so a runner that only read the final
   * day would silently swallow the rest of the bite's wins, walk-offs, crowned
   * records and month verdicts.
   */
  advanceOneDay: () => void;
  /**
   * Asked once after each day. A non-null halt ends the bite at that day.
   * The day still counts — it happened.
   *
   * This is the ONE seam every class of halt arrives through (#384): a floor
   * escalation and an overnight moment that needs the owner are the same
   * question — "does the store need a human now?" — and a second list beside
   * this one is how the two answers start disagreeing about which came first.
   */
  checkHalt: () => BiteHalt | null;
}

export interface BiteRun {
  biteId: BiteId;
  daysRequested: number;
  /** Days that actually ran. Equals `daysRequested` when nothing halted. */
  daysRun: number;
  halt: HaltReason | null;
}

function biteDef(config: ClockBitesConfig, biteId: BiteId) {
  const bite = config.bites.find((b) => b.id === biteId);
  // The schema refuses a catalog missing any declared id, so this is a
  // programming error rather than a data one.
  if (!bite) throw new Error(`ClockBite: unknown bite "${biteId}"`);
  return bite;
}

/**
 * The three bites with their doors resolved against what the store currently
 * covers. Every bite is always returned — a locked one carries its reason, it
 * is never dropped from the list.
 */
export function availableBites(
  coverage: readonly CoverageFactId[],
  config: ClockBitesConfig = loadClockBites(),
): readonly BiteOption[] {
  const held = new Set(coverage);
  return config.bites.map((bite) => {
    const missing = bite.requires.filter((r) => !held.has(r));
    return {
      id: bite.id,
      label: bite.label,
      days: bite.days,
      unlocked: missing.length === 0,
      stakes: bite.stakes ?? null,
      // Each missing cover states itself; two of them read as one plain
      // explanation, which is why the sentences are written to stand alone.
      lockedReason:
        missing.length === 0
          ? null
          : missing
              .map(
                (id) =>
                  config.coverage.find((f) => f.id === id)?.missingSentence ?? '',
              )
              .filter(Boolean)
              .join(' '),
    };
  });
}

/**
 * Run a bite headless and synchronously.
 *
 * The runner does NOT check the door — `availableBites` is the door and the
 * picker is what obeys it. Keeping the runner a pure "run N days, stop when
 * asked" primitive is what lets a test drive it without a roster.
 *
 * There is no queued remainder and no auto-resume, by construction: this
 * function holds no state between calls. A run that silently continued past the
 * thing that interrupted it would be the bite making the player's decision for
 * them.
 */
export function runBite(
  biteId: BiteId,
  deps: BiteRunDeps,
  config: ClockBitesConfig = loadClockBites(),
): BiteRun {
  const bite = biteDef(config, biteId);
  let daysRun = 0;
  let halt: HaltReason | null = null;
  for (let i = 0; i < bite.days; i += 1) {
    deps.advanceOneDay();
    daysRun += 1;
    const signal = deps.checkHalt();
    if (signal) {
      halt = haltReason(signal.id, config, signal.subject);
      break;
    }
  }
  return { biteId, daysRequested: bite.days, daysRun, halt };
}

/**
 * How many individual reactions the Reveal covering this bite may surface
 * (#382). The budget rides the bite, beside its day count, because the bite is
 * the window the feed covers: a week run through a day's budget throws away
 * roughly seven times as much, silently. It grows sub-linearly — seven days of
 * reactions at seven times the stars is a scroll, not a beat — and what the
 * budget cut is stated by the Reveal rather than dropped.
 */
export function biteStarBudget(
  biteId: BiteId,
  config: ClockBitesConfig = loadClockBites(),
): number {
  return biteDef(config, biteId).starBudget;
}

/**
 * The plain-language sentence for a halt, off the catalog.
 *
 * `subject` fills the reason's `{subject}` slot (#384) — the overnight channel
 * names who needed the owner, and the halt's own cadence stays written once in
 * `data/clock-bites.json`. An unfilled slot is left literal, the same way the
 * industry-wire and weekly-report fillers leave one, so a missing subject shows
 * up as a visibly wrong sentence rather than a silently truncated one.
 */
export function haltReason(
  id: HaltReasonId,
  config: ClockBitesConfig = loadClockBites(),
  subject?: string,
): HaltReason {
  const halt = config.halts.find((h) => h.id === id);
  if (!halt) throw new Error(`ClockBite: unknown halt reason "${id}"`);
  const sentence =
    subject == null
      ? halt.sentence
      : halt.sentence.replace(/\{subject\}/g, subject);
  return { id: halt.id, sentence };
}
