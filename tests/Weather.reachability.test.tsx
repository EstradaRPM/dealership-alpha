import React from 'react';
import * as fs from 'fs';
import * as path from 'path';
import { render } from '@testing-library/react-native';
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

const MANAGERIAL: DayLoopState = {
  phase: 'MANAGERIAL',
  day: 42,
  ownershipUnlocked: true,
  hasRecap: true,
};

const INPUTS: HomeDashboardInputs = {
  businessName: 'Summit Motors',
  tierLabel: 'Tier 2 — Paved Lot',
  cash: 1_000_000,
  cashDelta: 0,
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
  },
};

describe('#231 Weather — reachable on the live Home calendar', () => {
  it('formats the weather line + an honest one-day forecast', () => {
    const m = buildHomeDashboard(INPUTS);
    expect(m.calendar.weather).toEqual({
      todayLabel: '72° · Clear',
      forecastLabel: 'Tomorrow: 65° · Rain',
    });
  });

  it('omits the weather block when no weather input is supplied', () => {
    const { weather, ...noWeather } = INPUTS;
    void weather;
    expect(buildHomeDashboard(noWeather).calendar.weather).toBeUndefined();
  });

  it('renders the weather line in the Home tab', () => {
    const model = buildHomeDashboard(INPUTS);
    const { getByText } = render(
      <HomeTab state={MANAGERIAL} dashboard={model} onOpenOperations={jest.fn()} />,
    );
    expect(getByText('72° · Clear')).toBeTruthy();
    expect(getByText('Tomorrow: 65° · Rain')).toBeTruthy();
  });

  it('App.tsx builds today + forecast off the live world and feeds buildHomeDashboard', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'App.tsx'), 'utf8');
    expect(src).toMatch(/world\.weather\.weatherForDay\(world\.clock\.currentDay\)/);
    expect(src).toMatch(/world\.weather\.weatherForDay\(world\.clock\.currentDay \+ 1\)/);
    expect(src).toMatch(/forecastTemperatureF: forecastWeather\.temperatureF/);
  });

  it('createWorld constructs the Weather module and exposes it on the World', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'createWorld.ts'), 'utf8');
    expect(src).toMatch(/createWeather\(\{ masterSeed \}\)/);
    expect(src).toMatch(/weather: Weather;/);
  });
});
