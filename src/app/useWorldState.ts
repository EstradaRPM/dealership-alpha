import { useEffect, useRef, useState } from 'react';
import type { EventBus } from '../game/EventBus';
import { makeSeed, type World } from '../createWorld';
import type { LotVehicle } from '../game/Inventory';
import type { CharacterProfile } from '../game/CareerProgression';
import type { FloorEvent } from '../ui/FloorDashboard';

export interface WorldState {
  world: World | null;
  setWorld: (w: World | null) => void;
  /** Latest world for bus handlers / listeners whose effects mount once. */
  worldRef: React.MutableRefObject<World | null>;
  cash: number;
  setCash: (n: number) => void;
  lotVehicles: readonly LotVehicle[];
  setLotVehicles: (v: readonly LotVehicle[]) => void;
  floorEvents: readonly FloorEvent[];
  setFloorEvents: React.Dispatch<React.SetStateAction<readonly FloorEvent[]>>;
  /** Monotonic key source for floor-event rows. */
  eventSeq: React.MutableRefObject<number>;
  profile: CharacterProfile | null;
  setProfile: (p: CharacterProfile | null) => void;
  /** Fresh root RNG seed for the next brand-new game (#96). */
  newGameSeed: number;
  setNewGameSeed: (n: number) => void;
  /** Force a re-render for headless DayLoopController lifecycle changes. */
  bump: () => void;
}

// The live-world facts cluster (#242). Owns the World instance + the primitives
// the UI reads off it every render (cash, lot, floor-event log), plus the
// pure-world EventBus subscriptions that keep those in sync. The day-cycle
// accumulators (gross / match tally / recap) live in useDayLoop, which writes
// back through the setters this hook exposes.
export function useWorldState(bus: EventBus): WorldState {
  const [profile, setProfile] = useState<CharacterProfile | null>(null);
  // Fresh root RNG seed (#96) for the next brand-new game. Re-minted each time
  // the player starts a New Game from the menu, so two new games created in one
  // app session don't clone the same world. CharacterCreation persists it into
  // the active slot; an existing save ignores it and rebuilds from its own seed.
  const [newGameSeed, setNewGameSeed] = useState(makeSeed);
  // The seed-dependent composition root (#96). Null until the per-save
  // masterSeed is resolved — from the persisted save on load, or the fresh
  // newGameSeed at character creation. Built exactly once per game.
  const [world, setWorld] = useState<World | null>(null);
  // Latest world for bus handlers / AppState listener (their effects mount
  // once with [] before the world exists).
  const worldRef = useRef<World | null>(null);
  worldRef.current = world;
  const [lotVehicles, setLotVehicles] = useState<readonly LotVehicle[]>([]);
  const [cash, setCash] = useState(0);
  const [floorEvents, setFloorEvents] = useState<readonly FloorEvent[]>([]);
  const eventSeq = useRef(0);
  const [, setTick] = useState(0);
  const bump = () => setTick((n) => n + 1);

  // Auction-relevant + revenue state stays in sync with the EventBus. These are
  // the pure-world subscriptions (no day-cycle accumulation); the day-cycle and
  // escalation subscriptions live in useDayLoop / useModals.
  useEffect(() => {
    const onVehiclePurchased = () => {
      const w = worldRef.current;
      if (!w) return;
      setLotVehicles(w.inventory.getLotVehicles());
      setCash(w.economy.cash);
    };
    const onVehicleSold = () => {
      const w = worldRef.current;
      if (w) setLotVehicles(w.inventory.getLotVehicles());
    };
    const onRevenue = () => {
      const w = worldRef.current;
      if (w) setCash(w.economy.cash);
    };
    // Manager-status card (#325) reactivity: the delegated-authority read-model
    // is rebuilt from `world` each render, so a force-update re-derives it. Roster
    // changes (hire/fire/promote) can add/remove a manager; the day boundary is
    // when grown effectiveSkills step (channel-desk M7) and thus when a gate can
    // cross without any roster change — recompute-on-day-boundary, no polling.
    const onManagerStateChange = () => setTick((n) => n + 1);
    // Recovery-banner (#326) resolution reactivity: the banner is re-derived
    // from the live monitor state each render, so a force-update refreshes it
    // when a recovery state CLEARS — the license suspension lifting or a weekly
    // debt payment paying the overhang down (possibly to 0). The onset events
    // already re-render via the recovery-beat queue; the day boundary is covered
    // by clock:day_started above.
    const onRecoveryStateChange = () => setTick((n) => n + 1);
    bus.subscribe('inventory:vehicle_purchased', onVehiclePurchased);
    bus.subscribe('inventory:vehicle_acquired_via_trade', onVehiclePurchased);
    bus.subscribe('inventory:vehicle_sold', onVehicleSold);
    bus.subscribe('economy:revenue_posted', onRevenue);
    bus.subscribe('staff:hired', onManagerStateChange);
    bus.subscribe('staff:fired', onManagerStateChange);
    bus.subscribe('staff:promoted', onManagerStateChange);
    bus.subscribe('clock:day_started', onManagerStateChange);
    bus.subscribe('regulatory:suspension_lifted', onRecoveryStateChange);
    bus.subscribe('career:debt_payment_made', onRecoveryStateChange);
    return () => {
      bus.unsubscribe('inventory:vehicle_purchased', onVehiclePurchased);
      bus.unsubscribe('inventory:vehicle_acquired_via_trade', onVehiclePurchased);
      bus.unsubscribe('inventory:vehicle_sold', onVehicleSold);
      bus.unsubscribe('economy:revenue_posted', onRevenue);
      bus.unsubscribe('staff:hired', onManagerStateChange);
      bus.unsubscribe('staff:fired', onManagerStateChange);
      bus.unsubscribe('staff:promoted', onManagerStateChange);
      bus.unsubscribe('clock:day_started', onManagerStateChange);
      bus.unsubscribe('regulatory:suspension_lifted', onRecoveryStateChange);
      bus.unsubscribe('career:debt_payment_made', onRecoveryStateChange);
    };
  }, []);

  return {
    world,
    setWorld,
    worldRef,
    cash,
    setCash,
    lotVehicles,
    setLotVehicles,
    floorEvents,
    setFloorEvents,
    eventSeq,
    profile,
    setProfile,
    newGameSeed,
    setNewGameSeed,
    bump,
  };
}
