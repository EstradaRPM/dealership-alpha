import { useEffect, useState } from 'react';
import type { EventBus } from '../game/EventBus';
import type { World } from '../createWorld';
import type { LotVehicle } from '../game/Inventory';
import type {
  TradeDecision,
  TradeReview,
  TradeOutcome,
} from '../ui/TradeEscalationModal';
import type {
  DiscountDecision,
  DiscountReview,
  DiscountOutcome,
} from '../ui/DiscountEscalationModal';

interface CounterResult {
  readonly amount: number;
  readonly accepted: boolean;
  /** Discount-event only: counters the customer will still hear before walking. */
  readonly attemptsRemaining?: number;
  /** Discount-event only: acceptance prob of the just-rejected offer (#287). */
  readonly acceptProb?: number;
}

export interface ModalsDeps {
  bus: EventBus;
  worldRef: React.MutableRefObject<World | null>;
  setLotVehicles: (v: readonly LotVehicle[]) => void;
  setCash: (n: number) => void;
  bump: () => void;
}

export interface Modals {
  tradeReview: TradeReview | null;
  tradeCounterResult: CounterResult | null;
  tradeOutcome: TradeOutcome | null;
  discountReview: DiscountReview | null;
  discountCounterResult: CounterResult | null;
  discountOutcome: DiscountOutcome | null;
  decideTrade: (decision: TradeDecision) => void;
  decideDiscount: (decision: DiscountDecision) => void;
  /** Dismiss the resolved trade recap (Done button). */
  dismissTrade: () => void;
  /** Dismiss the resolved discount recap (Done button). */
  dismissDiscount: () => void;
  /** Reset all latched modal/escalation state (session teardown). */
  reset: () => void;
}

// The interrupt-modal cluster (#242): the player-facing spotlights the
// composition root latches over the floor — the trade/discount escalation
// reviews (#172/#175). Owns the escalation subscriptions; mutating handlers
// write lot/cash back through the injected world-state setters.
export function useModals({
  bus,
  worldRef,
  setLotVehicles,
  setCash,
  bump,
}: ModalsDeps): Modals {
  const [tradeReview, setTradeReview] = useState<TradeReview | null>(null);
  const [tradeCounterResult, setTradeCounterResult] =
    useState<CounterResult | null>(null);
  const [tradeOutcome, setTradeOutcome] = useState<TradeOutcome | null>(null);
  const [discountReview, setDiscountReview] = useState<DiscountReview | null>(
    null,
  );
  const [discountCounterResult, setDiscountCounterResult] =
    useState<CounterResult | null>(null);
  const [discountOutcome, setDiscountOutcome] =
    useState<DiscountOutcome | null>(null);

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
    // Terminal: keep the modal mounted to show a buy/walk recap; the Done
    // button (dismissTrade) clears it.
    setTradeCounterResult(null);
    setTradeOutcome(
      result.status === 'closed'
        ? { kind: 'booked', agreedAllowance: result.agreedAllowance }
        : { kind: 'walked' },
    );
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
        attemptsRemaining: result.attemptsRemaining,
        acceptProb: result.acceptProb,
      });
      return;
    }
    // Terminal: keep the modal mounted to show a buy/walk recap; the Done
    // button (dismissDiscount) clears it.
    setDiscountCounterResult(null);
    setDiscountOutcome(
      result.status === 'closed'
        ? {
            kind: 'sold',
            soldPrice: result.soldPrice,
            frontGross: result.frontGross,
          }
        : { kind: 'walked' },
    );
    const w = worldRef.current;
    if (w) {
      setLotVehicles(w.inventory.getLotVehicles());
      setCash(w.economy.cash);
    }
    bump();
  };

  const dismissTrade = () => {
    setTradeReview(null);
    setTradeCounterResult(null);
    setTradeOutcome(null);
  };

  const dismissDiscount = () => {
    setDiscountReview(null);
    setDiscountCounterResult(null);
    setDiscountOutcome(null);
  };

  const reset = () => {
    setTradeReview(null);
    setTradeCounterResult(null);
    setTradeOutcome(null);
    setDiscountReview(null);
    setDiscountCounterResult(null);
    setDiscountOutcome(null);
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
      setTradeOutcome(null);
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
      askingPrice,
      customerTargetPrice,
      salespersonCounter,
      minimumAcceptablePrice,
      frontGrossAtAsk,
      canAcceptAsk,
      counterAttempts,
      priorMisses,
      salespersonCounterAcceptProb,
      priceSensitivity,
      missPenalty,
    }: {
      customerId: string;
      vehicle: DiscountReview['vehicle'];
      marketPrice: number;
      askingPrice: number;
      customerTargetPrice: number;
      salespersonCounter: number;
      minimumAcceptablePrice: number;
      frontGrossAtAsk: number;
      canAcceptAsk: boolean;
      counterAttempts: number;
      priorMisses: number;
      salespersonCounterAcceptProb: number;
      priceSensitivity: number;
      missPenalty: number;
    }) => {
      setDiscountCounterResult(null);
      setDiscountOutcome(null);
      setDiscountReview({
        customerId,
        vehicle,
        marketPrice,
        askingPrice,
        customerTargetPrice,
        salespersonCounter,
        minimumAcceptablePrice,
        frontGrossAtAsk,
        canAcceptAsk,
        counterAttempts,
        priorMisses,
        salespersonCounterAcceptProb,
        priceSensitivity,
        missPenalty,
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
    tradeReview,
    tradeCounterResult,
    tradeOutcome,
    discountReview,
    discountCounterResult,
    discountOutcome,
    decideTrade,
    decideDiscount,
    dismissTrade,
    dismissDiscount,
    reset,
  };
}
