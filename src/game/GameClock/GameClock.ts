import type { EventBus } from '../EventBus';

export type Season = 'spring' | 'summer' | 'fall' | 'winter';

export interface GameClock {
  readonly currentDay: number;
  readonly dayOfWeek: number; // 0 = Monday … 6 = Sunday
  readonly currentSeason: Season;
  advanceDay(): void;
}

// Overnight phase event order — consumed by subscribers in deterministic sequence:
//   clock:day_ended → clock:overnight_payroll → clock:overnight_inventory_arrival
//   → clock:overnight_reputation_drift → clock:day_started
const OVERNIGHT_PHASES = [
  'clock:overnight_payroll',
  'clock:overnight_inventory_arrival',
  'clock:overnight_reputation_drift',
] as const;

const DAYS_PER_WEEK = 7;
const DAYS_PER_SEASON = 91; // 13 weeks × 7 days
const DAYS_PER_YEAR = 364;  // 4 seasons × 91 days

function computeSeason(day: number): Season {
  const dayInYear = ((day - 1) % DAYS_PER_YEAR) + 1;
  if (dayInYear <= 91) return 'spring';
  if (dayInYear <= 182) return 'summer';
  if (dayInYear <= 273) return 'fall';
  return 'winter';
}

function computeDayOfWeek(day: number): number {
  return (day - 1) % DAYS_PER_WEEK;
}

export function createGameClock(deps: {
  bus: EventBus;
  initialDay?: number;
}): GameClock {
  const { bus } = deps;
  let day = deps.initialDay ?? 1;

  return {
    get currentDay() { return day; },
    get dayOfWeek() { return computeDayOfWeek(day); },
    get currentSeason() { return computeSeason(day); },

    advanceDay() {
      const endingDay = day;
      bus.publish('clock:day_ended', { day: endingDay });
      for (const phase of OVERNIGHT_PHASES) {
        bus.publish(phase, { day: endingDay });
      }
      day += 1;
      bus.publish('clock:day_started', { day });
    },
  };
}

export { DAYS_PER_WEEK, DAYS_PER_SEASON, DAYS_PER_YEAR };
