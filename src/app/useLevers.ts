import { useRef, useState } from 'react';
import type { World } from '../createWorld';
import {
  resolveTradePolicyMultiplier,
  resolveFniPostureMarkupPts,
} from '../game/DealEngine';
import {
  HOURS_OF_OP,
  TRADE_POLICY,
  FNI_POSTURE,
  PRICING_STRATEGIES,
  DEFAULT_HIRING_ROLE_ID,
  DEFAULT_SOURCING_LEAN,
} from './config';
import type { SourcingLean } from '../game/MarketEconomy';
import type { HintId } from './hints';

export interface LeversDeps {
  worldRef: React.MutableRefObject<World | null>;
  /** Merge-with-existing persist of the current save (from useSaveSlots). */
  persistCurrentSave: (overrides?: import('../game/SaveStore').SaveState) => void;
  bump: () => void;
  /**
   * The player moved a dial that carries a consequence hint (#386) — retire it.
   *
   * It hangs off the handler rather than off the control because "used" means
   * the lever actually changed, which is a fact this hook owns and the surface
   * only reports. That also keeps every future caller of a handler (a coachmark,
   * a beat, a fixture) teaching the same thing as a tap does.
   */
  onControlUsed?: (id: HintId) => void;
}

export interface Levers {
  hoursOfOpId: string;
  setHoursOfOpId: (id: string) => void;
  hoursOfOpIdRef: React.MutableRefObject<string>;
  tradePolicyId: string;
  setTradePolicyId: (id: string) => void;
  tradePolicyIdRef: React.MutableRefObject<string>;
  fniPostureId: string;
  setFniPostureId: (id: string) => void;
  fniPostureIdRef: React.MutableRefObject<string>;
  pricingStrategyId: string;
  setPricingStrategyId: (id: string) => void;
  pricingStrategyIdRef: React.MutableRefObject<string>;
  getPricingStrategy: () => string;
  sourcingLean: SourcingLean;
  setSourcingLean: (lean: SourcingLean) => void;
  sourcingLeanRef: React.MutableRefObject<SourcingLean>;
  getSourcingLean: () => SourcingLean;
  handleSetSourcingLean: (lean: SourcingLean) => void;
  selectedHiringRoleId: string;
  setSelectedHiringRoleId: (id: string) => void;
  /** Live getters handed to createWorld so a mid-game change applies without
   *  rebuilding the world. */
  getHoursOfOpTicksPerDay: () => number;
  getTradePolicyMultiplier: () => number;
  getFniPostureMarkupPts: () => number;
  /** The standing posture's id (#373) — what the month verdict names it by. */
  getFniPostureId: () => string;
  handleSelectTradePolicy: (id: string) => void;
  handleSelectFniPosture: (id: string) => void;
  handleSelectAdvertisingCampaign: (id: string) => void;
  handleSelectPricingStrategy: (id: string) => void;
  handleSelectHours: (id: string) => void;
}

// The per-slot ownership levers (#120/#154/#172/#207). Each lever's chosen id
// persists per save slot and feeds either a live getter handed to createWorld
// (hours, trade policy) or a per-render read (pricing strategy, hiring role).
// Selection handlers merge-with-existing into the active slot via the injected
// persistCurrentSave so the character/seed blob is preserved.
export function useLevers({
  worldRef,
  persistCurrentSave,
  bump,
  onControlUsed,
}: LeversDeps): Levers {
  // Hours-of-op lever selection (#120/#207). The ref keeps the getter reading
  // the current selection without rebuilding the world; the lever is greyed
  // during FLOOR_OPEN, so the value is stable for the whole day.
  const [hoursOfOpId, setHoursOfOpId] = useState(HOURS_OF_OP.defaultId);
  const hoursOfOpIdRef = useRef(HOURS_OF_OP.defaultId);
  hoursOfOpIdRef.current = hoursOfOpId;
  const getHoursOfOpTicksPerDay = () => {
    const opt = HOURS_OF_OP.options.find((o) => o.id === hoursOfOpIdRef.current);
    return (opt ?? HOURS_OF_OP.options[0]).ticksPerDay;
  };
  // Per-slot trade-acquisition policy (#172). The ref feeds the live getter
  // handed to createWorld so a mid-game change applies on the next trade.
  const [tradePolicyId, setTradePolicyId] = useState(TRADE_POLICY.defaultId);
  const tradePolicyIdRef = useRef(TRADE_POLICY.defaultId);
  tradePolicyIdRef.current = tradePolicyId;
  const getTradePolicyMultiplier = () =>
    resolveTradePolicyMultiplier(tradePolicyIdRef.current, TRADE_POLICY);
  // Per-slot F&I posture (#366) — the store's standing instruction to the
  // finance desk. The ref feeds the live getter handed to createWorld so a
  // mid-game change applies on the next deal; the desk only acts on it once an
  // f&i-manager is on staff (grill Q2), which DealEngine decides, not this hook.
  const [fniPostureId, setFniPostureId] = useState(FNI_POSTURE.defaultId);
  const fniPostureIdRef = useRef(FNI_POSTURE.defaultId);
  fniPostureIdRef.current = fniPostureId;
  const getFniPostureMarkupPts = () =>
    resolveFniPostureMarkupPts(fniPostureIdRef.current, FNI_POSTURE);
  // #373: the same ref read as an id, for the month verdict that names the
  // posture the month was written at. Off the ref, not the state, so a month
  // closing inside the same tick as a dial change reports what was standing.
  const getFniPostureId = () => fniPostureIdRef.current;
  // Per-slot list-price strategy (#154). Drives the pricing screen suggestion
  // and — once a UCM is on staff (#285) — the standing auto-pricing policy. The
  // ref feeds the live getter handed to createWorld so a mid-game toggle change
  // applies to the next acquisition without rebuilding the world.
  const [pricingStrategyId, setPricingStrategyId] = useState(
    PRICING_STRATEGIES.defaultStrategy,
  );
  const pricingStrategyIdRef = useRef(PRICING_STRATEGIES.defaultStrategy);
  pricingStrategyIdRef.current = pricingStrategyId;
  const getPricingStrategy = () => pricingStrategyIdRef.current;
  // Per-slot UCM sourcing lean (#293, channel-desk M6). The ref feeds the live
  // getter handed to createWorld so a mid-game dial change applies on the next
  // day's board scan without rebuilding the world. The dial UI is the mockup
  // pass; the lean still round-trips through the save from now on.
  const [sourcingLean, setSourcingLean] = useState<SourcingLean>(
    DEFAULT_SOURCING_LEAN,
  );
  const sourcingLeanRef = useRef<SourcingLean>(DEFAULT_SOURCING_LEAN);
  sourcingLeanRef.current = sourcingLean;
  const getSourcingLean = () => sourcingLeanRef.current;
  const [selectedHiringRoleId, setSelectedHiringRoleId] = useState(
    DEFAULT_HIRING_ROLE_ID,
  );

  // Persist the trade-policy choice into the active slot (#172). The ref
  // updates immediately so the live multiplier getter reflects the new policy
  // before the persist resolves.
  const handleSelectTradePolicy = (id: string) => {
    tradePolicyIdRef.current = id;
    setTradePolicyId(id);
    persistCurrentSave({ tradePolicy: id });
    onControlUsed?.('trade_policy');
  };

  // Persist the F&I posture into the active slot (#366) — one id beside the
  // sibling levers, never world-snapshot state (grill I7). The ref updates
  // immediately so the live markup getter reflects the new posture before the
  // persist resolves; the next financed deal is quoted at it.
  const handleSelectFniPosture = (id: string) => {
    fniPostureIdRef.current = id;
    setFniPostureId(id);
    persistCurrentSave({ fniPosture: id });
    onControlUsed?.('fni_posture');
  };

  const handleSelectAdvertisingCampaign = (id: string) => {
    const w = worldRef.current;
    if (!w) return;
    w.demandControls.setAdvertisingCampaign(id);
    bump();
    persistCurrentSave();
  };

  // Persist the list-price strategy choice into the active slot (#154). The ref
  // updates immediately so the live policy getter reflects the new posture
  // before the persist resolves (#285).
  const handleSelectPricingStrategy = (id: string) => {
    pricingStrategyIdRef.current = id;
    setPricingStrategyId(id);
    persistCurrentSave({ pricingStrategy: id });
    onControlUsed?.('pricing_strategy');
  };

  const handleSelectHours = (id: string) => {
    setHoursOfOpId(id);
    persistCurrentSave({ hoursOfOp: id });
  };

  // Persist the sourcing lean into the active slot (#293). The ref updates
  // immediately so the live getter reflects the new lean before the persist
  // resolves — the next board scan auto-buys to it.
  const handleSetSourcingLean = (lean: SourcingLean) => {
    sourcingLeanRef.current = lean;
    setSourcingLean(lean);
    persistCurrentSave({ sourcingLean: lean });
  };

  return {
    hoursOfOpId,
    setHoursOfOpId,
    hoursOfOpIdRef,
    tradePolicyId,
    setTradePolicyId,
    tradePolicyIdRef,
    fniPostureId,
    setFniPostureId,
    fniPostureIdRef,
    pricingStrategyId,
    setPricingStrategyId,
    pricingStrategyIdRef,
    getPricingStrategy,
    sourcingLean,
    setSourcingLean,
    sourcingLeanRef,
    getSourcingLean,
    handleSetSourcingLean,
    selectedHiringRoleId,
    setSelectedHiringRoleId,
    getHoursOfOpTicksPerDay,
    getTradePolicyMultiplier,
    getFniPostureMarkupPts,
    getFniPostureId,
    handleSelectTradePolicy,
    handleSelectFniPosture,
    handleSelectAdvertisingCampaign,
    handleSelectPricingStrategy,
    handleSelectHours,
  };
}
