import React from 'react';
import * as fs from 'fs';
import * as path from 'path';
import { readAppCompositionSource } from './helpers/appComposition';
import { render } from '@testing-library/react-native';
import { createEventBus, type EventBus } from '../src/game/EventBus';
import { createTierGate, type TierGate } from '../src/game/TierGate';
import type { TierGateConfig, GateMonthVerdict } from '../src/game/TierGate';
import { HomeTab, buildHomeDashboard, buildGateStrip } from '../src/ui/HomeTab';
import type { HomeDashboardInputs } from '../src/ui/HomeTab';
import type { DayLoopState } from '../src/game/DayLoopController';

// Monthly tier-gate engine (#232). Honors goals-targets-design decisions 1–3:
// the day is counted-not-judged (daily haul accrues onto the monthly bars), the
// engine reports honest pace/projection per face in its native idiom, and a
// single 4-band verdict fires once at month-end on the gate.

const CONFIG: TierGateConfig = {
  trendWindowDays: 4,
  trendEpsilon: 0.5,
  levelTrendEpsilon: 1000,
  bands: { exceed: 1.1, meet: 1.0, nearMiss: 0.85 },
  faces: {
    units: { kind: 'flow', label: 'Retail Units' },
    gross: { kind: 'flow', label: 'Gross Profit' },
    cash: { kind: 'level', label: 'Cash on Hand' },
    csi: { kind: 'trend', label: 'CSI' },
    facility: { kind: 'stepped', label: 'Facility / Image' },
  },
  // 10-day month for compact tests. T1 lights units+cash; T2 adds gross; T3 csi.
  tiers: {
    '1': { units: 10, cash: 50000 },
    '2': { units: 20, gross: 40000, cash: 100000 },
    '3': { units: 30, gross: 80000, cash: 400000, csi: 75 },
  },
};

const DAYS_PER_MONTH = 10;

interface Harness {
  bus: EventBus;
  gate: TierGate;
  day: number;
  cash: number;
  csi: number;
  setDay: (d: number) => void;
  closeDeal: (front: number, back: number) => void;
  /** Fire the nightly day_ended sample + (when on a month boundary) the verdict. */
  endDay: () => void;
}

function makeHarness(opts: { tier?: number; startCash?: number; startCsi?: number } = {}): Harness {
  const bus = createEventBus();
  const state = {
    day: 1,
    tier: opts.tier ?? 1,
    cash: opts.startCash ?? 50000,
    csi: opts.startCsi ?? 70,
  };
  const gate = createTierGate({
    bus,
    getCurrentDay: () => state.day,
    getCurrentTier: () => state.tier,
    signals: { cash: () => state.cash, csi: () => state.csi },
    config: CONFIG,
    daysPerMonth: DAYS_PER_MONTH,
  });
  const closeDeal = (front: number, back: number) =>
    bus.publish('deal:closed', {
      customerId: 'c',
      vehicleId: 'v',
      agreedPrice: 20000,
      frontGross: front,
      backGross: back,
      daysInInventory: 5,
      paymentMethod: 'cash',
      downPayment: 0,
      loanAmount: 0,
      term: 0,
      apr: 0,
    });
  const endDay = () => {
    const ending = state.day;
    bus.publish('clock:day_ended', { day: ending });
    if (ending % DAYS_PER_MONTH === 0) {
      bus.publish('clock:month_ended', { day: ending });
    }
    state.day = ending + 1;
  };
  return {
    bus,
    gate,
    get day() { return state.day; },
    get cash() { return state.cash; },
    set cash(v: number) { state.cash = v; },
    get csi() { return state.csi; },
    set csi(v: number) { state.csi = v; },
    setDay: (d: number) => { state.day = d; },
    closeDeal,
    endDay,
  } as unknown as Harness;
}

describe('#232 TierGate — flow face pace math (decision 2: honest projection)', () => {
  it('accrues each closed deal onto the monthly bar (day counted, not judged)', () => {
    const h = makeHarness();
    h.closeDeal(2000, 500);
    h.closeDeal(1500, 500);
    const units = h.gate.getProgress().faces.find((f) => f.id === 'units');
    expect(units && units.kind === 'flow' && units.current).toBe(2);
  });

  it('reports projected landing + on-pace-rate-needed when behind', () => {
    const h = makeHarness();
    h.setDay(5); // day-of-month 5 of 10; target units = 10
    h.closeDeal(1000, 0);
    h.closeDeal(1000, 0); // 2 units by day 5
    const p = h.gate.getProgress();
    const units = p.faces.find((f) => f.id === 'units');
    expect(units?.kind).toBe('flow');
    if (units?.kind !== 'flow') throw new Error('expected flow');
    expect(units.current).toBe(2);
    // Linear projection: 2 / 5 * 10 = 4.
    expect(units.projectedLanding).toBeCloseTo(4);
    // expectedByNow = 10 * 5/10 = 5 ⇒ behind pace.
    expect(units.onPace).toBe(false);
    expect(units.expectedByNow).toBeCloseTo(5);
    // catch-up = 8 over 5 remaining days = 1.6/day.
    expect(units.toCatchUp).toBe(8);
    expect(units.onPaceRateNeeded).toBeCloseTo(8 / 5);
  });

  it('reports the cushion + projection when AHEAD of pace, never "0 needed"', () => {
    const h = makeHarness();
    h.setDay(5);
    for (let i = 0; i < 7; i++) h.closeDeal(1000, 0); // 7 units by day 5
    const units = h.gate.getProgress().faces.find((f) => f.id === 'units');
    if (units?.kind !== 'flow') throw new Error('expected flow');
    expect(units.onPace).toBe(true);
    expect(units.cushion).toBeCloseTo(7 - 5); // current − expectedByNow
    expect(units.projectedLanding).toBeCloseTo(14); // 7/5*10
    // The honest pace figure is still present (a *fact*, not "0").
    expect(units.toCatchUp).toBe(3); // target 10 − 7
  });
});

describe('#232 TierGate — progressive face unlock (decision 2: fewer lit early)', () => {
  it('lights only the active faces for the current tier', () => {
    const t1 = makeHarness({ tier: 1 }).gate.getProgress();
    expect(t1.faces.map((f) => f.id).sort()).toEqual(['cash', 'units']);

    const t3 = makeHarness({ tier: 3 }).gate.getProgress();
    expect(t3.faces.map((f) => f.id).sort()).toEqual(['cash', 'csi', 'gross', 'units']);
  });

  it('never lights the dormant stepped facility face in v1', () => {
    const p = makeHarness({ tier: 3 }).gate.getProgress();
    expect(p.faces.some((f) => f.id === 'facility')).toBe(false);
  });
});

describe('#232 TierGate — level & trend faces (decision 3: native idiom)', () => {
  it('cash level: monthly-average gauge + trend arrow, no catch-up', () => {
    const h = makeHarness({ tier: 1, startCash: 40000 });
    h.cash = 40000; h.endDay(); // sample day 1
    h.cash = 60000; h.endDay(); // sample day 2 — rises
    const cash = h.gate.getProgress().faces.find((f) => f.id === 'cash');
    if (cash?.kind !== 'level') throw new Error('expected level');
    expect(cash.avgLevel).toBeCloseTo(50000); // (40k + 60k)/2
    expect(cash.threshold).toBe(50000);
    expect(cash.trend).toBe('climbing'); // 60k − 40k(monthStart) > eps
    expect('toCatchUp' in cash).toBe(false); // a balance is not a flow
  });

  it('csi trend: rolling average + climbing/flat/sliding, not a pace', () => {
    const h = makeHarness({ tier: 3, startCsi: 70 });
    for (const v of [70, 72, 76, 80]) { h.csi = v; h.endDay(); }
    const csi = h.gate.getProgress().faces.find((f) => f.id === 'csi');
    if (csi?.kind !== 'trend') throw new Error('expected trend');
    expect(csi.rollingAvg).toBeCloseTo((70 + 72 + 76 + 80) / 4);
    expect(csi.trend).toBe('climbing'); // recent half avg > earlier half + eps
  });

  it('rolls the trend window off at trendWindowDays', () => {
    const h = makeHarness({ tier: 3, startCsi: 50 });
    // 6 samples into a window of 4 ⇒ only the last 4 survive.
    for (const v of [10, 20, 90, 92, 94, 96]) { h.csi = v; h.endDay(); }
    const csi = h.gate.getProgress().faces.find((f) => f.id === 'csi');
    if (csi?.kind !== 'trend') throw new Error('expected trend');
    expect(csi.rollingAvg).toBeCloseTo((90 + 92 + 94 + 96) / 4);
  });
});

describe('#232 TierGate — month-end 4-band verdict (decision 1: graded once)', () => {
  function runMonth(h: Harness, deals: number, cash: number, gross = 0): GateMonthVerdict {
    let verdict: GateMonthVerdict | undefined;
    h.bus.subscribe('tierGate:month_verdict', (v) => { verdict = v; });
    h.cash = cash;
    // Accrual (not timing) drives the verdict — close all deals up front so the
    // monthly total isn't capped at one-per-day, then run out the month.
    for (let i = 0; i < deals; i++) h.closeDeal(gross, 0);
    for (let d = 1; d <= DAYS_PER_MONTH; d++) h.endDay();
    if (!verdict) throw new Error('no verdict fired');
    return verdict;
  }

  it('fires exactly once on clock:month_ended with per-face bands + overall', () => {
    const h = makeHarness({ tier: 1 });
    let count = 0;
    h.bus.subscribe('tierGate:month_verdict', () => { count += 1; });
    h.cash = 50000;
    for (let d = 1; d <= DAYS_PER_MONTH; d++) { h.closeDeal(0, 0); h.endDay(); }
    expect(count).toBe(1);
  });

  it('grades each face: 10/10 units (meet) + avg-cash 50k/50k (meet) ⇒ overall meet', () => {
    const h = makeHarness({ tier: 1 });
    const v = runMonth(h, 10, 50000);
    expect(v.month).toBe(1);
    const units = v.faces.find((f) => f.id === 'units')!;
    expect(units.band).toBe('meet'); // ratio 1.0
    const cash = v.faces.find((f) => f.id === 'cash')!;
    expect(cash.band).toBe('meet'); // avg 50k / 50k
    expect(v.overall).toBe('meet');
  });

  it('overall = the WORST active face (the binding constraint grades the gate)', () => {
    const h = makeHarness({ tier: 1 });
    // 11 units (exceed) but cash far below threshold (miss) ⇒ overall miss.
    const v = runMonth(h, 11, 10000);
    expect(v.faces.find((f) => f.id === 'units')!.band).toBe('exceed');
    expect(v.faces.find((f) => f.id === 'cash')!.band).toBe('miss');
    expect(v.overall).toBe('miss');
  });

  it('resets the accruals for the new month after the verdict', () => {
    const h = makeHarness({ tier: 1 });
    runMonth(h, 8, 50000);
    const units = h.gate.getProgress().faces.find((f) => f.id === 'units');
    if (units?.kind !== 'flow') throw new Error('expected flow');
    expect(units.current).toBe(0); // fresh month
  });
});

describe('#232 TierGate — snapshot/restore round-trips the in-progress month', () => {
  it('rehydrates accruals + samples onto a fresh engine (replay/save-safe)', () => {
    const a = makeHarness({ tier: 3, startCash: 80000 });
    a.setDay(4);
    a.closeDeal(5000, 1000);
    a.closeDeal(4000, 1000); // 2 units, 11k gross
    a.cash = 90000; a.endDay(); // sample
    a.csi = 78; a.endDay();
    const snap = a.gate.snapshot();

    const b = makeHarness({ tier: 3, startCash: 90000 });
    b.setDay(a.day);
    b.csi = 78;
    b.gate.restore(snap);
    expect(b.gate.getProgress()).toEqual(a.gate.getProgress());
  });
});

// --- Anti-orphan: the engine's projections render live on the Home tab --------

const MANAGERIAL: DayLoopState = {
  phase: 'MANAGERIAL',
  day: 5,
  ownershipUnlocked: true,
  hasRecap: true,
};

// A real gate strip built off the engine's live readout — the same path App.tsx
// uses. T1 lights units (flow) + cash (level); 2 units by day-of-month 5 of 10.
function buildLiveGate() {
  const h = makeHarness({ tier: 1, startCash: 50000 });
  h.setDay(5);
  h.cash = 50000;
  h.endDay(); // one cash sample so the level gauge has an average
  h.closeDeal(1000, 0);
  h.closeDeal(1000, 0);
  return buildGateStrip(h.gate.getProgress(), { units: 1, gross: 1000 });
}

const INPUTS: HomeDashboardInputs = {
  businessName: 'Summit Motors',
  tierLabel: 'Tier 1 — Gravel Yard',
  cash: 50000,
  cashDelta: null,
  reputation: 70,
  currentDay: 5,
  season: 'spring',
  daysPerWeek: 7,
  daysPerMonth: 30,
  daysPerYear: 364,
  pendingLeads: 4,
  inventoryCount: 20,
  inService: 2,
  gate: buildLiveGate(),
};

describe('#233 S3b — gate strip reachable on the live Home dashboard', () => {
  it('threads the structured gate strip + derived stats through buildHomeDashboard', () => {
    const m = buildHomeDashboard(INPUTS);
    // units (flow) + cash (level) faces at T1.
    expect(m.gate?.faces.map((f) => f.id).sort()).toEqual(['cash', 'units']);
    // "% on track" is no longer duplicated as a quick-stat tile (#238) — it
    // lives once in the gate strip header. The gate still carries the figure.
    expect(m.stats.some((s) => s.key === 'on-track')).toBe(false);
    expect(m.gate?.percentOnTrack).not.toBeNull();
  });

  it('omits the gate block + derived stats when no gate is supplied', () => {
    const { gate, ...noGate } = INPUTS;
    void gate;
    const m = buildHomeDashboard(noGate);
    expect(m.gate).toBeUndefined();
    expect(m.stats.some((s) => s.key === 'on-track')).toBe(false);
  });

  it('flow face reports the pace readout (a fact the player reads, not a grade)', () => {
    const strip = buildLiveGate();
    const units = strip.faces.find((f) => f.id === 'units');
    if (units?.kind !== 'flow') throw new Error('expected flow');
    // 2 of 10 by day 5 ⇒ behind pace ⇒ a "need N/day" pace fact, no letter grade.
    expect(units.valueLabel).toBe('2 / 10');
    expect(units.paceLabel).toMatch(/Need .*\/day · proj/);
    expect(units.onPace).toBe(false);
  });

  it('renders the gate strip + pace readouts in the Home tab (anti-orphan)', () => {
    const model = buildHomeDashboard(INPUTS);
    const { getByText, getByTestId } = render(
      <HomeTab state={MANAGERIAL} dashboard={model} onOpenOperations={jest.fn()} />,
    );
    expect(getByTestId('home-gate-strip')).toBeTruthy();
    expect(getByText('This Month')).toBeTruthy();
    expect(getByText('2 / 10')).toBeTruthy();
    // The day's haul ticks the units bar (daily-contribution reward beat).
    expect(getByTestId('gate-today-tick-units')).toBeTruthy();
  });

  it('App.tsx builds the gate strip off the live world and feeds buildHomeDashboard', () => {
    const src = readAppCompositionSource();
    expect(src).toMatch(/buildGateStrip\(\s*world\.tierGate\.getProgress\(\)/);
    expect(src).toMatch(/gate: gateModel\.faces\.length > 0/);
  });
});
