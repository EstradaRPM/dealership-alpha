import React from 'react';
import * as fs from 'fs';
import * as path from 'path';
import { readAppCompositionSource } from './helpers/appComposition';
import { render, fireEvent } from '@testing-library/react-native';
import { HomeTab, buildHomeDashboard } from '../src/ui/HomeTab';
import type { HomeDashboardInputs } from '../src/ui/HomeTab';
import { createWeather } from '../src/game/Weather';
import type { WeatherConfig } from '../src/game/Weather';
import { seasonForDay } from '../src/game/GameClock';
import type { DayLoopState } from '../src/game/DayLoopController';

// Anti-orphan (#231 slice 1): per-day weather + an honest one-day forecast must
// be (a) deterministic from (masterSeed, day) so save/load + #122 replay can't
// desync, and (b) reachable on the live Home calendar card — not merely a
// module that renders in isolation.

// A config with season-gated conditions so the weighted draw is assertable:
// spring is always clear, winter is always snow.
const CONFIG: WeatherConfig = {
  conditions: { clear: 'Clear', snow: 'Snow' },
  seasons: {
    spring: { tempMinF: 50, tempMaxF: 70, conditionWeights: { clear: 1, snow: 0 } },
    summer: { tempMinF: 70, tempMaxF: 95, conditionWeights: { clear: 1, snow: 0 } },
    fall: { tempMinF: 40, tempMaxF: 65, conditionWeights: { clear: 1, snow: 0 } },
    winter: { tempMinF: 10, tempMaxF: 40, conditionWeights: { clear: 0, snow: 1 } },
  },
  attributeLeans: {
    bySeason: {
      spring: { economy: 0.1 },
      summer: { performance: 0.2 },
      fall: {},
      // Includes an axis the want-vector doesn't carry (ignored) and a clamp case.
      winter: { dependability: 0.3, safety: 0.5, unknownAxis: 0.9 },
    },
  },
  // S3: clear is a busy day, snow is a slow day; a value omitted (none here) ⇒ 1.
  conditionVolume: { clear: 1.2, snow: 0.6 },
  volumeOutlook: { busyMin: 1.05, slowMax: 0.9 },
  // S4: vehicle-attribute leans. Winter season + snow condition both lean
  // winterCapability so the day's lean is their sum (asserted below).
  attributeAxisLeans: {
    bySeason: {
      spring: { fuelEfficiency: 0.1 },
      summer: { openAir: 0.3 },
      fall: {},
      winter: { winterCapability: 0.15, openAir: -0.1 },
    },
    byCondition: {
      snow: { winterCapability: 0.2 },
    },
  },
};

describe('#231 Weather — deterministic per-day projection', () => {
  it('is a pure function of (masterSeed, day): a fresh instance reproduces it', () => {
    const a = createWeather({ masterSeed: 9001, config: CONFIG });
    const b = createWeather({ masterSeed: 9001, config: CONFIG });
    // Same seed ⇒ identical weather (this is what survives save/load + replay,
    // since masterSeed + day both persist and the module holds no state).
    expect(a.weatherForDay(42)).toEqual(b.weatherForDay(42));
    // A different seed generally diverges (temperature or condition).
    const c = createWeather({ masterSeed: 1234, config: CONFIG });
    expect(c.weatherForDay(42)).not.toEqual(a.weatherForDay(42));
  });

  it('draws the season band: spring is clear @ [50,70], winter is snow @ [10,40]', () => {
    const w = createWeather({ masterSeed: 7, config: CONFIG });

    const spring = w.weatherForDay(1); // day-in-year 1 ⇒ spring
    expect(spring.season).toBe<'spring'>('spring');
    expect(spring.conditionId).toBe('clear');
    expect(spring.conditionLabel).toBe('Clear');
    expect(spring.temperatureF).toBeGreaterThanOrEqual(50);
    expect(spring.temperatureF).toBeLessThanOrEqual(70);

    const winter = w.weatherForDay(300); // day-in-year 300 ⇒ winter
    expect(winter.season).toBe<'winter'>('winter');
    expect(winter.conditionId).toBe('snow');
    expect(winter.temperatureF).toBeGreaterThanOrEqual(10);
    expect(winter.temperatureF).toBeLessThanOrEqual(40);
  });

  it('loads the bundled tunables.weather config and stays in-band/in-catalog', () => {
    const w = createWeather({ masterSeed: 55 });
    for (const day of [1, 95, 200, 300, 400]) {
      const d = w.weatherForDay(day);
      expect(d.season).toBe(seasonForDay(day));
      expect(Number.isFinite(d.temperatureF)).toBe(true);
      expect(d.conditionLabel.length).toBeGreaterThan(0);
    }
  });
});

describe('#231 S2 Weather — season demand lean over the want-vector', () => {
  const w = createWeather({ masterSeed: 7, config: CONFIG });

  it('exposes the season lean for a day (day 300 ⇒ winter leans)', () => {
    expect(seasonForDay(300)).toBe('winter');
    expect(w.wantLeanForDay(300)).toEqual({
      dependability: 0.3,
      safety: 0.5,
      unknownAxis: 0.9,
    });
  });

  it('leans the want-vector additively, clamps to [0,1], ignores unknown axes', () => {
    const want = {
      safety: 0.6,
      performance: 0.5,
      appearance: 0.5,
      comfort: 0.5,
      economy: 0.5,
      dependability: 0.5,
    };
    const leaned = w.leanWantVector(want, 300); // winter
    expect(leaned.dependability).toBeCloseTo(0.8); // 0.5 + 0.3
    expect(leaned.safety).toBe(1); // 0.6 + 0.5 → clamped to 1
    expect(leaned.performance).toBe(0.5); // untouched
    expect('unknownAxis' in leaned).toBe(false); // not carried by the want-vector
    expect(want.dependability).toBe(0.5); // input not mutated
  });

  it('is identity-shaped for a season with no positive lean on an axis', () => {
    const want = { economy: 0.4, performance: 0.4 };
    const leaned = w.leanWantVector(want, 1); // spring: economy +0.1
    expect(leaned.economy).toBeCloseTo(0.5);
    expect(leaned.performance).toBe(0.4);
  });

  it('is deterministic: a fresh instance with the same seed leans identically', () => {
    const b = createWeather({ masterSeed: 7, config: CONFIG });
    const want = { dependability: 0.2, safety: 0.2 };
    expect(w.leanWantVector(want, 300)).toEqual(b.leanWantVector({ ...want }, 300));
  });
});

describe('#231 S3 Weather — daily weather → traffic volume', () => {
  const w = createWeather({ masterSeed: 7, config: CONFIG });

  it('maps the day condition to a volume multiplier (clear↑ day 1, snow↓ day 300)', () => {
    // day 1 ⇒ spring ⇒ clear (busy), day 300 ⇒ winter ⇒ snow (slow).
    expect(w.weatherForDay(1).conditionId).toBe('clear');
    expect(w.volumeMultiplierForDay(1)).toBe(1.2);
    expect(w.weatherForDay(300).conditionId).toBe('snow');
    expect(w.volumeMultiplierForDay(300)).toBe(0.6);
  });

  it('bands the multiplier into a learnable traffic outlook', () => {
    expect(w.trafficOutlookForDay(1)).toBe('busy'); // 1.2 ≥ busyMin 1.05
    expect(w.trafficOutlookForDay(300)).toBe('slow'); // 0.6 ≤ slowMax 0.9
  });

  it('defaults an unmapped condition to a neutral (1) steady multiplier', () => {
    // A config whose drawn condition has no conditionVolume entry ⇒ 1 ⇒ steady.
    const bare = createWeather({
      masterSeed: 7,
      config: {
        ...CONFIG,
        conditionVolume: {},
        volumeOutlook: { busyMin: 1.05, slowMax: 0.9 },
      },
    });
    expect(bare.volumeMultiplierForDay(1)).toBe(1);
    expect(bare.trafficOutlookForDay(1)).toBe('steady');
  });

  it('is deterministic: a fresh instance with the same seed yields the same volume', () => {
    const b = createWeather({ masterSeed: 7, config: CONFIG });
    expect(b.volumeMultiplierForDay(1)).toBe(w.volumeMultiplierForDay(1));
    expect(b.trafficOutlookForDay(300)).toBe(w.trafficOutlookForDay(300));
  });
});

describe('#231 S4 Weather — vehicle-attribute demand lean', () => {
  const w = createWeather({ masterSeed: 7, config: CONFIG });

  it('sums the season + daily-condition lean per axis (day 300 ⇒ winter + snow)', () => {
    // winter season: winterCapability +0.15, openAir −0.1; snow condition adds
    // winterCapability +0.2 ⇒ winterCapability 0.35, openAir −0.1.
    expect(w.weatherForDay(300).conditionId).toBe('snow');
    expect(w.attributeLeanForDay(300)).toEqual({
      winterCapability: 0.35,
      openAir: -0.1,
    });
  });

  it('is season-only when the day condition carries no lean (day 1 ⇒ spring, clear)', () => {
    expect(w.weatherForDay(1).conditionId).toBe('clear'); // no byCondition entry
    expect(w.attributeLeanForDay(1)).toEqual({ fuelEfficiency: 0.1 });
  });

  it('is deterministic: a fresh instance with the same seed leans identically', () => {
    const b = createWeather({ masterSeed: 7, config: CONFIG });
    expect(b.attributeLeanForDay(300)).toEqual(w.attributeLeanForDay(300));
  });
});

const MANAGERIAL: DayLoopState = {
  phase: 'MANAGERIAL',
  day: 42,
  ownershipUnlocked: true,
  hasRecap: true,
};

const INPUTS: HomeDashboardInputs = {
  businessName: 'Summit Motors',
  tierLabel: 'Tier 2 — Paved Lot',
  storeWorth: { cash: 1_000_000, stockValue: 0, total: 1_000_000 },
  cashDelta: null,
  reputation: 80,
  currentDay: 42,
  season: 'spring',
  daysPerWeek: 7,
  daysPerMonth: 30,
  daysPerYear: 364,
  pendingLeads: 4,
  inventoryCount: 20,
  inService: 2,
  weather: {
    temperatureF: 72,
    conditionLabel: 'Clear',
    forecastTemperatureF: 65,
    forecastConditionLabel: 'Rain',
    seasonLean: ['dependability', 'safety'],
  },
};

describe('#231 Weather — reachable on the live Home calendar', () => {
  it('formats the weather line + an honest one-day forecast + the season lean', () => {
    const m = buildHomeDashboard(INPUTS);
    expect(m.calendar.weather).toEqual({
      todayLabel: '72° · Clear',
      forecastLabel: 'Tomorrow: 65° · Rain',
      // #231 S2: axis ids mapped to player-friendly labels, lean order preserved.
      seasonLeanLabel: 'Season favors: Reliability, Safety',
    });
  });

  it('omits the season-lean label when no lean axes are supplied', () => {
    const { seasonLean, ...rest } = INPUTS.weather!;
    void seasonLean;
    const m = buildHomeDashboard({ ...INPUTS, weather: rest });
    expect(m.calendar.weather?.seasonLeanLabel).toBeUndefined();
  });

  it('omits the weather block when no weather input is supplied', () => {
    const { weather, ...noWeather } = INPUTS;
    void weather;
    expect(buildHomeDashboard(noWeather).calendar.weather).toBeUndefined();
  });

  it('renders the weather line in the Home tab', () => {
    const model = buildHomeDashboard(INPUTS);
    const { getByText, getByTestId } = render(
      <HomeTab state={MANAGERIAL} dashboard={model} onOpenOperations={jest.fn()} />,
    );
    // Today's label is visible in the collapsed weather chip (#256).
    expect(getByText('72° · Clear')).toBeTruthy();
    // Forecast + season lean are in the expanded section — tap to open.
    fireEvent.press(getByTestId('home-calendar-toggle'));
    expect(getByText('Tomorrow: 65° · Rain')).toBeTruthy();
    // #231 S2: the season demand lean is reachable on the live Home card.
    expect(getByText('Season favors: Reliability, Safety')).toBeTruthy();
  });

  it('App.tsx builds today + forecast off the live world and feeds buildHomeDashboard', () => {
    const src = readAppCompositionSource();
    expect(src).toMatch(/world\.weather\.weatherForDay\(world\.clock\.currentDay\)/);
    expect(src).toMatch(/world\.weather\.weatherForDay\(world\.clock\.currentDay \+ 1\)/);
    expect(src).toMatch(/forecastTemperatureF: forecastWeather\.temperatureF/);
  });

  it('createWorld constructs the Weather module and exposes it on the World', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'createWorld.ts'), 'utf8');
    expect(src).toMatch(/createWeather\(\{ masterSeed \}\)/);
    expect(src).toMatch(/weather: Weather;/);
  });

  it('App.tsx derives the season lean off the live world and feeds it in', () => {
    const src = readAppCompositionSource();
    expect(src).toMatch(/world\.weather\.wantLeanForDay\(world\.clock\.currentDay\)/);
    expect(src).toMatch(/seasonLean,/);
  });

  it('createWorld wires the season lean into the live StaffDispatch match path', () => {
    // #231 S2 anti-orphan: the lean must bias the *resolution* want-vector, not
    // just render — the auto-resolve drain runs the match through it.
    const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'createWorld.ts'), 'utf8');
    expect(src).toMatch(/wantVectorBias: \(spaced, day\) => weather\.leanWantVector\(spaced, day\)/);
  });

  // ── #231 S3: daily weather → traffic volume ─────────────────────────────────
  const S3_INPUTS: HomeDashboardInputs = {
    ...INPUTS,
    weather: { ...INPUTS.weather!, trafficOutlook: 'busy', forecastTrafficOutlook: 'slow' },
  };

  it('appends the daily traffic outlook to the today + forecast lines', () => {
    const m = buildHomeDashboard(S3_INPUTS);
    expect(m.calendar.weather?.todayLabel).toBe('72° · Clear · High traffic');
    expect(m.calendar.weather?.forecastLabel).toBe('Tomorrow: 65° · Rain · Low traffic');
  });

  it('omits the outlook suffix when no outlook is supplied (back-compat)', () => {
    // The shared INPUTS carries no outlook ⇒ the S1/S2 labels are unchanged.
    const m = buildHomeDashboard(INPUTS);
    expect(m.calendar.weather?.todayLabel).toBe('72° · Clear');
    expect(m.calendar.weather?.forecastLabel).toBe('Tomorrow: 65° · Rain');
  });

  it('renders the traffic outlook on the live Home tab', () => {
    const model = buildHomeDashboard(S3_INPUTS);
    const { getByText, getByTestId } = render(
      <HomeTab state={MANAGERIAL} dashboard={model} onOpenOperations={jest.fn()} />,
    );
    // Today's label (with outlook) is visible in the collapsed chip (#256).
    expect(getByText('72° · Clear · High traffic')).toBeTruthy();
    // Forecast is in the expanded section — tap to open.
    fireEvent.press(getByTestId('home-calendar-toggle'));
    expect(getByText('Tomorrow: 65° · Rain · Low traffic')).toBeTruthy();
  });

  it('App.tsx feeds today + tomorrow traffic outlook off the live world', () => {
    const src = readAppCompositionSource();
    expect(src).toMatch(
      /trafficOutlook: world\.weather\.trafficOutlookForDay\(world\.clock\.currentDay\)/,
    );
    expect(src).toMatch(/forecastTrafficOutlook: world\.weather\.trafficOutlookForDay\(/);
  });

  it('createWorld rides the daily volume multiplier on the demand trafficMultiplier', () => {
    // #231 S3 anti-orphan: weather must actually move VOLUME, not just render —
    // the volume multiplier composes onto the demand-factor traffic multiplier.
    const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'createWorld.ts'), 'utf8');
    expect(src).toMatch(/weather\.volumeMultiplierForDay\(ctx\.day\)/);
  });

  // ── #231 S4: vehicle-attribute demand lean ──────────────────────────────────
  const S4_INPUTS: HomeDashboardInputs = {
    ...INPUTS,
    weather: { ...INPUTS.weather!, weatherLean: ['winterCapability', 'fuelEfficiency'] },
  };

  it('formats the attribute lean as a "Weather favors:" line, axis ids → labels', () => {
    const m = buildHomeDashboard(S4_INPUTS);
    expect(m.calendar.weather?.weatherLeanLabel).toBe('Weather favors: AWD / 4WD, Fuel economy');
  });

  it('omits the weather-lean label when no attribute lean is supplied (back-compat)', () => {
    const m = buildHomeDashboard(INPUTS);
    expect(m.calendar.weather?.weatherLeanLabel).toBeUndefined();
  });

  it('renders the attribute-lean line on the live Home tab', () => {
    const model = buildHomeDashboard(S4_INPUTS);
    const { getByText, getByTestId } = render(
      <HomeTab state={MANAGERIAL} dashboard={model} onOpenOperations={jest.fn()} />,
    );
    // Attribute lean is in the expanded section — tap to open (#256).
    fireEvent.press(getByTestId('home-calendar-toggle'));
    expect(getByText('Weather favors: AWD / 4WD, Fuel economy')).toBeTruthy();
  });

  it('App.tsx derives the attribute lean off the live world and feeds it in', () => {
    const src = readAppCompositionSource();
    expect(src).toMatch(/world\.weather\.attributeLeanForDay\(world\.clock\.currentDay\)/);
    expect(src).toMatch(/weatherLean,/);
  });

  it('createWorld wires the attribute lean into the live StaffDispatch match path', () => {
    // #231 S4 anti-orphan: the lean must tilt the *resolution* match, not just
    // render — the auto-resolve drain runs the argmax through it.
    const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'createWorld.ts'), 'utf8');
    expect(src).toMatch(/attributeLeanForDay: \(day\) => weather\.attributeLeanForDay\(day\)/);
  });
});
