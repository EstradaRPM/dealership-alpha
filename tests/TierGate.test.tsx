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
    facility: { kind: 'stepped', label: 'Facility Build-Out' },
  },
  // 10-day month for compact tests. T1 lights units+cash; T2 adds gross; T3
  // adds csi + facility (the shipped ladder's shape — #360 lit the last face).
  tiers: {
    '1': { units: 10, cash: 50000 },
    '2': { units: 20, gross: 40000, cash: 100000 },
    '3': { units: 30, gross: 80000, cash: 400000, csi: 75, facility: 50 },
  },
};

const DAYS_PER_MONTH = 10;

interface Harness {
  bus: EventBus;
  gate: TierGate;
  day: number;
  cash: number;
  csi: number;
  /** The #360 facility build-out score, 0–100 — a live read, never sampled. */
  facility: number;
  setDay: (d: number) => void;
  closeDeal: (front: number, back: number) => void;
  /** Fire the nightly day_ended sample + (when on a month boundary) the verdict. */
  endDay: () => void;
}

function makeHarness(
  opts: { tier?: number; startCash?: number; startCsi?: number; startFacility?: number } = {},
): Harness {
  const bus = createEventBus();
  const state = {
    day: 1,
    tier: opts.tier ?? 1,
    cash: opts.startCash ?? 50000,
    csi: opts.startCsi ?? 70,
    facility: opts.startFacility ?? 34,
  };
  const gate = createTierGate({
    bus,
    getCurrentDay: () => state.day,
    getCurrentTier: () => state.tier,
    signals: {
      cash: () => state.cash,
      csi: () => state.csi,
      facility: () => state.facility,
    },
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
      productGross: back,
      reserveGross: 0,
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
    get facility() { return state.facility; },
    set facility(v: number) { state.facility = v; },
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
    expect(t3.faces.map((f) => f.id).sort()).toEqual([
      'cash',
      'csi',
      'facility',
      'gross',
      'units',
    ]);
  });

  it('tiers without a facility target show no facility face', () => {
    // #360 lit the stepped face, and the unlock rule is unchanged: a face
    // appears only where its tier states a target for it. T1/T2 state none.
    for (const tier of [1, 2]) {
      const p = makeHarness({ tier }).gate.getProgress();
      expect(p.faces.some((f) => f.id === 'facility')).toBe(false);
    }
  });
});

describe('#360 TierGate — the facility face grades off the live score', () => {
  it('grades the facility face from the live facility score', () => {
    const h = makeHarness({ tier: 3, startFacility: 34 });
    const face = h.gate.getProgress().faces.find((f) => f.id === 'facility');
    if (face?.kind !== 'stepped') throw new Error('expected stepped');
    expect(face.label).toBe('Facility Build-Out');
    expect(face.score).toBe(34);
    expect(face.threshold).toBe(50);
    expect(face.meetsThreshold).toBe(false);

    // Build something: the face steps, with no sampling in between.
    h.facility = 60;
    const cleared = h.gate.getProgress().faces.find((f) => f.id === 'facility');
    if (cleared?.kind !== 'stepped') throw new Error('expected stepped');
    expect(cleared.score).toBe(60);
    expect(cleared.meetsThreshold).toBe(true);
  });

  it('bands the month on the facility score standing at month-end', () => {
    // A month where every other face clears and the facility face does not:
    // the gate is multi-dimensional, so the building is what grades the month.
    const verdicts: GateMonthVerdict[] = [];
    const h = makeHarness({ tier: 3, startCash: 500000, startCsi: 80, startFacility: 20 });
    h.bus.subscribe('tierGate:month_verdict', (v) => verdicts.push(v));
    for (let i = 0; i < 30; i++) h.closeDeal(2000, 1000);
    for (let d = 0; d < DAYS_PER_MONTH; d++) h.endDay();

    const verdict = verdicts[0];
    const facility = verdict.faces.find((f) => f.id === 'facility');
    expect(facility).toBeDefined();
    // 20 against a bar of 50 ⇒ ratio 0.4 ⇒ miss, and the worst face grades.
    expect(facility?.ratio).toBeCloseTo(20 / 50);
    expect(facility?.band).toBe('miss');
    expect(verdict.overall).toBe('miss');
  });

  it("shows the facility bar in the tier's standing requirements", () => {
    // The Growth board foreshadows off this. Now that the gate grades the
    // face, hiding it here would understate what the climb actually costs.
    const reqs = makeHarness().gate.getTierRequirements(3);
    const facility = reqs?.faces.find((f) => f.id === 'facility');
    expect(facility).toEqual({
      id: 'facility',
      label: 'Facility Build-Out',
      kind: 'stepped',
      target: 50,
    });
  });

  it('keeps the stepped face out of the persisted month state', () => {
    // Nothing to sample and nothing to average: the score stands where the
    // buildings stand, so a restore reads it live off the provider.
    const h = makeHarness({ tier: 3, startFacility: 34 });
    h.endDay();
    expect(h.gate.snapshot().levelSamples.facility).toBeUndefined();
    expect(h.gate.snapshot().trendSamples.facility).toBeUndefined();
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

  // #351: the verdict event fires once and `resetMonth` erases what produced
  // it, so nothing else in the world could reconstruct how a past month graded.
  // Finance's month-close results read this history.
  it('retains every closed month, oldest-first, after the accruals are gone', () => {
    const h = makeHarness({ tier: 1 });
    expect(h.gate.getMonthVerdicts()).toEqual([]);

    runMonth(h, 10, 50000); // month 1 — meets
    runMonth(h, 2, 10000); // month 2 — misses

    const history = h.gate.getMonthVerdicts();
    expect(history.map((v) => v.month)).toEqual([1, 2]);
    expect(history[0].overall).toBe('meet');
    expect(history[1].overall).toBe('miss');
    // The grade survives the reset that wiped the accruals behind it.
    const units = h.gate.getProgress().faces.find((f) => f.id === 'units');
    if (units?.kind !== 'flow') throw new Error('expected flow');
    expect(units.current).toBe(0);
  });

  it('round-trips the verdict history through snapshot/restore', () => {
    const a = makeHarness({ tier: 1 });
    runMonth(a, 10, 50000);

    const b = makeHarness({ tier: 1 });
    b.gate.restore(a.gate.snapshot());
    expect(b.gate.getMonthVerdicts()).toEqual(a.gate.getMonthVerdicts());
  });

  it('starts a pre-#351 save with an empty history rather than inventing grades', () => {
    const h = makeHarness({ tier: 1 });
    h.gate.restore({
      schemaVersion: 1,
      flowAccrual: { units: 3 },
      levelSamples: {},
      trendSamples: {},
    });
    expect(h.gate.getMonthVerdicts()).toEqual([]);
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

describe('#360 S3b — the facility face on the gate strip', () => {
  function stepped() {
    const strip = buildGateStrip(
      makeHarness({ tier: 3, startFacility: 34 }).gate.getProgress(),
    );
    const face = strip.faces.find((f) => f.id === 'facility');
    if (face?.kind !== 'stepped') throw new Error('expected stepped');
    return face;
  }

  it('renders the facility face with value and threshold', () => {
    const face = stepped();
    expect(face.label).toBe('Facility Build-Out');
    expect(face.valueLabel).toBe('34% built');
    expect(face.thresholdLabel).toBe('vs 50%');
    // Distance to the bar, the same reading the cash gauge gives.
    expect(face.fill).toBeCloseTo(34 / 50);
    expect(face.meets).toBe(false);

    const model = buildHomeDashboard({
      ...INPUTS,
      gate: buildGateStrip(
        makeHarness({ tier: 3, startFacility: 34 }).gate.getProgress(),
      ),
    });
    const { getByText, getByTestId } = render(
      <HomeTab state={MANAGERIAL} dashboard={model} onOpenOperations={jest.fn()} />,
    );
    expect(getByTestId('gate-face-facility')).toBeTruthy();
    expect(getByText('Facility Build-Out')).toBeTruthy();
    expect(getByText('34% built vs 50%')).toBeTruthy();
  });

  it('counts the facility face in the binding "% on track" figure', () => {
    // The gate is multi-dimensional and the worst face is the status. With
    // units, gross, cash and CSI all projecting over their bars, a store
    // sitting on 34 of a 50 facility bar cannot read as on track.
    const h = makeHarness({ tier: 3, startFacility: 34, startCash: 900000, startCsi: 90 });
    for (let i = 0; i < 3; i++) h.closeDeal(2700, 0); // day 1 ⇒ proj 30 units / $81k
    const strip = buildGateStrip(h.gate.getProgress());
    expect(strip.percentOnTrack).toBe(Math.round((34 / 50) * 100));
  });
});

describe('#250 S3b — tier-advancement streak surfaced on the gate strip', () => {
  it('renders the banked track-record line ("month X of N")', () => {
    const strip = buildGateStrip(makeHarness().gate.getProgress(), undefined, {
      current: 2,
      required: 3,
      dossierReady: false,
    });
    expect(strip.streakLabel).toBe('Track record: month 2 of 3');
  });

  it('renders the dossier-ready cue once the top-tier streak completes', () => {
    const strip = buildGateStrip(makeHarness({ tier: 3 }).gate.getProgress(), undefined, {
      current: 3,
      required: 3,
      dossierReady: true,
    });
    expect(strip.streakLabel).toBe('Track record ready — franchise courtship coming');
  });

  it('omits the streak line when no streak status is supplied', () => {
    const strip = buildGateStrip(makeHarness().gate.getProgress());
    expect(strip.streakLabel).toBeNull();
  });

  it('shows the streak line in the rendered Home gate strip', () => {
    const model = buildHomeDashboard({
      ...INPUTS,
      gate: buildGateStrip(makeHarness().gate.getProgress(), undefined, {
        current: 1,
        required: 2,
        dossierReady: false,
      }),
    });
    const { getByTestId } = render(
      <HomeTab state={MANAGERIAL} dashboard={model} onOpenOperations={jest.fn()} />,
    );
    expect(getByTestId('gate-streak-line')).toBeTruthy();
  });
});
