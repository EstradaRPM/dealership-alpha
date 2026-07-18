import { createEventBus } from '../src/game/EventBus';
import { createWorld } from '../src/createWorld';
import { buildRecoveryBanners } from '../src/app/config';
import { readAppCompositionSource } from './helpers/appComposition';
import type { CharacterProfile } from '../src/game/CareerProgression';

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

// Drive a live Tier 2 bankruptcy contraction: force the store to Tier 2, push
// cash below the floor, then run the overnight tick past the consecutive-day
// trigger. cashFloor=0 / consecutiveDaysToTrigger=7 (data/failure-tunables.json).
function driveBankruptcyContraction(world: ReturnType<typeof createWorld>, bus: ReturnType<typeof createEventBus>) {
  const tierState = world.tierManager.getSerializableState();
  world.tierManager.restoreState({ ...tierState, currentTier: 2 });
  // Empty the till so every overnight reads as insolvent.
  world.economy.forceDebit(world.economy.cash + 10000, 'test: force insolvency');
  for (let day = 1; day <= 7; day++) {
    bus.publish('clock:overnight_payroll', { day });
  }
}

describe('#326 recovery surfacing — a live contraction raises the persisted banner', () => {
  it('starts clean: no recovery state, no banner', () => {
    const bus = createEventBus();
    const world = createWorld({ bus, masterSeed: 326, characterProfile: PROFILE });
    expect(world.bankruptcyMonitor.outstandingDebt).toBe(0);
    expect(buildRecoveryBanners(world)).toEqual([]);
  });

  it('fires the contraction event and the monitor state drives a debt-overhang banner', () => {
    const bus = createEventBus();
    const world = createWorld({ bus, masterSeed: 326, characterProfile: PROFILE });

    let contractionPayload: { fromTier: number; debtPrincipal: number } | null = null;
    bus.subscribe('career:bankruptcy_contraction', (p) => {
      contractionPayload = p;
    });

    // Before: Tier 2, solvent-banner clear.
    expect(buildRecoveryBanners(world)).toEqual([]);

    driveBankruptcyContraction(world, bus);

    // The survivable contraction event fired (NOT the terminal ending).
    expect(contractionPayload).not.toBeNull();
    expect(contractionPayload!.fromTier).toBe(2);
    expect(contractionPayload!.debtPrincipal).toBeGreaterThan(0);

    // Tier dropped, debt overhang persisted on the monitor.
    expect(world.tierManager.currentTier).toBe(1);
    expect(world.bankruptcyMonitor.outstandingDebt).toBeGreaterThan(0);

    // The banner the UI pins is derived from that persisted state.
    const banners = buildRecoveryBanners(world);
    expect(banners).toHaveLength(1);
    expect(banners[0].kind).toBe('debt-overhang');
    expect(banners[0].detail).toContain('$');
  });

  it('the banner survives a save/load round-trip (derives from persisted monitor state)', () => {
    const bus = createEventBus();
    const world = createWorld({ bus, masterSeed: 326, characterProfile: PROFILE });
    driveBankruptcyContraction(world, bus);
    expect(buildRecoveryBanners(world)).toHaveLength(1);

    // Rebuild a fresh world and restore only the persisted monitor blob — the
    // banner must reappear from that state alone.
    const bus2 = createEventBus();
    const restored = createWorld({ bus: bus2, masterSeed: 326, characterProfile: PROFILE });
    restored.bankruptcyMonitor.restoreState(world.bankruptcyMonitor.getSerializableState());
    const banners = buildRecoveryBanners(restored);
    expect(banners).toHaveLength(1);
    expect(banners[0].kind).toBe('debt-overhang');
  });

  it('is wired into the app composition (beat queue + banner + all four events)', () => {
    const src = readAppCompositionSource();
    // The persistent banner is built off the world and passed to the shell.
    expect(src).toMatch(/buildRecoveryBanners\(world\)/);
    expect(src).toMatch(/banner=\{/);
    // The beat card drains the non-terminal recovery queue.
    expect(src).toMatch(/RecoveryBeatCard/);
    expect(src).toMatch(/recoveryQueue/);
    // All four recovery events feed the beat queue.
    expect(src).toMatch(/career:bankruptcy_contraction/);
    expect(src).toMatch(/career:indictment_contraction/);
    expect(src).toMatch(/regulatory:ag_complaint_contraction/);
    expect(src).toMatch(/regulatory:ag_complaint_consent_decree/);
  });
});
