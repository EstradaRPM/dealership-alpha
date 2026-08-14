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
import { TeachingBeatCard } from '../src/ui/NarrativeBeat';
import {
  loadTeachingBeats,
  TeachingBeatsConfigSchema,
  TEACHING_BEAT_IDS,
  BEAT_CONDITION_IDS,
} from '../src/ui/copy';
import {
  BEAT_CONDITIONS,
  createTeachingBeatChannel,
  createTeachingBeatContext,
  type BeatCondition,
} from '../src/app/teachingBeats';
import { createEventBus, EVENT_NAMES } from '../src/game/EventBus';
import { loadFailureTunables } from '../src/game/CareerProgression';
import type { CharacterProfile } from '../src/game/CareerProgression';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);

jest.setTimeout(30_000);

/**
 * The teaching beats (#394) and their progressive disclosure (#395).
 *
 * #213's spine teaches the store's opening moves on day one. A beat teaches
 * everything the game grew afterwards — the service annuity, the morning bet,
 * parts levels, the body shop's two customers, the finance desk's second
 * profit, runs longer than a day — at the moment each one **first matters**,
 * because a front-loaded tour of nine mechanics on day one is nine things
 * forgotten by the time any of them is reachable.
 *
 * The harness wires the pieces the way the composition root does — the real
 * `useHints` reading a real slot's teaching cell, the real `useDayLoop` binding
 * the real catalog to the real bus, and the real card rendering the result — so
 * a beat that stopped reaching the surface is a failure here rather than
 * something only a 200-day drive would find.
 */

const TUNABLES = loadFailureTunables();
const CATALOG = loadTeachingBeats();
const beatCopy = (id: string) => CATALOG.beats.find((b) => b.id === id)!;
const STAKES = beatCopy('failure_stakes');
const ANNUITY = beatCopy('service_annuity');

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
  // The overlay stack's own rule: FIFO, one card at a time, never stacked.
  return dayLoop.beatQueue.length > 0 ? (
    <TeachingBeatCard
      visible
      beat={dayLoop.beatQueue[0]}
      onConfirm={() => dayLoop.setBeatQueue((q) => q.slice(1))}
    />
  ) : null;
}

async function harness(startingCreditLine = 0): Promise<Harness> {
  const services = createAppServices(createInMemoryDriverFactory());
  await services.slotStore.createSlot('Beats Save');
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

// ───────────────────────────────────────────────────────────────────────────
// #395 — a beat fires when its mechanic first matters
// ───────────────────────────────────────────────────────────────────────────

describe('#395 progressive disclosure', () => {
  it('the first advisor hire teaches the service annuity', async () => {
    const h = await harness();
    const { screen, world } = h;
    // service-advisor has hireTier 2 and the hire gate reads the TierManager.
    act(() => {
      const tierState = world.tierManager.getSerializableState();
      world.tierManager.restoreState({ ...tierState, currentTier: 2 });
    });
    act(() => {
      const [advisor] = world.staffOrg.getCandidates('service-advisor');
      expect(advisor).toBeDefined();
      // The real hire publishes `staff:hired` — nothing here fakes the trigger.
      world.staffOrg.hire(advisor.candidateId);
    });

    await waitFor(() =>
      expect(screen.getByTestId('teaching-beat-card')).toBeTruthy(),
    );
    expect(screen.getByText(ANNUITY.title)).toBeTruthy();
  });

  it('an unmet condition swallows the trigger', async () => {
    const h = await harness();
    const { screen, services, world } = h;
    // The event the annuity beat rides, with nobody on the service desk. The
    // condition reads the ROSTER, not the payload's role, so a salesperson hire
    // is a trigger with no lesson behind it.
    act(() => {
      services.bus.publish('staff:hired', {
        staffId: 'nobody',
        roleId: 'salesperson',
        day: world.clock.currentDay,
        hiringCost: 0,
      });
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByTestId('teaching-beat-card')).toBeNull();
    const teaching = await services.teachingStoreForActiveSlot();
    expect(await teaching?.listTaught()).toEqual([]);
  });

  it('the morning bet waits until the lot is the player’s own', async () => {
    const h = await harness();
    const { screen, world, services } = h;
    // The opening day runs on the #296 seed lot — the store came with it, so a
    // bet read off it is not the player's wager and the beat must stay silent.
    // It is also what keeps the card clear of the #213 spine's fourth step.
    expect(world.clock.currentDay).toBe(1);
    act(() => {
      world.captureDayStartPrepBet();
      services.bus.publish('clock:day_started', { day: world.clock.currentDay });
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText(beatCopy('morning_bet').title)).toBeNull();

    // The next morning, on a lot they have had a night to change, it teaches.
    act(() => {
      world.clock.advanceDay();
      world.captureDayStartPrepBet();
      services.bus.publish('clock:day_started', { day: world.clock.currentDay });
    });
    await waitFor(() =>
      expect(screen.getByText(beatCopy('morning_bet').title)).toBeTruthy(),
    );
  });

  it('two eligible beats do not stack', () => {
    // Driven through the runner directly with SYNTHETIC beats: the channel is
    // generic over the id type, so this is the same code path the catalog takes
    // and nothing in `src/` was edited to make these two beats exist.
    const bus = createEventBus();
    const raised: string[] = [];
    const taught = new Set<string>();
    const conditions: Record<string, BeatCondition> = {
      always: () => ({}),
    };
    createTeachingBeatChannel<'first' | 'second'>(
      bus,
      (b) => raised.push(b.id),
      {
        decls: [
          { id: 'first', events: ['clock:day_started'], when: 'always' },
          { id: 'second', events: ['clock:day_started'], when: 'always' },
        ],
        conditions,
        ctx: createTeachingBeatContext(() => null),
        hasTaught: (id) => taught.has(id),
        markTaught: (id) => taught.add(id),
      },
    );

    bus.publish('clock:day_started', { day: 1 });
    // Both came due on one day: both are reported, in DECLARATION order, and
    // the surface drains them one at a time from the queue they land in.
    expect(raised).toEqual(['first', 'second']);
    // And each is owed once — a second day raises neither again.
    bus.publish('clock:day_started', { day: 2 });
    expect(raised).toEqual(['first', 'second']);
  });

  it('a new beat needs a declaration and copy, not a runner edit', () => {
    // The synthetic beat above proves the runner learns its beats at runtime.
    // This proves the other half: the runner names no beat, no mechanic and no
    // event of its own, so there is nothing in it for a new beat to change.
    const runner = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'app', 'teachingBeats.ts'),
      'utf8',
    );
    const body = runner.slice(runner.indexOf('export function createTeachingBeatChannel'));
    for (const id of TEACHING_BEAT_IDS) expect(body).not.toContain(id);
    for (const name of EVENT_NAMES) expect(body).not.toContain(`'${name}'`);
  });

  it('a beat cannot declare an event nobody publishes', () => {
    const good = TeachingBeatsConfigSchema.safeParse(CATALOG);
    expect(good.success).toBe(true);

    const bent = JSON.parse(JSON.stringify(CATALOG)) as typeof CATALOG;
    bent.beats[0].events = ['floor:day_finished'];
    const bad = TeachingBeatsConfigSchema.safeParse(bent);
    expect(bad.success).toBe(false);
  });

  it('every declared event is one the app actually publishes', () => {
    // The schema check above proves the guard exists; this proves the shipped
    // catalog passes it, and that EVENT_NAMES is the whole map rather than a
    // hand-kept subset that happens to cover today's beats.
    const names = new Set<string>(EVENT_NAMES);
    for (const beat of CATALOG.beats) {
      for (const event of beat.events) expect(names.has(event)).toBe(true);
    }
  });

  it('every declared condition has a predicate, and every predicate a use', () => {
    for (const id of BEAT_CONDITION_IDS) {
      expect(typeof BEAT_CONDITIONS[id]).toBe('function');
    }
    // A condition nobody declares is a question nobody asks — dead weight that
    // reads as a mechanic being taught when it is not.
    const declared = new Set(CATALOG.beats.map((b) => b.when));
    for (const id of BEAT_CONDITION_IDS) expect(declared.has(id)).toBe(true);
  });

  it('the whole named list of mechanics is taught', () => {
    // #395's scope, stated as the catalog: each of these is a mechanic the game
    // grew after the spine was written, and none of them is on the spine.
    expect([...TEACHING_BEAT_IDS]).toEqual([
      'failure_stakes',
      'morning_bet',
      'service_annuity',
      'fni_posture',
      'parts_pars',
      'channel_posture',
      'bite_ladder',
    ]);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// #394 — the failure stakes, now the first entry in that catalog
// ───────────────────────────────────────────────────────────────────────────

describe('#394 the tier-1 failure stakes', () => {
  it('the first low-cash day states the stakes', async () => {
    const h = await harness();
    const { screen } = h;
    closeDayWith(h, LOW);

    await waitFor(() =>
      expect(screen.getByTestId('teaching-beat-card')).toBeTruthy(),
    );
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
    await waitFor(() =>
      expect(screen.getByTestId('teaching-beat-card')).toBeTruthy(),
    );

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
    await waitFor(() =>
      expect(screen.getByTestId('teaching-beat-card')).toBeTruthy(),
    );

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

    await waitFor(() =>
      expect(screen.getByTestId('teaching-beat-card')).toBeTruthy(),
    );
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

    await waitFor(() =>
      expect(screen.getByTestId('teaching-beat-card')).toBeTruthy(),
    );
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
    expect(screen.queryByText(STAKES.title)).toBeNull();
    const teaching = await services.teachingStoreForActiveSlot();
    expect(await teaching?.listTaught()).not.toContain('failure_stakes');
  });

  it('a solvent career is never warned', async () => {
    const h = await harness();
    const { screen, services } = h;
    for (let i = 0; i < 5; i++) closeDayWith(h, SOLVENT);

    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText(STAKES.title)).toBeNull();
    const teaching = await services.teachingStoreForActiveSlot();
    expect(await teaching?.listTaught()).not.toContain('failure_stakes');
  });
});

describe('#394 the warning floor is the failure model’s number', () => {
  it('sits above the floor that actually ends a career', () => {
    // A warning that arrived at or below the level that ends the career would
    // arrive with no room to act on, which is the whole point of the beat. The
    // schema refuses the file outright; this states the relationship.
    expect(TUNABLES.warningCashFloor).toBeGreaterThan(TUNABLES.cashFloor);
  });

  it('the monitor owns the reading, so no surface re-derives the threshold', () => {
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

// ───────────────────────────────────────────────────────────────────────────
// Reachability + the copy-is-data guard
// ───────────────────────────────────────────────────────────────────────────

describe('the beats are reachable in the live app', () => {
  const DAY_LOOP = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'app', 'useDayLoop.ts'),
    'utf8',
  );

  it('App composition binds the catalog and mounts the card', () => {
    const src = readAppCompositionSource();
    expect(src).toMatch(/createTeachingBeatChannel</);
    expect(src).toMatch(/decls: loadTeachingBeats\(\)\.beats/);
    expect(src).toMatch(/conditions: BEAT_CONDITIONS/);
    // Wired from the composition root off the SAME cell the hints use.
    expect(src).toMatch(/hasTaught: hints\.hasTaught/);
    expect(src).toMatch(/markTaught: hints\.markTaught/);
    // And actually mounted.
    expect(src).toMatch(/<TeachingBeatCard/);
  });

  it('the facility supplies the reach — never a backstory id', () => {
    const conditions = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'app', 'teachingBeats.ts'),
      'utf8',
    );
    expect(conditions).toMatch(/creditFacility\.getFacility\(\)\.available/);
    expect(conditions).not.toMatch(/backstoryId/);
  });

  it('no beat is raised inside the day-close handler, so a bite cannot skip one', () => {
    // A warning a multi-day run could skip is a warning the player who most
    // needs it never gets. Beats ride their own bus subscriptions rather than a
    // branch in `onDayComplete`, which returns early once a bite is running —
    // so the handler must contain no raise for that return to step over.
    const start = DAY_LOOP.indexOf('const onDayComplete = () => {');
    expect(start).toBeGreaterThan(-1);
    const rest = DAY_LOOP.slice(start + 1);
    const end = rest.indexOf('\n    const on');
    expect(end).toBeGreaterThan(-1);
    const handler = rest.slice(0, end);
    expect(handler).toContain('if (biteDaysRef.current) {');
    expect(handler).not.toContain('markTaught(');
    expect(handler).not.toContain('buildTeachingBeat(');
  });

  it('the channel is disposed with the rest of the day-loop subscriptions', () => {
    expect(DAY_LOOP).toMatch(/beats\?\.dispose\(\)/);
  });
});

describe('the beat copy is data', () => {
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

  it('every declared id has copy, in presentation order', () => {
    expect(CATALOG.beats.map((b) => b.id)).toEqual([...TEACHING_BEAT_IDS]);
  });

  const fragments = CATALOG.beats
    .flatMap((b) =>
      [b.title, b.cause, b.cost, b.path, ...(b.reach ? [b.reach] : [])].map((s) =>
        s.split('{')[0].trim().slice(0, 40),
      ),
    )
    .filter((f) => f.length >= 20);

  it.each(files.map((f) => [path.relative(SRC, f), f] as const))(
    '%s inlines no beat copy',
    (_rel, file) => {
      const text = fs.readFileSync(file, 'utf8');
      const leaked = fragments.filter((f) => text.includes(f));
      expect(leaked).toEqual([]);
    },
  );
});
