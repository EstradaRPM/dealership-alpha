import { useRef, useState } from 'react';
import type { World } from '../createWorld';
import { resolveTradePolicyMultiplier } from '../game/DealEngine';
import {
  HOURS_OF_OP,
  TRADE_POLICY,
  PRICING_STRATEGIES,
  DEFAULT_HIRING_ROLE_ID,
} from './config';

export interface LeversDeps {
  worldRef: React.MutableRefObject<World | null>;
  /** Merge-with-existing persist of the current save (from useSaveSlots). */
  persistCurrentSave: (overrides?: import('../game/SaveStore').SaveState) => void;
  bump: () => void;
}

export interface Levers {
  hoursOfOpId: string;
  setHoursOfOpId: (id: string) => void;
  hoursOfOpIdRef: React.MutableRefObject<string>;
  tradePolicyId: string;
  setTradePolicyId: (id: string) => void;
  tradePolicyIdRef: React.MutableRefObject<string>;
  pricingStrategyId: string;
  setPricingStrategyId: (id: string) => void;
  pricingStrategyIdRef: React.MutableRefObject<string>;
  getPricingStrategy: () => string;
  selectedHiringRoleId: string;
  setSelectedHiringRoleId: (id: string) => void;
  /** Live getters handed to createWorld so a mid-game change applies without
   *  rebuilding the world. */
  getHoursOfOpTicksPerDay: () => number;
  getTradePolicyMultiplier: () => number;
  handleSelectTradePolicy: (id: string) => void;
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
  };

  const handleSelectHours = (id: string) => {
    setHoursOfOpId(id);
    persistCurrentSave({ hoursOfOp: id });
  };

  return {
    hoursOfOpId,
    setHoursOfOpId,
    hoursOfOpIdRef,
    tradePolicyId,
    setTradePolicyId,
    tradePolicyIdRef,
    pricingStrategyId,
    setPricingStrategyId,
    pricingStrategyIdRef,
    getPricingStrategy,
    selectedHiringRoleId,
    setSelectedHiringRoleId,
    getHoursOfOpTicksPerDay,
    getTradePolicyMultiplier,
    handleSelectTradePolicy,
    handleSelectAdvertisingCampaign,
    handleSelectPricingStrategy,
    handleSelectHours,
  };
}
