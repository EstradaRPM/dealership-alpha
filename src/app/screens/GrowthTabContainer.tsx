import React from 'react';
import type { World } from '../../createWorld';
import type { DemandReadoutModel } from '../../ui/DemandReadout';
import { GrowthTab, buildGateBoard } from '../../ui/GrowthTab';
import { buildIndustryWire, buildWeeklyReport } from '../config';

export interface GrowthTabContainerProps {
  world: World;
  /**
   * The demand console's read model. Built in the composition root rather than
   * here because its advertising lever is one of `useLevers`' persisted
   * selections — the same handler the rest of the pre-open levers run through.
   */
  demandReadout: DemandReadoutModel;
  /** Force a re-render after a world write the EventBus doesn't announce. */
  bump: () => void;
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
export function GrowthTabContainer({ world, demandReadout, bump }: GrowthTabContainerProps) {
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
      onToggleSubscription={(id, on) => {
        // #178: a standing subscription is world state (persisted, billed
        // daily), so the toggle writes through the module and the shell
        // re-renders off the same `bump` the wire's publish uses.
        world.marketIntel.setSubscribed(id, on);
        bump();
      }}
      gateBoard={gateBoard}
    />
  );
}
