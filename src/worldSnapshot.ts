/**
 * World-serialization seam (#188, parent #186).
 *
 * The composition-root half of save/load: `snapshotWorld` collects each
 * stateful module's own `snapshot()` into one serializable `WorldSnapshot`;
 * `restoreWorld` fans the pieces back out via each module's `restore()`. No
 * module touches storage — SaveStore stays the sole gateway and the App
 * persists/loads the blob this returns.
 *
 * ─── CONTRACT (locked by the #188 HITL gate; every later #186 slice conforms) ──
 *  - The envelope is `{ version, modules }`. `version` versions the *envelope
 *    shape* (which module keys exist + how they nest); #196 owns its migrations.
 *  - `modules` is keyed by module name. Each value is that module's own
 *    self-versioned snapshot (its `schemaVersion`), so a module can evolve its
 *    blob without bumping the envelope. This mirrors the shape MarketEconomy's
 *    `compHistory`/`shocks` already use.
 *  - A fan-out slice adds exactly one `modules` key + one line in each of
 *    `snapshotWorld`/`restoreWorld`. Nothing else changes.
 *  - `restoreWorld` rehydrates onto a *freshly-created* World (same seed): the
 *    World is built first (modules wire their bus subscriptions), then state is
 *    overwritten in place. It never re-runs the seed→Day-1 rebuild.
 *
 * This tracer wires only the two smallest stateful values — `GameClock.day`
 * and `Economy.cash` — to prove the whole pipe end to end.
 */
import type { World } from './createWorld';
import type { GameClockSnapshot } from './game/GameClock';
import type { EconomySnapshot } from './game/Economy';
import type { InventorySnapshot } from './game/Inventory';
import type { StaffOrgSnapshot } from './game/StaffOrg';
import type { StaffMoraleSnapshot } from './game/StaffMorale';

/** Envelope-shape version. Bumped only when module keys are added/restructured
 *  in a way that needs migration (#196), not when a module bumps its own
 *  `schemaVersion`. */
export const WORLD_SNAPSHOT_VERSION = 1;

export interface WorldSnapshot {
  readonly version: number;
  readonly modules: {
    readonly gameClock: GameClockSnapshot;
    readonly economy: EconomySnapshot;
    readonly inventory: InventorySnapshot;
    readonly staffOrg: StaffOrgSnapshot;
    readonly staffMorale: StaffMoraleSnapshot;
    // Later #186 slices add keys here (reputation, marketEconomy, …)
    // — each a module's own self-versioned snapshot.
  };
}

export function snapshotWorld(world: World): WorldSnapshot {
  return {
    version: WORLD_SNAPSHOT_VERSION,
    modules: {
      gameClock: world.clock.snapshot(),
      economy: world.economy.snapshot(),
      inventory: world.inventory.snapshot(),
      staffOrg: world.staffOrg.snapshot(),
      staffMorale: world.staffMorale.snapshot(),
    },
  };
}

export function restoreWorld(snap: WorldSnapshot, world: World): void {
  world.clock.restore(snap.modules.gameClock);
  world.economy.restore(snap.modules.economy);
  world.inventory.restore(snap.modules.inventory);
  // StaffOrg roster restores first so StaffMorale rehydrates onto the same ids.
  world.staffOrg.restore(snap.modules.staffOrg);
  world.staffMorale.restore(snap.modules.staffMorale);
}
