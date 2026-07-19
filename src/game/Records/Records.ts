import type { EventBus, EventMap } from '../EventBus';
import { loadTunables } from '../data';

/**
 * Records — the game's durable high-water marks (#329, B1 slice 2).
 *
 * A read-side projection over the existing resolution stream that answers one
 * question the sim could not answer before: *is this the best you have ever
 * done?* Six marks, each a personal best that survives the whole career, and a
 * `records:broken` announcement the moment one is beaten (#330 crowns those on
 * the Reveal feed).
 *
 * It owns no game state other modules read — nothing branches on a record. It
 * is a scoreboard, not a rule.
 *
 * ─── Where the numbers come from ─────────────────────────────────────────────
 * `deal:closed` is the only per-deal signal, and it carries no `day`, so a
 * `clock:day_started` cursor stamps deals the way HistoryLog does. Day and
 * month totals are **accumulated here** — before this module there was no
 * game-side day-gross source of truth at all (the day total lived in a React
 * ref in `useDayLoop`, unpersisted and not replay-safe). Gross uses TierGate's
 * formula — `frontGross + backGross`, units = one per `deal:closed` — so a
 * crowned "best month" agrees with the number the tier gate graded.
 *
 * ─── Ordering ────────────────────────────────────────────────────────────────
 * The day settles on `floor:day_complete`. Records is wired in `createWorld`,
 * so its subscription runs **before** the app's day-close handler that builds
 * the Reveal — any `records:broken` for the just-closed day has already fired
 * by the time the feed is assembled. Month marks settle on `clock:month_ended`,
 * which fires later in the overnight sequence, after the day has settled.
 */

/** The six tracked high-water marks. */
export type RecordKind =
  /** Highest single-day total gross (front + back). */
  | 'bestDayGross'
  /** Highest calendar-month total gross. */
  | 'bestMonthGross'
  /** Best per-vehicle-retail — day gross ÷ units — over a day. */
  | 'bestPvr'
  /** Longest run of consecutive selling days. */
  | 'bestStreak'
  /** Fattest individual deal, measured on front gross. */
  | 'bestSingleDeal'
  /** Highest unit count closed in one day. */
  | 'mostUnitsInDay';

export const RECORD_KINDS: readonly RecordKind[] = [
  'bestDayGross',
  'bestMonthGross',
  'bestPvr',
  'bestStreak',
  'bestSingleDeal',
  'mostUnitsInDay',
];

/** A set mark: the value, and the in-game day it was set on. */
export interface RecordMark {
  readonly value: number;
  readonly day: number;
}

export type RecordMarks = { readonly [K in RecordKind]: RecordMark | null };

export interface RecordsConfig {
  /**
   * Minimum units in a day before its PVR can crown. A one-unit day's PVR is
   * just that deal's gross — already covered by `bestSingleDeal` — so PVR
   * earns its own crown only once it means what it means in the business:
   * volume held at gross.
   */
  readonly pvrMinUnits: number;
}

/** Save/load blob. Self-versioned per the #188 snapshot contract. */
export interface RecordsSnapshot {
  readonly schemaVersion: 1;
  readonly marks: RecordMarks;
  /** Day cursor for `deal:closed`, which carries no day of its own. */
  readonly currentDay: number;
  /** In-progress day accumulators — so a mid-day reload keeps the day's haul. */
  readonly dayGross: number;
  readonly dayUnits: number;
  /** In-progress month accumulator + the running 1-based month index. */
  readonly monthGross: number;
  readonly monthIndex: number;
  /** Live selling-day streak (not the best one — that's a mark). */
  readonly currentStreak: number;
}

export interface RecordsDeps {
  bus: EventBus;
  config?: RecordsConfig;
}

export interface Records {
  getMark(kind: RecordKind): RecordMark | null;
  getMarks(): RecordMarks;
  /** Live run of consecutive selling days (the mark is `bestStreak`). */
  readonly currentStreak: number;
  /**
   * The haul of the day the clock is sitting on: `{ gross, units }`. Live while
   * the floor is open, and it holds the closed day's final figure through the
   * day-close window (it clears on `clock:day_started`, not at day-complete), so
   * the recap and the Reveal read the day total from here. Records is the
   * game-side source of truth for it — persisted and replay-safe.
   */
  getDayTotals(): { gross: number; units: number };
  snapshot(): RecordsSnapshot;
  restore(snap: RecordsSnapshot): void;
}

function emptyMarks(): { [K in RecordKind]: RecordMark | null } {
  return {
    bestDayGross: null,
    bestMonthGross: null,
    bestPvr: null,
    bestStreak: null,
    bestSingleDeal: null,
    mostUnitsInDay: null,
  };
}

export function createRecords(deps: RecordsDeps): Records {
  const { bus } = deps;
  const config = deps.config ?? loadTunables().records;

  const marks = emptyMarks();
  let currentDay = 1;
  let dayGross = 0;
  let dayUnits = 0;
  let monthGross = 0;
  let monthIndex = 1;
  let currentStreak = 0;

  /**
   * Set `kind` to `value` and announce it, if and only if `value` strictly
   * beats the standing mark. Matching a record does not break it. A
   * non-positive value never crowns — an empty day is not an achievement.
   *
   * The first time a mark is set there is nothing to beat, so it still fires
   * but with `previousValue: null`. That distinction is deliberate: the engine
   * reports the truth (this IS your best day), and the *presentation* decides
   * whether a first-ever mark deserves a crown on the feed (#330).
   */
  function tryBreak(
    kind: RecordKind,
    value: number,
    day: number,
    context?: Partial<EventMap['records:broken']>,
  ): void {
    if (value <= 0) return;
    const prior = marks[kind];
    if (prior !== null && value <= prior.value) return;
    marks[kind] = { value, day };
    bus.publish('records:broken', {
      day,
      kind,
      value,
      previousValue: prior === null ? null : prior.value,
      ...context,
    });
  }

  bus.subscribe('clock:day_started', (p: EventMap['clock:day_started']) => {
    currentDay = p.day;
    // The day accumulators belong to the day the clock is sitting on, and the
    // clock does not move off a day at `floor:day_complete` — it moves here, on
    // the Next Day transition. Resetting here (rather than at day-close) is what
    // lets the day-close consumers — the recap and the Reveal (#331) — read the
    // just-closed day's haul straight off `getDayTotals()` instead of keeping a
    // parallel unpersisted tally. A reload in either window restores the totals
    // the player last saw: mid-day, the running haul; after close, the closed
    // day's final figure.
    dayGross = 0;
    dayUnits = 0;
  });

  bus.subscribe('deal:closed', (p: EventMap['deal:closed']) => {
    const gross = p.frontGross + p.backGross;
    dayGross += gross;
    dayUnits += 1;
    monthGross += gross;
    // The fattest-deal mark is a FRONT-gross mark: it's the desk's win on the
    // car itself, not the F&I box that rode along behind it.
    tryBreak('bestSingleDeal', p.frontGross, currentDay, {
      vehicleId: p.vehicleId,
      customerId: p.customerId,
    });
  });

  bus.subscribe('floor:day_complete', (p: EventMap['floor:day_complete']) => {
    const { day } = p;
    tryBreak('bestDayGross', dayGross, day);
    tryBreak('mostUnitsInDay', dayUnits, day);
    if (dayUnits >= config.pvrMinUnits) {
      tryBreak('bestPvr', dayGross / dayUnits, day);
    }
    // A selling day is one that closed at least one unit — the streak tracks
    // floor momentum. Whether the day was *profitable* is the separate
    // `bestDayGross` axis, so the two marks stay independent rather than one
    // shadowing the other.
    currentStreak = dayUnits >= 1 ? currentStreak + 1 : 0;
    tryBreak('bestStreak', currentStreak, day);
    // The day accumulators are deliberately NOT cleared here — they hold the
    // closed day's final figure until the clock moves (`clock:day_started`), so
    // the day-close recap + Reveal read it from `getDayTotals()`.
  });

  bus.subscribe('clock:month_ended', (p: EventMap['clock:month_ended']) => {
    tryBreak('bestMonthGross', monthGross, p.day, { month: monthIndex });
    monthGross = 0;
    monthIndex += 1;
  });

  return {
    getMark(kind) {
      return marks[kind];
    },
    getMarks() {
      return { ...marks };
    },
    get currentStreak() {
      return currentStreak;
    },
    getDayTotals() {
      return { gross: dayGross, units: dayUnits };
    },
    snapshot() {
      return {
        schemaVersion: 1,
        marks: { ...marks },
        currentDay,
        dayGross,
        dayUnits,
        monthGross,
        monthIndex,
        currentStreak,
      };
    },
    restore(snap) {
      for (const kind of RECORD_KINDS) {
        const mark = snap.marks[kind];
        marks[kind] = mark === null ? null : { ...mark };
      }
      currentDay = snap.currentDay;
      dayGross = snap.dayGross;
      dayUnits = snap.dayUnits;
      monthGross = snap.monthGross;
      monthIndex = snap.monthIndex;
      currentStreak = snap.currentStreak;
    },
  };
}

/** Behavior-neutral default for migrating pre-#329 saves (no marks set). */
export function createDefaultRecordsSnapshot(): RecordsSnapshot {
  return {
    schemaVersion: 1,
    marks: emptyMarks(),
    currentDay: 1,
    dayGross: 0,
    dayUnits: 0,
    monthGross: 0,
    monthIndex: 1,
    currentStreak: 0,
  };
}
