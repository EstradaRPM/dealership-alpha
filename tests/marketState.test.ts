import {
  classifyValueBand,
  buildSegmentHeatCells,
  buildActiveShocks,
  buildInventoryValuation,
  buildStaleInventory,
  type ValueBandEdges,
  type ShockInstanceInput,
  type ValuationVehicleInput,
} from '../src/ui/KPIDashboard';

const EDGES: ValueBandEdges = { mild: 0.03, strong: 0.1 };

describe('classifyValueBand', () => {
  it('reads at-baseline inside the mild edge (either sign)', () => {
    expect(classifyValueBand(0, EDGES)).toBe('neutral');
    expect(classifyValueBand(0.02, EDGES)).toBe('neutral');
    expect(classifyValueBand(-0.029, EDGES)).toBe('neutral');
  });

  it('reads mild above/below between the edges', () => {
    expect(classifyValueBand(0.05, EDGES)).toBe('above');
    expect(classifyValueBand(-0.05, EDGES)).toBe('below');
  });

  it('reads strong above/below at or past the strong edge', () => {
    expect(classifyValueBand(0.1, EDGES)).toBe('strong-above');
    expect(classifyValueBand(0.2, EDGES)).toBe('strong-above');
    expect(classifyValueBand(-0.15, EDGES)).toBe('strong-below');
  });
});

describe('buildSegmentHeatCells', () => {
  const inputs = {
    segments: ['sedan', 'suv', 'truck'],
    labelFor: (s: string) => s.toUpperCase(),
    personalityFor: (s: string) => ({ sedan: -0.04, suv: 0.05, truck: 0.0 })[s] ?? 0,
    driftFor: (s: string) => ({ sedan: -0.02, suv: 0.05, truck: 0.01 })[s] ?? 0,
    shockFor: (s: string) => ({ sedan: 0, suv: 0.02, truck: -0.08 })[s] ?? 0,
    edges: EDGES,
  };

  it('sums the three factors into heat and bands each cell', () => {
    const cells = buildSegmentHeatCells(inputs);
    const suv = cells.find((c) => c.segment === 'suv')!;
    expect(suv.heat).toBeCloseTo(0.12);
    expect(suv.personality).toBeCloseTo(0.05);
    expect(suv.drift).toBeCloseTo(0.05);
    expect(suv.shock).toBeCloseTo(0.02);
    expect(suv.band).toBe('strong-above');
    expect(suv.label).toBe('SUV');
  });

  it('sorts hottest (most-above) first', () => {
    const cells = buildSegmentHeatCells(inputs);
    // suv +0.12, sedan -0.06, truck -0.07 → descending by heat.
    expect(cells.map((c) => c.segment)).toEqual(['suv', 'sedan', 'truck']);
    expect(cells[1].heat).toBeCloseTo(-0.06);
    expect(cells[2].heat).toBeCloseTo(-0.07);
  });
});

describe('buildActiveShocks', () => {
  const instances: ShockInstanceInput[] = [
    {
      instanceId: 'fuel@2',
      label: 'Fuel spike',
      expectedEndDay: 6,
      segmentMagnitudes: { truck: -0.08, sedan: 0.03, suv: 0 },
    },
  ];

  it('derives days-remaining inclusive of the current day', () => {
    const [shock] = buildActiveShocks(instances, 4, (s) => s.toUpperCase());
    expect(shock.daysRemaining).toBe(3); // 6 - 4 + 1
  });

  it('floors days-remaining at zero on the resolve day', () => {
    const [shock] = buildActiveShocks(instances, 8, (s) => s);
    expect(shock.daysRemaining).toBe(0);
  });

  it('drops zero-magnitude segments and sorts by |magnitude|', () => {
    const [shock] = buildActiveShocks(instances, 4, (s) => s.toUpperCase());
    expect(shock.segments.map((e) => e.label)).toEqual(['TRUCK', 'SEDAN']);
    expect(shock.segments[0].magnitude).toBeCloseTo(-0.08);
  });
});

describe('inventory valuation + stale aggregation', () => {
  const vehicles: ValuationVehicleInput[] = [
    { cost: 15_000, book: 16_000, market: 20_000, dailyCarryingCost: 20, aged: false },
    { cost: 18_000, book: 19_000, market: 24_000, dailyCarryingCost: 22, aged: true },
    { cost: 12_000, book: 13_000, market: 15_000, dailyCarryingCost: 18, aged: false },
  ];

  it('aggregates book, market, unrealized gross, and weekly carry', () => {
    const v = buildInventoryValuation(vehicles);
    expect(v.unitCount).toBe(3);
    expect(v.totalBook).toBe(48_000);
    expect(v.totalMarket).toBe(59_000);
    expect(v.unrealizedGross).toBe(11_000); // 59k - 48k
    expect(v.weeklyCarryingBurn).toBe((20 + 22 + 18) * 7);
  });

  it('handles an empty lot without dividing by zero', () => {
    const v = buildInventoryValuation([]);
    expect(v.unitCount).toBe(0);
    expect(v.unrealizedGross).toBe(0);
    const stale = buildStaleInventory([], 45);
    expect(stale.staleShare).toBe(0);
  });

  it('counts only aged units toward stale metrics', () => {
    const stale = buildStaleInventory(vehicles, 45);
    expect(stale.staleCount).toBe(1);
    expect(stale.staleCost).toBe(18_000);
    expect(stale.staleShare).toBeCloseTo(1 / 3);
    expect(stale.thresholdDays).toBe(45);
  });
});
