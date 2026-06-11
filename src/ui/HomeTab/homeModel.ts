import type { TrendDirection } from '../kit';
import csiBands from '../../../data/csi-bands.json';

/**
 * Pure read-model builder for the Home status dashboard (#230). Lives in the UI
 * layer because every value here is a *display* derivation — formatting cash,
 * bucketing the reputation score into a label band, turning the running day
 * index into calendar labels + a mini-calendar grid. It imports no game logic:
 * the composition root hands in primitives (read off the live World) and gets
 * back a fully-formatted model the presentational `HomeTab` renders verbatim.
 *
 * Keeping it pure (numbers in → strings/grid out) makes the calendar + band math
 * unit-testable without a React tree or a built world.
 */

export type SeasonName = 'spring' | 'summer' | 'fall' | 'winter';

/** Inputs the composition root reads off the live World, no module types. */
export interface HomeDashboardInputs {
  businessName: string;
  tierLabel: string;
  cash: number;
  /** Today's cash minus yesterday's close; null on the night before Day 1. */
  cashDelta: number | null;
  reputation: number;
  currentDay: number;
  season: SeasonName;
  daysPerWeek: number;
  daysPerMonth: number;
  daysPerYear: number;
  pendingLeads: number;
  inventoryCount: number;
  inService: number;
  /** Contextual pre-open nudge that deep-links into Operations; e.g. "Lot thin on trucks". */
  inventoryNudge?: string;
  /**
   * Today's weather + an honest one-day forecast (#231). Optional so callers
   * and tests predating the weather mechanic still build a model.
   */
  weather?: {
    temperatureF: number;
    conditionLabel: string;
    forecastTemperatureF: number;
    forecastConditionLabel: string;
    /**
     * SPACED axis ids this season nudges buyer demand toward (#231 S2), highest
     * lean first. Rendered as a learnable "what's selling this season" line; the
     * effect itself is emergent through the match, this just makes it readable.
     */
    seasonLean?: string[];
  };
}

/** A single day cell in the mini-calendar grid. */
export interface MiniCalDay {
  /** Day-of-month label, 1-based. */
  dayOfMonth: number;
  /** Highlighted = today. */
  isToday: boolean;
}

export interface HomeCalendarModel {
  /** Running total — the canonical "Day N". */
  day: number;
  /** Week-of-year, 1-based. */
  week: number;
  /** Running gameplay month index (the month-gate cadence). */
  month: number;
  /** 1-4, == season. */
  quarter: number;
  seasonLabel: string;
  /** Flavor in-game date, e.g. "Spring · Week 6 · Day 12". */
  dateLabel: string;
  /** Current gameplay month laid out as a 7-wide grid, today highlighted. */
  miniCal: MiniCalDay[];
  /** Weather readout line + one-day forecast (#231); absent without input. */
  weather?: {
    todayLabel: string;
    forecastLabel: string;
    /** "Season favors: Reliability, Safety" (#231 S2); absent when no lean. */
    seasonLeanLabel?: string;
  };
}

export interface HomeStat {
  key: string;
  label: string;
  value: string;
  /** When set, the tile deep-links (e.g. inventory → Operations). */
  deepLink?: boolean;
  /** Sub-line under the value, e.g. the inventory nudge. */
  note?: string;
}

export interface HomeDashboardModel {
  businessName: string;
  tierLabel: string;
  cash: { value: string; delta?: string; trend: TrendDirection };
  reputation: { score: number; csiLabel: string };
  calendar: HomeCalendarModel;
  stats: HomeStat[];
}

const SEASON_LABELS: Record<SeasonName, string> = {
  spring: 'Spring',
  summer: 'Summer',
  fall: 'Fall',
  winter: 'Winter',
};

/** Player-friendly labels for the SPACED want-vector axes (#231 S2 readout). */
const SPACED_AXIS_LABELS: Record<string, string> = {
  safety: 'Safety',
  performance: 'Performance',
  appearance: 'Looks',
  comfort: 'Comfort',
  economy: 'Fuel economy',
  dependability: 'Reliability',
};

const SEASON_QUARTER: Record<SeasonName, number> = {
  spring: 1,
  summer: 2,
  fall: 3,
  winter: 4,
};

/** 0-100 → qualitative band label (data-driven, #230). */
export function csiLabel(score: number): string {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  for (const band of csiBands.bands) {
    if (clamped <= band.maxScore) return band.label;
  }
  // Bands cover through 100; the loop always returns. Defensive fallback only.
  return csiBands.bands[csiBands.bands.length - 1]?.label ?? '—';
}

function formatCash(cash: number): string {
  return `$${Math.round(cash).toLocaleString()}`;
}

function formatDelta(delta: number): string {
  const sign = delta >= 0 ? '+' : '-';
  return `${sign}$${Math.abs(Math.round(delta)).toLocaleString()} vs yesterday`;
}

export function buildHomeDashboard(input: HomeDashboardInputs): HomeDashboardModel {
  const {
    currentDay,
    daysPerWeek,
    daysPerMonth,
    daysPerYear,
    season,
  } = input;

  // Calendar derivations off the 4×91 game year (GameClock canon). All display
  // only — none of these drive game logic.
  const dayInYear = ((currentDay - 1) % daysPerYear) + 1;
  const week = Math.floor((dayInYear - 1) / daysPerWeek) + 1;
  const month = Math.floor((currentDay - 1) / daysPerMonth) + 1;
  const dayOfMonth = ((currentDay - 1) % daysPerMonth) + 1;
  const quarter = SEASON_QUARTER[season];
  const seasonLabel = SEASON_LABELS[season];

  const miniCal: MiniCalDay[] = Array.from({ length: daysPerMonth }, (_, i) => ({
    dayOfMonth: i + 1,
    isToday: i + 1 === dayOfMonth,
  }));

  const leanLabels = (input.weather?.seasonLean ?? [])
    .map((axis) => SPACED_AXIS_LABELS[axis] ?? axis)
    .filter((label) => label.length > 0);
  const weather = input.weather
    ? {
        todayLabel: `${input.weather.temperatureF}° · ${input.weather.conditionLabel}`,
        forecastLabel: `Tomorrow: ${input.weather.forecastTemperatureF}° · ${input.weather.forecastConditionLabel}`,
        seasonLeanLabel:
          leanLabels.length > 0 ? `Season favors: ${leanLabels.join(', ')}` : undefined,
      }
    : undefined;

  const stats: HomeStat[] = [
    { key: 'leads', label: 'Pending Leads', value: `${input.pendingLeads}` },
    {
      key: 'inventory',
      label: 'Inventory',
      value: `${input.inventoryCount}`,
      deepLink: true,
      note: input.inventoryNudge,
    },
    { key: 'service', label: 'In Service', value: `${input.inService}` },
  ];

  const trend: TrendDirection =
    input.cashDelta == null || input.cashDelta === 0
      ? 'flat'
      : input.cashDelta > 0
        ? 'up'
        : 'down';

  return {
    businessName: input.businessName,
    tierLabel: input.tierLabel,
    cash: {
      value: formatCash(input.cash),
      delta: input.cashDelta == null ? undefined : formatDelta(input.cashDelta),
      trend,
    },
    reputation: {
      score: Math.round(input.reputation),
      csiLabel: csiLabel(input.reputation),
    },
    calendar: {
      day: currentDay,
      week,
      month,
      quarter,
      seasonLabel,
      dateLabel: `${seasonLabel} · Week ${week} · Day ${dayOfMonth}`,
      miniCal,
      weather,
    },
    stats,
  };
}
