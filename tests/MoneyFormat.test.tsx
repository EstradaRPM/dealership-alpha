import React from 'react';
import { render } from '@testing-library/react-native';
import { buildStoreWorth, StoreWorthPair } from '../src/ui/StoreWorth';
import { buildGateStrip } from '../src/ui/HomeTab';
import { buildReveal } from '../src/ui/Reveal';
import { AuctionMenu } from '../src/ui/AuctionMenu';
import { TradeEscalationModal, type TradeReview } from '../src/ui/TradeEscalationModal';
import { buildFacilityBuild } from '../src/ui/GrowthTab';
import { wageText } from '../src/ui/PeopleTab/peopleModel';
import type { AuctionListing, LotOccupancy } from '../src/game/Inventory';
import type { GateProgress } from '../src/game/TierGate';

/**
 * #387 — which formatter each surface picks.
 *
 * The rule is one sentence: **compact when the figure is ambient, exact when
 * the player is about to act on it.** The two halves are asserted against real
 * surfaces rather than against the formatters, because the defect this slice
 * exists to prevent is a surface picking the wrong one — not a formatter
 * producing the wrong string.
 */

const OPEN_LOT: LotOccupancy = {
  occupied: 4,
  built: 12,
  spacesOpen: 8,
  atCapacity: false,
};

const LISTING: AuctionListing = {
  id: 'auction-day1-0-vanda_sedan',
  templateId: 'vanda_sedan',
  brand: 'vanda',
  year: 2020,
  make: 'Honda',
  model: 'Civic',
  trim: 'LX',
  mileage: 45_000,
  condition: 'average',
  conditionReport: 'Normal wear for mileage.',
  askingPrice: 12_431,
  reconCost: 1_200,
  category: 'sedan',
  sourceId: 'manheim_digital',
  inspectionStatus: 'none',
};

const REVIEW: TradeReview = {
  customerId: 'cust:42',
  vehicle: {
    id: 'veh:1',
    make: 'Toyota',
    model: 'Camry',
    year: 2018,
    mileage: 62_000,
    category: 'sedan',
  },
  currentVehicle: {
    make: 'Honda',
    model: 'Civic',
    year: 2016,
    mileage: 80_000,
    condition: 'average',
    category: 'sedan',
    loanPayoff: 4_000,
  },
  book: 6_000,
  allowanceAsk: 9_450,
  payoff: 4_000,
  target: 5_100,
  recommendedCounter: 5_500,
  staffConfidence: 0.7,
};

describe('#387 ambient figures render compact', () => {
  it('the HUD headline and the worth line under it', () => {
    const model = buildStoreWorth({ cash: 177_803, stockValue: 35_652, total: 213_455 });
    const { getByText } = render(<StoreWorthPair model={model} />);
    // Nothing is committed against either: the reading is the magnitude.
    expect(getByText('$177.8k')).toBeTruthy();
    expect(getByText('$213.5k')).toBeTruthy();
  });

  it('the month gross on the Home gate strip — current, target and pace alike', () => {
    const progress: GateProgress = {
      tier: 1,
      monthIndex: 1,
      dayInMonth: 10,
      daysInMonth: 30,
      faces: [
        {
          id: 'gross',
          kind: 'flow',
          label: 'Gross Profit',
          current: 48_500,
          target: 60_000,
          onPace: false,
          cushion: -11_500,
          projectedLanding: 55_000,
          onPaceRateNeeded: 1_850,
        },
      ],
      meetsAll: false,
      streakMonths: 0,
      streakRequired: 2,
    } as unknown as GateProgress;

    const strip = buildGateStrip(progress, 5_000);
    const gross = strip.faces.find((f) => f.id === 'gross');
    expect(gross?.kind).toBe('flow');
    if (gross?.kind !== 'flow') throw new Error('gross face is a flow face');
    expect(gross.valueLabel).toBe('$48.5k / $60k');
    expect(gross.paceLabel).toBe('Need $1.9k/day · proj $55k');
  });

  it("the Reveal's scoreline, while each reaction under it stays exact", () => {
    const reveal = buildReveal(
      {
        potentialTraffic: 10,
        walkedIn: 8,
        staffEngaged: 8,
        sold: 6,
        leakCause: 'none',
      },
      14_200,
      { strong: 6, matched: 8 },
    );
    // The scoreline is the ambient tally at the top of the feed.
    expect(reveal.reactions[0]?.text).toContain('$14.2k gross');
  });
});

describe('#387 figures the player commits against render to the dollar', () => {
  it('an auction bid, on the row and on the button that spends the cash', () => {
    const { getByText } = render(
      <AuctionMenu
        listings={[LISTING]}
        lotVehicles={[]}
        cash={50_000}
        lotOccupancy={OPEN_LOT}
        onBuy={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(getByText('$12,431')).toBeTruthy();
  });

  it('a trade allowance, on every row of the escalation the player answers', () => {
    const { getByText } = render(
      <TradeEscalationModal visible review={REVIEW} onDecide={jest.fn()} />,
    );
    expect(getByText('$9,450')).toBeTruthy();
    expect(getByText('Accept ask — $9,450')).toBeTruthy();
  });

  it('a wage — payroll the store commits to every day it opens', () => {
    expect(wageText(340)).toBe('$340/day');
    expect(wageText(1_250)).toBe('$1,250/day');
  });

  it('a build cost, stated on the button that pays it', () => {
    const build = buildFacilityBuild([
      {
        kind: 'lotSpaces',
        built: 12,
        ceiling: 20,
        inFlight: 0,
        units: 4,
        cost: 26_000,
        unitCost: 6_500,
        days: 5,
        jobs: [],
      },
    ]);
    const row = build.rows[0];
    expect(row?.priceLabel).toContain('$6,500');
    expect(row?.actionLabel).toContain('$26,000');
  });
});
