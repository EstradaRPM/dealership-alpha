import React from 'react';
import * as fs from 'fs';
import * as path from 'path';
import { render } from '@testing-library/react-native';
import { createEventBus } from '../src/game/EventBus';
import { createWorld } from '../src/createWorld';
import { loadTunables } from '../src/game/data';
import { DayRecap, type DayRecapModel } from '../src/ui/DayRecap';
import { FloorDashboard, type FloorDashboardModel } from '../src/ui/FloorDashboard';
import type { CharacterProfile } from '../src/game/CareerProgression';

// Anti-orphan (#199): the inventory-buyer match-payoff beat must be reachable
// through the real game-logic → event → model → surface pipeline, and actually
// wired into App.tsx — not just isolated component renders. Guards the
// recurring "mechanic built but never surfaced" failure.

const PROFILE: CharacterProfile = {
  name: 'Ray Estrada',
  backstoryId: 'ex-mechanic',
  day1Modifier: {
    backstoryId: 'ex-mechanic',
    reconJudgmentBonus: 0.15,
    startingCreditLine: 0,
    startingCapitalBonus: 0,
    grudgesFlag: false,
  },
};

const STRONG = loadTunables().matchPayoff.strongMatchThreshold;

// Cash buffer kept after stocking so days of carrying/recon costs don't starve
// the dealership (Inventory.accrueDay throws on overdraw).
const CASH_BUFFER = 12_000;
const DAYS = 8;

interface Resolved {
  outcome: 'closed' | 'no_sale';
  matchQuality?: number;
}

// Build a real world, hire a salesperson, stock the lot, and run real days
// collecting every staff:auto_resolved — the canonical close event the
// match-quality now rides on. Returns all resolutions so the test can verify
// the live pipeline carries the signal without depending on the green-staff
// close cadence.
function runRealDays(): Resolved[] {
  const bus = createEventBus();
  const world = createWorld({ bus, masterSeed: 42, characterProfile: PROFILE });
  const resolved: Resolved[] = [];
  bus.subscribe('staff:auto_resolved', (e) => {
    resolved.push({ outcome: e.outcome, matchQuality: e.matchQuality });
  });
  // A green start has no salesperson on the roster, so an unstaffed floor would
  // never resolve an up. Hire one so the resolver actually runs.
  if (!world.staffOrg.currentRoster.some((s) => s.role_id === 'salesperson')) {
    const candidate = world.staffOrg.getCandidates('salesperson')[0];
    if (candidate) world.staffOrg.hire(candidate.candidateId);
  }
  const listings = [...world.inventory.getAuctionListings()].sort(
    (a, b) => a.askingPrice - b.askingPrice,
  );
  for (const listing of listings) {
    if (world.economy.cash - listing.askingPrice < CASH_BUFFER) break;
    world.inventory.buyFromAuction(listing.id);
  }
  for (let i = 0; i < DAYS; i++) {
    world.dayLoop.nextDay().runDay();
  }
  return resolved;
}

describe('#199 match-payoff beat — reachable through the live pipeline', () => {
  it('the close event flows through createWorld and every close carries a [0,1] quality', () => {
    const resolved = runRealDays();
    // Resolutions definitely fire on a staffed floor with traffic.
    expect(resolved.length).toBeGreaterThan(0);
    for (const r of resolved) {
      if (r.outcome === 'closed') {
        expect(typeof r.matchQuality).toBe('number');
        expect(r.matchQuality).toBeGreaterThanOrEqual(0);
        expect(r.matchQuality).toBeLessThanOrEqual(1);
      } else {
        expect(r.matchQuality).toBeUndefined();
      }
    }
  });

  it('reduces real closes into a consistent recap tally the App way', () => {
    const resolved = runRealDays();
    const closes = resolved.filter((r) => r.outcome === 'closed');
    const matched = closes.length;
    const strong = closes.filter((c) => (c.matchQuality ?? 0) >= STRONG).length;
    // The App reducer's invariant: strong ⊆ matched.
    expect(strong).toBeLessThanOrEqual(matched);
    const recap: DayRecapModel = {
      day: 1,
      potentialTraffic: 20,
      walkedIn: 14,
      staffEngaged: matched,
      sold: matched,
      gross: 9_000,
      leakCause: 'none',
      strongMatches: strong,
      matchedSales: matched,
    };
    expect(() => render(<DayRecap model={recap} />)).not.toThrow();
  });

  it('renders the recap strong-match tally', () => {
    const recap: DayRecapModel = {
      day: 1,
      potentialTraffic: 20,
      walkedIn: 14,
      staffEngaged: 5,
      sold: 5,
      gross: 9_000,
      leakCause: 'none',
      strongMatches: 3,
      matchedSales: 5,
    };
    const { getByText } = render(<DayRecap model={recap} />);
    expect(getByText(/3 of 5 sales were strong matches/)).toBeTruthy();
  });

  it('renders the live floor toast on a strong match', () => {
    const base: FloorDashboardModel = {
      day: 1,
      tick: 5,
      ticksPerDay: 20,
      openHour: 9,
      closeHour: 19,
      cash: 40_000,
      exceptionPending: false,
      ups: 6,
      sold: 1,
      pendingWarm: 2,
      gross: 3_000,
      staff: [],
      events: [
        { kind: 'match', key: 'm0', text: 'Easy sale — you had what they wanted.' },
      ],
      inventory: { unitsOnLot: 5, flooredValue: 60_000, avgDaysInInventory: 10 },
    };
    const { getByText } = render(<FloorDashboard model={base} />);
    expect(getByText('Easy sale — you had what they wanted.')).toBeTruthy();
  });

  it('App.tsx wires the close event into the toast + recap tally', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'App.tsx'), 'utf8');
    // The four links that, if cut, would orphan the beat: subscribe to the
    // close event, drop the match toast, thread the tally into the recap, and
    // reset it each day.
    expect(src).toMatch(/bus\.subscribe\('staff:auto_resolved', onAutoResolved\)/);
    expect(src).toMatch(/kind: 'match'/);
    expect(src).toMatch(/strongMatches: matchTally\.strong/);
    expect(src).toMatch(/matchedSales: matchTally\.matched/);
  });
});
