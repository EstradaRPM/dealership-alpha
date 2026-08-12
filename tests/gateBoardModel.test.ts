import { buildGateBoard } from '../src/ui/GrowthTab';
import type {
  FlowFaceProgress,
  GateProgress,
  TierRequirements,
} from '../src/game/TierGate';

// #349 — the Growth gate board's pure read model. Home's strip compresses each
// face to one line; the board spells the engine's numbers out and adds the
// climb. Decision 2 holds: facts, never a prescription.

const PROGRESS: GateProgress = {
  day: 12,
  dayOfMonth: 12,
  daysInMonth: 30,
  daysRemaining: 18,
  tier: 1,
  faces: [
    {
      id: 'units',
      label: 'Retail Units',
      kind: 'flow',
      current: 5,
      target: 8,
      projectedLanding: 12.5,
      onPaceRateNeeded: 0.17,
      toCatchUp: 3,
      expectedByNow: 3.2,
      cushion: 1.8,
      onPace: true,
    },
    {
      id: 'cash',
      label: 'Cash on Hand',
      kind: 'level',
      currentLevel: 48300,
      avgLevel: 52400,
      threshold: 60000,
      trend: 'sliding',
      meetsThreshold: false,
    },
    {
      id: 'csi',
      label: 'CSI',
      kind: 'trend',
      rollingAvg: 72.4,
      threshold: 75,
      trend: 'climbing',
      meetsThreshold: false,
      recentSamples: [70, 72, 76],
    },
  ],
};

const NEXT: TierRequirements = {
  tier: 2,
  streak: 2,
  faces: [
    { id: 'units', label: 'Retail Units', kind: 'flow', target: 15 },
    { id: 'gross', label: 'Gross Profit', kind: 'flow', target: 30000 },
    { id: 'cash', label: 'Cash on Hand', kind: 'level', target: 150000 },
  ],
};

describe('buildGateBoard — the faces, spelled out', () => {
  it('reports a flow face as a pace fact, never a command', () => {
    const units = buildGateBoard(PROGRESS, null).faces.find((f) => f.id === 'units')!;
    expect(units.valueLabel).toBe('5 / 8');
    expect(units.statusLabel).toBe('On pace');
    expect(units.tone).toBe('positive');
    expect(units.fill).toBeCloseTo(5 / 8);
    const byLabel = Object.fromEntries(units.details.map((d) => [d.label, d.value]));
    expect(byLabel['Booked so far']).toBe('5');
    expect(byLabel['Month target']).toBe('8');
    expect(byLabel['On-pace line today']).toBe('3.2');
    expect(byLabel['Ahead by']).toBe('1.8');
    expect(byLabel['Still to go']).toBe('3');
    expect(byLabel['Needed per day left']).toBe('0.2/day');
    expect(byLabel['Projected finish']).toBe('13');
    // No coaching voice anywhere in the copy.
    expect(units.details.map((d) => d.label).join(' ')).not.toMatch(/should|must|you/i);
  });

  it('flips a behind-pace flow face to the shortfall wording', () => {
    const behind = buildGateBoard(
      {
        ...PROGRESS,
        faces: [
          {
            ...(PROGRESS.faces[0] as FlowFaceProgress),
            current: 2,
            expectedByNow: 3.2,
            cushion: -1.2,
            onPace: false,
          },
        ],
      },
      null,
    ).faces[0];
    expect(behind.statusLabel).toBe('Behind pace');
    expect(behind.tone).toBe('primary');
    expect(
      Object.fromEntries(behind.details.map((d) => [d.label, d.value]))['Behind by'],
    ).toBe('1.2');
  });

  it('renders money faces as money and score faces bare', () => {
    const board = buildGateBoard(PROGRESS, null);
    const cash = board.faces.find((f) => f.id === 'cash')!;
    expect(cash.valueLabel).toBe('Avg $52.4k');
    expect(cash.statusLabel).toBe('Under the bar');
    expect(cash.tone).toBe('danger');
    expect(cash.trend).toBe('down');
    const cashDetails = Object.fromEntries(cash.details.map((d) => [d.label, d.value]));
    expect(cashDetails['Bar to clear']).toBe('$60k');
    expect(cashDetails['Right now']).toBe('$48.3k');
    expect(cashDetails['Direction']).toBe('Sliding');

    const csi = board.faces.find((f) => f.id === 'csi')!;
    expect(csi.valueLabel).toBe('72');
    expect(csi.fill).toBeUndefined();
    // Normalized against the window's own min/max so a narrow band still reads.
    expect(csi.sparkline).toEqual([0, (72 - 70) / 6, 1]);
    expect(csi.trend).toBe('up');
  });

  it('states where the month stands without judging the day', () => {
    const board = buildGateBoard(PROGRESS, null);
    expect(board.periodLabel).toBe('Tier 1 · Day 12 of 30');
    expect(board.remainingLabel).toBe('18 days left');
    expect(
      buildGateBoard({ ...PROGRESS, daysRemaining: 1 }, null).remainingLabel,
    ).toBe('1 day left');
    expect(
      buildGateBoard({ ...PROGRESS, daysRemaining: 0 }, null).remainingLabel,
    ).toBe('Last day of the month');
  });
});

describe('buildGateBoard — the facility face (#360)', () => {
  const withFacility: GateProgress = {
    ...PROGRESS,
    faces: [
      ...PROGRESS.faces,
      {
        id: 'facility',
        label: 'Facility Build-Out',
        kind: 'stepped',
        score: 34,
        threshold: 50,
        meetsThreshold: false,
      },
    ],
  };

  it('spells the build-out score out against its bar, with no trend arrow', () => {
    const face = buildGateBoard(withFacility, null).faces.find((f) => f.id === 'facility')!;
    expect(face.kind).toBe('stepped');
    expect(face.valueLabel).toBe('34% built');
    expect(face.statusLabel).toBe('Under the bar');
    expect(face.tone).toBe('danger');
    expect(face.fill).toBeCloseTo(34 / 50);
    // A stepped score holds still until the player builds — an arrow here
    // would read "flat" every day and mean nothing.
    expect(face.trend).toBeUndefined();
    expect(face.sparkline).toBeUndefined();
    const byLabel = Object.fromEntries(face.details.map((d) => [d.label, d.value]));
    expect(byLabel['Bar to clear']).toBe('50% built');
    expect(byLabel['Built out now']).toBe('34%');
    // The per-kind breakdown belongs to the build surface on this same tab.
    expect(face.details.some((d) => /bay|lot/i.test(d.label))).toBe(false);
  });

  it('foreshadows the facility bar in the climb', () => {
    const climb = buildGateBoard(PROGRESS, {
      ...NEXT,
      faces: [
        ...NEXT.faces,
        { id: 'facility', label: 'Facility Build-Out', kind: 'stepped', target: 50 },
      ],
    }).climb!;
    expect(climb.requirements).toContainEqual({
      label: 'Facility Build-Out',
      value: '50% built',
    });
  });
});

describe('buildGateBoard — the climb', () => {
  it('foreshadows the next rung with its bars and its streak rule', () => {
    const climb = buildGateBoard(PROGRESS, NEXT, {
      current: 1,
      required: 2,
      dossierReady: false,
    }).climb!;
    expect(climb.title).toBe('Next up: Tier 2');
    expect(climb.ruleLabel).toBe('Clear every bar below for 2 straight months to move up.');
    expect(climb.streakLabel).toBe('Track record: month 1 of 2');
    expect(climb.requirements).toEqual([
      { label: 'Retail Units', value: '15 a month' },
      { label: 'Gross Profit', value: '$30k a month' },
      { label: 'Cash on Hand', value: '$150k' },
    ]);
  });

  it('quotes the CURRENT tier streak, not the rung above it', () => {
    // The web drive read "for 2 straight months" (T2's streak) directly over
    // "month 0 of 1" (T1's). The months-to-climb is how long it takes to LEAVE
    // where you are, so the two lines must agree.
    const climb = buildGateBoard(PROGRESS, NEXT, {
      current: 0,
      required: 1,
      dossierReady: false,
    }).climb!;
    expect(climb.ruleLabel).toBe('Clear every bar below for one month to move up.');
    expect(climb.streakLabel).toBe('Track record: month 0 of 1');
  });

  it('states the bar without inventing a count when no streak is supplied', () => {
    expect(buildGateBoard(PROGRESS, NEXT).climb!.ruleLabel).toBe(
      'Clear every bar below to move up.',
    );
  });

  it('crowns the completed top-tier streak instead of counting past it', () => {
    const climb = buildGateBoard(PROGRESS, NEXT, {
      current: 3,
      required: 3,
      dossierReady: true,
    }).climb!;
    expect(climb.streakLabel).toBe('Track record ready — franchise courtship coming');
  });

  it('drops the climb entirely at the top of the built ladder', () => {
    expect(buildGateBoard(PROGRESS, null).climb).toBeNull();
  });
});
