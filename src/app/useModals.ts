import { useEffect, useState } from 'react';
import type { EventBus } from '../game/EventBus';
import type { World } from '../createWorld';
import type { LotVehicle } from '../game/Inventory';
import type { HandPlaySession, AdvanceResult } from '../game/FloorSim';
import type { TradeDecision, TradeReview } from '../ui/TradeEscalationModal';
import type {
  DiscountDecision,
  DiscountReview,
} from '../ui/DiscountEscalationModal';

interface CounterResult {
  readonly amount: number;
  readonly accepted: boolean;
}

export interface ModalsDeps {
  bus: EventBus;
  /** Live world for grab/cherry-pick gating (read each call). */
  world: World | null;
  worldRef: React.MutableRefObject<World | null>;
  setLotVehicles: (v: readonly LotVehicle[]) => void;
  setCash: (n: number) => void;
  bump: () => void;
}

export interface Modals {
  handSession: HandPlaySession | null;
  handResult: AdvanceResult | null;
  tradeReview: TradeReview | null;
  tradeCounterResult: CounterResult | null;
  discountReview: DiscountReview | null;
  discountCounterResult: CounterResult | null;
  openHandPlay: (customerId: string) => void;
  cherryPick: () => void;
  chooseApproach: (choiceId: string) => void;
  closeHandPlay: () => void;
  decideTrade: (decision: TradeDecision) => void;
  decideDiscount: (decision: DiscountDecision) => void;
  /** Reset all latched modal/escalation state (session teardown). */
  reset: () => void;
}

// The interrupt-modal cluster (#242): the player-facing spotlights the
// composition root latches over the floor — hand-play (#118) and the
// trade/discount escalation reviews (#172/#175). Owns the escalation
// subscriptions; mutating handlers write lot/cash back through the injected
// world-state setters.
export function useModals({
  bus,
  world,
  worldRef,
  setLotVehicles,
  setCash,
  bump,
}: ModalsDeps): Modals {
  // Hand-play spotlight (#118). The composition root owns the grabbed
  // FloorSim session; the modal is a thin view that renders the pending gate
  // and dispatches the picked approach back through advance().
  const [handSession, setHandSession] = useState<HandPlaySession | null>(null);
  const [handResult, setHandResult] = useState<AdvanceResult | null>(null);
  const [tradeReview, setTradeReview] = useState<TradeReview | null>(null);
  const [tradeCounterResult, setTradeCounterResult] =
    useState<CounterResult | null>(null);
  const [discountReview, setDiscountReview] = useState<DiscountReview | null>(
    null,
  );
  const [discountCounterResult, setDiscountCounterResult] =
    useState<CounterResult | null>(null);

  // Open the modal on a specific grabbable customer (forced-exception row or
  // a cherry-pick the composition root already selected). When not running
  // live, the day is already idle here (the render loop is #121) — auto-pause
  // is the default and holds until the player resumes.
  const openHandPlay = (customerId: string) => {
    const f = world?.dayLoop.currentFloor();
    if (!f || !f.canGrab()) return;
    setHandSession(f.grab(customerId));
    setHandResult(null);
  };
  const cherryPick = () => {
    const f = world?.dayLoop.currentFloor();
    if (!f || !f.canGrab()) return;
    const next = f.grabbableCustomers()[0];
    if (next) openHandPlay(next.id);
  };
  const chooseApproach = (choiceId: string) => {
    if (!handSession) return;
    // advance() burns handPlay.tickCostPerGate deterministic ticks inside
    // FloorSim regardless of pause state; the clock jumps on resume.
    const r = handSession.advance(choiceId);
    setHandResult(r.status === 'continue' ? null : r);
    bump();
  };
  const closeHandPlay = () => {
    setHandSession(null);
    setHandResult(null);
  };
  const decideTrade = (decision: TradeDecision) => {
    if (!tradeReview) return;
    const result = worldRef.current?.resolvePlayerTradeDecision(
      tradeReview.customerId,
      decision,
    );
    if (!result) return;
    if (result.status === 'counter_rejected') {
      setTradeCounterResult({
        amount: result.amount,
        accepted: result.accepted,
      });
      return;
    }
    setTradeReview(null);
    setTradeCounterResult(null);
    const w = worldRef.current;
    if (w) {
      setLotVehicles(w.inventory.getLotVehicles());
      setCash(w.economy.cash);
    }
    bump();
  };
  const decideDiscount = (decision: DiscountDecision) => {
    if (!discountReview) return;
    const result = worldRef.current?.resolvePlayerDiscountDecision(
      discountReview.customerId,
      decision,
    );
    if (!result) return;
    if (result.status === 'counter_rejected') {
      setDiscountCounterResult({
        amount: result.amount,
        accepted: result.accepted,
      });
      return;
    }
    setDiscountReview(null);
    setDiscountCounterResult(null);
    const w = worldRef.current;
    if (w) {
      setLotVehicles(w.inventory.getLotVehicles());
      setCash(w.economy.cash);
    }
    bump();
  };

  const reset = () => {
    setHandSession(null);
    setHandResult(null);
    setTradeReview(null);
    setTradeCounterResult(null);
    setDiscountReview(null);
    setDiscountCounterResult(null);
  };

  useEffect(() => {
    const onTradeEscalated = ({
      customerId,
      currentVehicle,
      book,
      allowanceAsk,
      payoff,
      target,
      recommendedCounter,
      staffConfidence,
    }: {
      customerId: string;
      currentVehicle: TradeReview['currentVehicle'];
      book: number;
      allowanceAsk: number;
      payoff: number;
      target: number;
      recommendedCounter: number;
      staffConfidence: number;
    }) => {
      setTradeCounterResult(null);
      setTradeReview({
        customerId,
        currentVehicle,
        book,
        allowanceAsk,
        payoff,
        target,
        recommendedCounter,
        staffConfidence,
      });
    };

    const onDiscountEscalated = ({
      customerId,
      vehicle,
      marketPrice,
      customerAskPrice,
      salespersonFloorPrice,
      recommendedCounter,
      minimumAcceptablePrice,
      frontGrossAtFloor,
      canAcceptAsk,
    }: {
      customerId: string;
      vehicle: DiscountReview['vehicle'];
      marketPrice: number;
      customerAskPrice: number;
      salespersonFloorPrice: number;
      recommendedCounter: number;
      minimumAcceptablePrice: number;
      frontGrossAtFloor: number;
      canAcceptAsk: boolean;
    }) => {
      setDiscountCounterResult(null);
      setDiscountReview({
        customerId,
        vehicle,
        marketPrice,
        customerAskPrice,
        salespersonFloorPrice,
        recommendedCounter,
        minimumAcceptablePrice,
        frontGrossAtFloor,
        canAcceptAsk,
      });
    };

    bus.subscribe('trade:escalated', onTradeEscalated);
    bus.subscribe('discount:escalated', onDiscountEscalated);
    return () => {
      bus.unsubscribe('trade:escalated', onTradeEscalated);
      bus.unsubscribe('discount:escalated', onDiscountEscalated);
    };
  }, []);

  return {
    handSession,
    handResult,
    tradeReview,
    tradeCounterResult,
    discountReview,
    discountCounterResult,
    openHandPlay,
    cherryPick,
    chooseApproach,
    closeHandPlay,
    decideTrade,
    decideDiscount,
    reset,
  };
}
