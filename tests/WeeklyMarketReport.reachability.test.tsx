import React from 'react';
import { readAppCompositionSource } from './helpers/appComposition';
import * as fs from 'fs';
import * as path from 'path';
import { render } from '@testing-library/react-native';
import { createEventBus } from '../src/game/EventBus';
import { createWorld } from '../src/createWorld';
import { buildWeeklyReport } from '../src/app/config';
// #349: the weekly column moved to the Growth demand console with the wire.
import {
  GrowthTab,
  WeeklyMarketReportCard,
  buildWeeklyReportCard,
} from '../src/ui/GrowthTab';
import { snapshotWorld, restoreWorld } from '../src/worldSnapshot';
import type { CharacterProfile } from '../src/game/CareerProgression';
import type { DayLoopState } from '../src/game/DayLoopController';

/**
 * #177 reachability — the weekly column has to be reachable in the LIVE flow:
 * a real world ticking real days, publishing a real column that reaches the Home
 * screen and survives a save. Plus the anti-orphan guard (a surface built and
 * never mounted).
 */

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

const MANAGERIAL: DayLoopState = {
  phase: 'MANAGERIAL',
  day: 1,
  ownershipUnlocked: true,
  hasRecap: false,
};

function runDays(bus: ReturnType<typeof createEventBus>, days: number): void {
  for (let d = 1; d <= days; d += 1) bus.publish('clock:day_started', { day: d });
}

describe('#177 weekly market report — live world', () => {
  it('publishes a column once a week, covering the week just played', () => {
    const bus = createEventBus();
    createWorld({ bus, masterSeed: 177, characterProfile: PROFILE });
    const published: Array<{ day: number; weekIndex: number; summary: string }> = [];
    bus.subscribe('market:weekly_report_published', (e) => published.push(e));

    runDays(bus, 29);

    // Days 8, 15, 22, 29 on the default Monday cadence.
    expect(published.map((p) => p.day)).toEqual([8, 15, 22, 29]);
    expect(published.map((p) => p.weekIndex)).toEqual([1, 2, 3, 4]);
    for (const p of published) expect(p.summary).not.toMatch(/\{\w+\}/);
  });

  it('has nothing to show before the first full week', () => {
    const bus = createEventBus();
    const world = createWorld({ bus, masterSeed: 177, characterProfile: PROFILE });
    runDays(bus, 7);
    expect(world.marketEconomy.weeklyReport.getActive()).toBeNull();
    expect(buildWeeklyReport(world)).toBeNull();
  });

  it('reaches the Home read model as a rendered card', () => {
    const bus = createEventBus();
    const world = createWorld({ bus, masterSeed: 177, characterProfile: PROFILE });
    runDays(bus, 30);

    const model = buildWeeklyReport(world);
    expect(model).not.toBeNull();
    expect(model?.title.length).toBeGreaterThan(0);
    expect(model?.summary).not.toMatch(/\{\w+\}/);
    expect(model?.subtitle).not.toMatch(/\{\w+\}/);
    expect(model?.tallyText).not.toMatch(/\{\w+\}/);
    // Every watched segment gets a row, biggest mover first.
    expect(model?.moves.length).toBe(3);
    for (const call of model?.calls ?? []) expect(call.text).not.toMatch(/\{\w+\}/);
    // Recap and forward calls carry the wire's own trust vocabulary.
    expect(model?.recapBadge?.label).toBe('Recap');
    expect(model?.callsBadge?.label).toBe('Rumor');

    const { getByTestId } = render(<GrowthTab weeklyReport={model} />);
    expect(getByTestId('growth-region-weekly-report')).toBeTruthy();
    expect(getByTestId('weekly-market-report')).toBeTruthy();
    expect(getByTestId('weekly-report-summary')).toBeTruthy();
  });

  it('replays identically from the same seed and diverges from another', () => {
    const columnFor = (seed: number) => {
      const bus = createEventBus();
      const world = createWorld({ bus, masterSeed: seed, characterProfile: PROFILE });
      runDays(bus, 60);
      return world.marketEconomy.weeklyReport.getActive();
    };
    expect(columnFor(177)).toEqual(columnFor(177));
    expect(columnFor(177)).not.toEqual(columnFor(4242));
  });

  it('survives a save/load through the world seam', () => {
    const bus = createEventBus();
    const world = createWorld({ bus, masterSeed: 177, characterProfile: PROFILE });
    runDays(bus, 30);
    const before = world.marketEconomy.weeklyReport.getActive();
    expect(before).not.toBeNull();

    const snap = snapshotWorld(world);
    const bus2 = createEventBus();
    const world2 = createWorld({ bus: bus2, masterSeed: 177, characterProfile: PROFILE });
    restoreWorld(snap, world2);

    expect(world2.marketEconomy.weeklyReport.getActive()).toEqual(before);
    expect(buildWeeklyReport(world2)).toEqual(buildWeeklyReport(world));
  });

  it('is actually mounted on the Growth tab by the composition root', () => {
    // #349: the column moved to Growth with the wire; read the whole layer.
    const src = readAppCompositionSource();
    expect(src).toMatch(/weeklyReport=\{buildWeeklyReport\(world\)\}/);

    const worldState = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'app', 'useWorldState.ts'),
      'utf8',
    );
    expect(worldState).toMatch(/subscribe\('market:weekly_report_published'/);
  });
});

describe('#177 weekly market report — card behavior', () => {
  const REPORT = {
    day: 8,
    weekIndex: 1,
    fromDay: 1,
    toDay: 7,
    sourceLabel: 'Dealer Trade Weekly',
    summary: 'Money moved up this week, led by SUVs at 5%.',
    moves: [
      { segment: 'suv', label: 'SUVs', delta: 0.05, mentions: 3 },
      { segment: 'truck', label: 'trucks', delta: -0.02, mentions: 1 },
      { segment: 'sedan', label: 'sedans', delta: 0.001, mentions: 0 },
    ],
    forwardCalls: [{ kind: 'drift_up', text: 'SUVs have run 5% up and we expect more.' }],
    wireTally: { total: 6, direct: 3, leading: 2, lagging: 1 },
  };
  const COPY = {
    title: 'Weekly Market Report',
    subtitle: 'Days {fromDay}–{toDay}',
    movesHeading: 'The week in the lanes',
    callsHeading: 'What we expect next week',
    noCallsText: 'No calls this week.',
    wireTallyText: '{total} reports — {direct} confirmed, {leading} rumor, {lagging} recap.',
  };
  const LABELS = { direct: 'Confirmed', leading: 'Rumor', lagging: 'Recap' } as const;

  const model = buildWeeklyReportCard({
    report: REPORT,
    copy: COPY,
    reliabilityLabels: LABELS,
  });

  it('fills the chrome from live copy at render time', () => {
    expect(model?.subtitle).toBe('Days 1–7');
    expect(model?.tallyText).toBe('6 reports — 3 confirmed, 2 rumor, 1 recap.');
  });

  it('labels a move that rounds to nothing as flat rather than a fake 1%', () => {
    const sedan = model?.moves.find((m) => m.segment === 'sedan');
    expect(sedan?.deltaLabel).toBe('0%');
    expect(sedan?.direction).toBe('flat');
    expect(sedan?.mentionsLabel).toBeNull();
    const suv = model?.moves.find((m) => m.segment === 'suv');
    expect(suv?.deltaLabel).toBe('+5%');
    expect(suv?.mentionsLabel).toBe('3 reports');
    expect(model?.moves.find((m) => m.segment === 'truck')?.mentionsLabel).toBe(
      '1 report',
    );
  });

  it('renders the moves, the calls and the tally', () => {
    const { getByTestId, getByText } = render(
      <WeeklyMarketReportCard model={model!} />,
    );
    expect(getByTestId('weekly-move-suv')).toBeTruthy();
    expect(getByTestId('weekly-call-drift_up-0')).toBeTruthy();
    expect(getByTestId('weekly-report-tally')).toBeTruthy();
    expect(getByText('Dealer Trade Weekly')).toBeTruthy();
  });

  it('says so plainly when the desk declined to bet', () => {
    const quiet = buildWeeklyReportCard({
      report: { ...REPORT, forwardCalls: [] },
      copy: COPY,
      reliabilityLabels: LABELS,
    });
    const { getByTestId } = render(<WeeklyMarketReportCard model={quiet!} />);
    expect(getByTestId('weekly-no-calls')).toBeTruthy();
  });

  it('renders the Growth tab with no column at all (pre-first-week)', () => {
    const { getByTestId } = render(<GrowthTab />);
    expect(getByTestId('growth-region-weekly-report')).toBeTruthy();
  });
});
