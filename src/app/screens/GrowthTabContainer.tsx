import React from 'react';
import type { World } from '../../createWorld';
import type { DemandReadoutModel } from '../../ui/DemandReadout';
import { GrowthTab, buildGateBoard, buildFacilityBuild } from '../../ui/GrowthTab';
import { buildIndustryWire, buildWeeklyReport, buildFinanceMix } from '../config';
import type { Hints } from '../useHints';

export interface GrowthTabContainerProps {
  world: World;
  /**
   * The demand console's read model. Built in the composition root rather than
   * here because its advertising lever is one of `useLevers`' persisted
   * selections — the same handler the rest of the pre-open levers run through.
   */
  demandReadout: DemandReadoutModel;
  /** The teaching cluster (#386/#388) — resolved here, marked on each write. */
  hints: Hints;
  /** Force a re-render after a world write the EventBus doesn't announce. */
  bump: () => void;
  /**
   * Sync the shell's cash mirror after a world write that spends (#359) — the
   * same prop `PeopleTabContainer` takes for hiring, and for the same reason.
   */
  setCash: (n: number) => void;
}

/**
 * Growth's composition seam (#349). Reads the live world each render — no memo,
 * no local state — and hands `GrowthTab` fully-formatted models, exactly the
 * shape `PeopleTabContainer` established.
 *
 * The gate board's climb reads the tier ABOVE the current one off
 * `tierGate.getTierRequirements`; `null` there (top of the built ladder) simply
 * drops the climb section rather than rendering an empty tease (IA rule 3).
 */
export function GrowthTabContainer({
  world,
  demandReadout,
  hints,
  bump,
  setCash,
}: GrowthTabContainerProps) {
  const progress = world.tierGate.getProgress();
  const gateBoard = buildGateBoard(
    progress,
    world.tierGate.getTierRequirements(progress.tier + 1),
    {
      current: world.tierManager.monthStreak,
      required: world.tierManager.requiredStreak,
      dossierReady: world.tierManager.dossierReady,
    },
  );
  return (
    <GrowthTab
      demandReadout={demandReadout}
      weeklyReport={buildWeeklyReport(world)}
      industryWire={buildIndustryWire(world)}
      financeMix={buildFinanceMix(world)}
      onToggleSubscription={(id, on) => {
        // #178: a standing subscription is world state (persisted, billed
        // daily), so the toggle writes through the module and the shell
        // re-renders off the same `bump` the wire's publish uses.
        world.marketIntel.setSubscribed(id, on);
        hints.markUsed('wire_subscription');
        bump();
      }}
      subscriptionHint={hints.hintFor('wire_subscription')}
      facilityBuildHint={hints.hintFor('facility_build')}
      gateBoard={gateBoard}
      facilityBuild={buildFacilityBuild(world.facility.getBuildOptions())}
      onBuildFacility={(kind) => {
        // #359: the engine owns every rule the button could get wrong — the
        // ceiling, the price, whether the cash is there — so this commits and
        // re-reads rather than guarding first. A refusal simply changes nothing.
        world.facility.build(kind);
        hints.markUsed('facility_build');
        setCash(world.economy.cash);
        bump();
      }}
    />
  );
}
