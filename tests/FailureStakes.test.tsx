import fs from 'fs';
import path from 'path';
import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { readAppCompositionSource } from './helpers/appComposition';
import { createAppServices, type AppServices } from '../src/app/services';
import { createInMemoryDriverFactory } from '../src/game/SaveStore';
import { createNavigator } from '../src/ui/Navigator';
import { createWorld, type World } from '../src/createWorld';
import { useHints, type Hints } from '../src/app/useHints';
import { useDayLoop } from '../src/app/useDayLoop';
import { StakesBeatCard } from '../src/ui/NarrativeBeat';
import { loadTeachingBeats, TEACHING_BEAT_IDS } from '../src/ui/copy';
import { loadFailureTunables } from '../src/game/CareerProgression';
import type { CharacterProfile } from '../src/game/CareerProgression';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);

jest.setTimeout(30_000);

/**
 * The failure-stakes beat (#394). A new player used to learn the failure model
 * from the EndCard — the first time they heard that running out of money ends
 * the career was when it already had. This states it while there is still
 * something to do about it, once per career, off the same per-slot teaching
 * cell every hint retires into.
 *
 * The harness wires the pieces the way the composition root does — the real
 * `useHints` reading a real slot's teaching cell, the real `useDayLoop` raising
 * the beat at the day close, and the real card rendering it — so a beat that
 * stopped reaching the surface is a failure here rather than something only a
 * 200-day drive would find.
 */

const TUNABLES = loadFailureTunables();
const CATALOG = loadTeachingBeats();
const STAKES = CATALOG.beats.find((b) => b.id === 'failure_stakes')!;

function profile(startingCreditLine: number): CharacterProfile {
  return {
    name: 'Ray Estrada',
    backstoryId: startingCreditLine > 0 ? 'ex-banker' : 'ex-mechanic',
    day1Modifier: {
      backstoryId: startingCreditLine > 0 ? 'ex-banker' : 'ex-mechanic',
      reconJudgmentBonus: 0,
      startingCreditLine,
      startingCapitalBonus: 0,
      grudgesFlag: false,
    },
  };
}

interface Harness {
  world: World;
  services: AppServices;
  hintsRef: { current: Hints | null };
  screen: ReturnType<typeof render>;
}

function HarnessView({
  services,
  worldRef,
  hintsRef,
}: {
  services: AppServices;
  worldRef: React.MutableRefObject<World | null>;
  hintsRef: { current: Hints | null };
}) {
  const hints = useHints({ slotStore: services.slotStore });
  hintsRef.current = hints;
  const dayLoop = useDayLoop({
    services,
    worldRef,
    nav: createNavigator('game'),
    setLotVehicles: () => {},
    setCash: () => {},
    setFloorEvents: () => {},
    eventSeq: { current: 0 },
    bump: () => {},
    buildCurrentSaveState: async () => ({}),
    hasTaught: hints.hasTaught,
    markTaught: hints.markTaught,
  });
  return dayLoop.stakesBeat ? (
    <StakesBeatCard
      visible
      beat={dayLoop.stakesBeat}
      onConfirm={() => dayLoop.setStakesBeat(null)}
    />
  ) : null;
}

async function harness(startingCreditLine = 0): Promise<Harness> {
  const services = createAppServices(createInMemoryDriverFactory());
  await services.slotStore.createSlot('Stakes Save');
  const world = createWorld({
    bus: services.bus,
    masterSeed: 7,
    characterProfile: profile(startingCreditLine),
  });
  const worldRef = { current: world as World | null };
  const hintsRef: { current: Hints | null } = { current: null };
  const screen = render(
    <HarnessView services={services} worldRef={worldRef} hintsRef={hintsRef} />,
  );
  // The teaching cell is read asynchronously at mount; a beat asked before that
  // read lands would be judged against an empty set.
  await waitFor(() => expect(hintsRef.current).not.toBeNull());
  return { world, services, hintsRef, screen };
}

/** Set the store's cash to an exact figure, then close a day on it. */
function closeDayWith(h: Harness, cash: number) {
  act(() => {
    const delta = cash - h.world.economy.cash;
    if (delta >= 0) h.world.economy.postRevenue(delta, 'Test balance');
    else h.world.economy.forceDebit(-delta, 'Test balance');
    h.services.bus.publish('floor:day_complete', {
      day: h.world.clock.currentDay,
      ticks: 1,
      totalArrivals: 0,
    });
  });
}

const LOW = TUNABLES.warningCashFloor - 1;
const SOLVENT = TUNABLES.warningCashFloor + 50_000;

describe('#394 the tier-1 failure stakes', () => {
  it('the first low-cash day states the stakes', async () => {
    const h = await harness();
    const { screen } = h;
    closeDayWith(h, LOW);

    await waitFor(() => expect(screen.getByTestId('stakes-beat-card')).toBeTruthy());
    expect(screen.getByText(STAKES.title)).toBeTruthy();
    // The consequence names what running out does to the career AND the save,
    // with the rule's own day count — not a number re-typed into the copy.
    expect(
      screen.getByText(
        STAKES.cost.replace('{days}', String(TUNABLES.consecutiveDaysToTrigger)),
      ),
    ).toBeTruthy();
    // The reading is the store's actual cash, exact (#387) — the player is
    // about to act on it.
    expect(screen.getByText(new RegExp('\\$12,499'))).toBeTruthy();
  });

  it('a second dip says nothing', async () => {
    const h = await harness();
    const { screen, services } = h;
    closeDayWith(h, LOW);
    await waitFor(() => expect(screen.getByTestId('stakes-beat-card')).toBeTruthy());

    // The mark landed in the real per-slot cell, not in hook-local state.
    await waitFor(async () => {
      const teaching = await services.teachingStoreForActiveSlot();
      expect(await teaching?.listTaught()).toEqual(['failure_stakes']);
    });

    // Acknowledge it, recover, then dip again. The beat is owed once per
    // career: the second dip must raise nothing at all.
    fireEvent.press(screen.getByText('Got it'));
    await waitFor(() => expect(screen.queryByText(STAKES.title)).toBeNull());
    closeDayWith(h, SOLVENT);
    closeDayWith(h, LOW - 5_000);
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText(STAKES.title)).toBeNull();
  });

  it('re-arms with the rest of the teaching catalog', async () => {
    const h = await harness();
    const { screen, hintsRef, services } = h;
    closeDayWith(h, LOW);
    await waitFor(() => expect(screen.getByTestId('stakes-beat-card')).toBeTruthy());

    // Dismiss it first, so the reappearance below is the beat being re-armed
    // rather than the original card still standing.
    fireEvent.press(screen.getByText('Got it'));
    await waitFor(() => expect(screen.queryByText(STAKES.title)).toBeNull());

    // "Show hints again" is `resetHints` — ONE cell, so it re-arms the beats
    // with the hints rather than clearing only whichever half remembered.
    act(() => hintsRef.current!.resetHints());
    await waitFor(async () => {
      const teaching = await services.teachingStoreForActiveSlot();
      expect(await teaching?.listTaught()).toEqual([]);
    });

    closeDayWith(h, LOW);
    await waitFor(() => expect(screen.getByText(STAKES.title)).toBeTruthy());
  });

  it('an ex-banker is told about the line', async () => {
    const h = await harness(50_000);
    const { screen } = h;
    closeDayWith(h, LOW);

    await waitFor(() => expect(screen.getByTestId('stakes-beat-card')).toBeTruthy());
    expect(
      screen.getByText(
        new RegExp(STAKES.reach!.replace('{reach}', '\\$50,000').replace(/[.]/g, '\\.')),
      ),
    ).toBeTruthy();
  });

  it('a store with no line is never told to reach for nothing', async () => {
    const h = await harness();
    const { screen } = h;
    closeDayWith(h, LOW);

    await waitFor(() => expect(screen.getByTestId('stakes-beat-card')).toBeTruthy());
    // The clause is omitted whole rather than rendered about $0.
    expect(screen.queryByText(new RegExp('line of credit'))).toBeNull();
    expect(screen.getByText(STAKES.path)).toBeTruthy();
  });

  it('a Tier 2 store is not told its career is about to end', async () => {
    const h = await harness();
    const { screen, services } = h;
    // Running out at Tier 2 contracts back a tier — the #326 recovery beat's
    // territory. The stakes sentence is the Tier 1 rule, so it must not be
    // stated to a store the rule does not apply to.
    act(() =>
      h.world.tierManager.restore({
        ...h.world.tierManager.snapshot(),
        currentTier: 2,
      }),
    );
    expect(h.world.tierManager.currentTier).toBe(2);

    closeDayWith(h, LOW);
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByTestId('stakes-beat-card')).toBeNull();
    const teaching = await services.teachingStoreForActiveSlot();
    expect(await teaching?.listTaught()).toEqual([]);
  });

  it('a solvent career is never warned', async () => {
    const h = await harness();
    const { screen, services } = h;
    for (let i = 0; i < 5; i++) closeDayWith(h, SOLVENT);

    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByTestId('stakes-beat-card')).toBeNull();
    const teaching = await services.teachingStoreForActiveSlot();
    expect(await teaching?.listTaught()).toEqual([]);
  });
});

describe('#394 the warning floor is the failure model’s number', () => {
  it('sits above the floor that actually ends a career', () => {
    // A warning that arrived at or below the level that ends the career would
    // arrive with no room to act on, which is the whole point of the beat. The
    // schema refuses the file outright; this states the relationship.
    expect(TUNABLES.warningCashFloor).toBeGreaterThan(TUNABLES.cashFloor);
  });

  it('the monitor owns the reading, so no surface re-derives the threshold', async () => {
    const services = createAppServices(createInMemoryDriverFactory());
    const world = createWorld({
      bus: services.bus,
      masterSeed: 11,
      characterProfile: profile(0),
    });
    const monitor = world.bankruptcyMonitor;
    expect(monitor.daysBelowFloorToFail).toBe(TUNABLES.consecutiveDaysToTrigger);

    const toLow = TUNABLES.warningCashFloor - 1 - world.economy.cash;
    if (toLow >= 0) world.economy.postRevenue(toLow, 'Test balance');
    else world.economy.forceDebit(-toLow, 'Test balance');
    expect(monitor.isCashLow).toBe(true);

    world.economy.postRevenue(2, 'Test balance');
    expect(monitor.isCashLow).toBe(false);
  });
});

describe('#394 the beat is reachable in the live app', () => {
  it('App composition raises it at the day close and mounts the card', () => {
    const src = readAppCompositionSource();
    // The reading comes from the monitor that owns the threshold, and the
    // "have we said this yet" question from the teaching cell.
    expect(src).toMatch(/w\.bankruptcyMonitor\.isCashLow/);
    // The sentence is the Tier 1 rule, so it is stated only where it is true.
    expect(src).toMatch(/w\.tierManager\.currentTier === 1/);
    expect(src).toMatch(/!hasTaught\('failure_stakes'\)/);
    expect(src).toMatch(/markTaught\('failure_stakes'\)/);
    expect(src).toMatch(/buildStakesBeat\(/);
    // The facility's own read supplies the reach — never a backstory id.
    expect(src).toMatch(
      /creditAvailable: w\.creditFacility\.getFacility\(\)\.available/,
    );
    expect(src).not.toMatch(/backstoryId === 'ex-banker'/);
    // Wired from the composition root off the SAME cell the hints use.
    expect(src).toMatch(/hasTaught: hints\.hasTaught/);
    expect(src).toMatch(/markTaught: hints\.markTaught/);
    // And actually mounted.
    expect(src).toMatch(/<StakesBeatCard/);
  });

  it('the beat is raised BEFORE the bite early-return', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'app', 'useDayLoop.ts'),
      'utf8',
    );
    const raise = src.indexOf("markTaught('failure_stakes')");
    const biteReturn = src.indexOf('if (biteDaysRef.current) {');
    expect(raise).toBeGreaterThan(-1);
    expect(biteReturn).toBeGreaterThan(-1);
    // A warning a multi-day run could skip is a warning the player who most
    // needs it never gets: a week that burns the store down must still state
    // the stakes on the day cash first read low.
    expect(raise).toBeLessThan(biteReturn);
  });
});

describe('#394 the beat copy is data', () => {
  const SRC = path.join(__dirname, '..', 'src');

  function sourceFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...sourceFiles(full));
      else if (/\.tsx?$/.test(entry.name)) out.push(full);
    }
    return out;
  }

  const files = sourceFiles(SRC).filter((f) => !/\.test\.tsx?$/.test(f));

  it('the scan sees the source tree it is meant to sweep', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('every declared id has copy', () => {
    for (const id of TEACHING_BEAT_IDS) {
      expect(CATALOG.beats.some((b) => b.id === id)).toBe(true);
    }
  });

  const fragments = CATALOG.beats.flatMap((b) =>
    [b.title, b.cause, b.cost, b.path, ...(b.reach ? [b.reach] : [])].map((s) =>
      s.split('{')[0].trim().slice(0, 40),
    ),
  ).filter((f) => f.length >= 20);

  it.each(files.map((f) => [path.relative(SRC, f), f] as const))(
    '%s inlines no beat copy',
    (_rel, file) => {
      const text = fs.readFileSync(file, 'utf8');
      const leaked = fragments.filter((f) => text.includes(f));
      expect(leaked).toEqual([]);
    },
  );
});
