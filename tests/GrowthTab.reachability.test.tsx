import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { createEventBus } from '../src/game/EventBus';
import { createWorld, type World } from '../src/createWorld';
import { GrowthTabContainer } from '../src/app/screens/GrowthTabContainer';
import { buildHeatConsole, resolvePricingIntel, SEGMENT_LABELS } from '../src/app/config';
import { buildMarketGlance } from '../src/ui/HomeTab';
import type { DemandReadoutModel } from '../src/ui/DemandReadout';
import type { CharacterProfile } from '../src/game/CareerProgression';
import { createDefaultFacilitySnapshot } from '../src/game/Facility';
import { readAppCompositionSource } from './helpers/appComposition';

// Anti-orphan (#349): Growth was a placeholder card while the demand console
// and the tier-gate board had no room of their own. This proves the tab is
// mounted on the LIVE world, that its campaign lever writes through
// `world.demandControls`, and that the composition root actually renders it.

const PROFILE: CharacterProfile = {
  name: 'Ray Estrada',
  backstoryId: 'ex-mechanic',
  day1Modifier: {},
} as CharacterProfile;

function freshWorld(masterSeed = 349): World {
  const bus = createEventBus();
  return createWorld({ bus, masterSeed, characterProfile: PROFILE });
}

function demandModel(world: World, onSelect: (id: string) => void): DemandReadoutModel {
  const observed = world.demandShaper.getObservedMix();
  return {
    heatBands: buildHeatConsole(world, resolvePricingIntel(world)),
    entries: observed.map((e) => ({
      segment: e.segment,
      label: SEGMENT_LABELS[e.segment] ?? e.segment,
      share: e.share,
      count: e.count,
      trend: e.trend,
    })),
    totalObserved: observed.reduce((s, e) => s + e.count, 0),
    advertising: {
      options: world.demandControls.advertisingOptions.map((o) => ({
        id: o.id,
        label: o.label,
        blurb: o.blurb,
        costLabel: o.dailyCost > 0 ? `$${o.dailyCost.toLocaleString()}/day` : undefined,
      })),
      selectedId: world.demandControls.getAdvertisingCampaignId(),
      onSelect,
    },
  };
}

describe('#349 the Growth tab is mounted on the live world', () => {
  it('renders both regions off a real createWorld', () => {
    const world = freshWorld();
    const { getByTestId } = render(
      <GrowthTabContainer
        world={world}
        demandReadout={demandModel(world, () => {})}
        bump={() => {}}
        setCash={() => {}}
      />,
    );
    expect(getByTestId('growth-region-demand')).toBeTruthy();
    expect(getByTestId('growth-gate-board')).toBeTruthy();
    // T1 lights units + cash (tier-gate.json), so both faces must be spelled out.
    expect(getByTestId('gate-board-face-units')).toBeTruthy();
    expect(getByTestId('gate-board-face-cash')).toBeTruthy();
  });

  it('selecting a campaign writes through world.demandControls', () => {
    const world = freshWorld();
    const paid = world.demandControls.advertisingOptions.find((o) => o.id !== 'none');
    expect(paid).toBeTruthy();
    expect(world.demandControls.getAdvertisingCampaignId()).toBe('none');

    const { getByText } = render(
      <GrowthTabContainer
        world={world}
        demandReadout={demandModel(world, (id) =>
          world.demandControls.setAdvertisingCampaign(id),
        )}
        bump={() => {}}
        setCash={() => {}}
      />,
    );
    fireEvent.press(getByText(`${paid!.label} · $${paid!.dailyCost.toLocaleString()}/day`));
    expect(world.demandControls.getAdvertisingCampaignId()).toBe(paid!.id);
    expect(world.demandControls.getAdvertisingDailyCost()).toBe(paid!.dailyCost);
  });

  it('bills the running campaign every day off the clock', () => {
    const world = freshWorld();
    const paid = world.demandControls.advertisingOptions.find((o) => o.id !== 'none')!;
    world.demandControls.setAdvertisingCampaign(paid.id);
    const before = world.economy.cash;
    world.clock.advanceDay();
    // A lever with no price is a strictly dominant choice; the spend is what
    // makes the console's campaign section a decision. Assert the LEDGER line,
    // not the cash delta — a day carries other standing costs too.
    const billed = world.economy
      .getPnL(0, 9999)
      .entries.filter((e) => e.label === `Advertising: ${paid.id}`);
    expect(billed.map((e) => e.amount)).toEqual([paid.dailyCost]);
    expect(before - world.economy.cash).toBeGreaterThanOrEqual(paid.dailyCost);

    // Same day on an identical seed with nothing running: no advertising line.
    const idle = freshWorld();
    idle.clock.advanceDay();
    expect(
      idle.economy.getPnL(0, 9999).entries.filter((e) => /^Advertising:/.test(e.label)),
    ).toEqual([]);
  });

  it('reads the next rung off the engine, not a hand-copied table', () => {
    const world = freshWorld();
    const next = world.tierGate.getTierRequirements(2);
    expect(next).toBeTruthy();
    expect(next!.faces.map((f) => f.id)).toContain('units');
    // The board shows exactly the bars the month-end verdict grades — no more,
    // and since #360 gave the facility face a producer, no fewer. `streak` is a
    // control tunable in the same tier entry and is not a bar.
    const t3 = world.tierGate.getTierRequirements(3)!.faces.map((f) => f.id);
    expect(t3).toContain('facility');
    expect(t3).not.toContain('streak');
    // Past the top of the built ladder there is nothing to show.
    expect(world.tierGate.getTierRequirements(99)).toBeNull();
  });

  it('grades the facility face off the live Facility module (#360)', () => {
    // The face was dormant because nothing produced a score. Stand a real world
    // at T3 holding what it built at T2 — the carry-over state A2 R1 creates —
    // and the gate must read that store's actual build-out, not a constant.
    const world = freshWorld();
    world.tierManager.restoreState({
      currentTier: 3,
      businessName: 'Estrada Motors',
      accentColor: '#38bdf8',
      fontId: 'prestige',
      customersServed: 0,
    });
    world.facility.restore(createDefaultFacilitySnapshot(2));

    const face = world.tierGate.getProgress().faces.find((f) => f.id === 'facility');
    if (face?.kind !== 'stepped') throw new Error('expected the stepped facility face');
    expect(face.score).toBeCloseTo(world.facility.getFacilityScore());
    expect(face.score).toBeGreaterThan(0);
    expect(face.meetsThreshold).toBe(false);

    // Build the lot out and the face steps with it — same world, same read.
    world.facility.restore(createDefaultFacilitySnapshot(3));
    const built = world.tierGate.getProgress().faces.find((f) => f.id === 'facility');
    if (built?.kind !== 'stepped') throw new Error('expected the stepped facility face');
    expect(built.score).toBeCloseTo(100);
    expect(built.meetsThreshold).toBe(true);
  });

  it('the Home glance summarizes the same model it routes into', () => {
    const world = freshWorld();
    const paid = world.demandControls.advertisingOptions.find((o) => o.id !== 'none')!;
    world.demandControls.setAdvertisingCampaign(paid.id);
    const glance = buildMarketGlance(demandModel(world, () => {}));
    expect(glance.campaignLabel).toContain(paid.label);
    expect(glance.campaignLabel).toContain(`$${paid.dailyCost.toLocaleString()}/day`);
    expect(glance.headline).toMatch(/^Buyers want /);
  });

  // Anti-orphan (#359): construction is only a decision if the player can reach
  // the button. Driven on a REAL world so the whole seam is under test — the
  // engine's option, the model's words, the press, the cash, and the day the
  // capacity actually lands.
  it('builds capacity from the Growth tab and lands it on the completion day', () => {
    const world = freshWorld();
    // A store standing below its ceiling — the state every tier-up leaves you
    // in, since built capacity carries over and only the ceiling rises (#358).
    const ceiling = world.facility.getCeilings();
    world.facility.restore({
      schemaVersion: 2,
      built: { ...world.facility.getBuilt(), lotSpaces: ceiling.lotSpaces - 1 },
      jobs: [],
      jobSeq: 0,
    });
    const option = world.facility
      .getBuildOptions()
      .find((o) => o.kind === 'lotSpaces')!;
    expect(option.units).toBe(1);
    expect(option.refusal).toBeUndefined();

    let cash = world.economy.cash;
    const view = render(
      <GrowthTabContainer
        world={world}
        demandReadout={demandModel(world, () => {})}
        bump={() => {}}
        setCash={(n) => {
          cash = n;
        }}
      />,
    );
    expect(view.getByTestId('facility-build-built-lotSpaces').props.children).toBe(
      `${ceiling.lotSpaces - 1} of ${ceiling.lotSpaces} built`,
    );

    const before = world.economy.cash;
    fireEvent.press(view.getByTestId('facility-build-lotSpaces'));

    // Cash left now; the capacity has not arrived.
    expect(world.economy.cash).toBe(before - option.cost);
    expect(cash).toBe(world.economy.cash);
    expect(world.facility.getBuilt().lotSpaces).toBe(ceiling.lotSpaces - 1);
    const [job] = world.facility.getJobs();
    expect(job.completesOnDay).toBe(world.clock.currentDay + option.days);
    // The container reads the live world each render, so the job in flight is
    // on the surface the moment it is re-rendered — that is what `bump` is for.
    view.rerender(
      <GrowthTabContainer
        world={world}
        demandReadout={demandModel(world, () => {})}
        bump={() => {}}
        setCash={() => {}}
      />,
    );
    expect(view.getByTestId(`facility-build-job-${job.id}`)).toBeTruthy();

    // And it opens on the morning it was sold for.
    for (let i = 0; i < option.days; i++) world.clock.advanceDay();
    expect(world.facility.getBuilt().lotSpaces).toBe(ceiling.lotSpaces);
    expect(world.facility.getJobs()).toEqual([]);
  });

  it('is wired into the composition root', () => {
    const src = readAppCompositionSource();
    // Growth is no longer the null that falls back to the placeholder card.
    expect(src).toMatch(/growth: \(\s*<GrowthTabContainer/);
    expect(src).not.toMatch(/growth: null/);
    // Home's glance routes into it (locked IA rule 4).
    expect(src).toMatch(/onOpenGrowth=\{\(\) => tabs\.setActiveTab\('growth'\)\}/);
    expect(src).toMatch(/marketGlance=\{buildMarketGlance\(demandReadout\)\}/);
  });
});
