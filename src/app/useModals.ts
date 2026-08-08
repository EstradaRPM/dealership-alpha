import { useEffect, useRef, useState } from 'react';
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
  /**
   * The car the pending trade review is on was bought by another customer while
   * the prompt sat open (#364) — the review is unwinnable and says so.
   */
  tradeVehicleSold: boolean;
  discountReview: DiscountReview | null;
  discountCounterResult: CounterResult | null;
  discountOutcome: DiscountOutcome | null;
  /** Same, for the pending discount review (#364). */
  discountVehicleSold: boolean;
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

  // #364: two customers can be held on the same car. Whoever the player
  // resolves first drives it away, and the other prompt is left offering
  // buttons that cannot complete. These track the unit each open review is on
  // (refs — the `inventory:vehicle_sold` handler is subscribed once and would
  // otherwise read stale state) and whether it has since left the lot.
  const tradeVehicleIdRef = useRef<string | null>(null);
  const discountVehicleIdRef = useRef<string | null>(null);
  const [tradeVehicleSold, setTradeVehicleSold] = useState(false);
  const [discountVehicleSold, setDiscountVehicleSold] = useState(false);

  const decideTrade = (decision: TradeDecision) => {
    if (!tradeReview) return;
    const result = worldRef.current?.resolvePlayerTradeDecision(
      tradeReview.customerId,
      decision,
    );
    if (!result) return;
    if (result.status === 'vehicle_sold') {
      // The engine walked the customer (the car was gone whatever the player
      // picked). The prompt already said so, so close it rather than latching a
      // recap that repeats it.
      dismissTrade();
      const w = worldRef.current;
      if (w) {
        setLotVehicles(w.inventory.getLotVehicles());
        setCash(w.economy.cash);
      }
      bump();
      return;
    }
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
    if (result.status === 'vehicle_sold') {
      // See decideTrade: the car was gone whatever the player picked (#364).
      dismissDiscount();
      const w = worldRef.current;
      if (w) {
        setLotVehicles(w.inventory.getLotVehicles());
        setCash(w.economy.cash);
      }
      bump();
      return;
    }
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
        : // #367: the customer agreed and the lender refused the paper. Its own
          // recap — the player closed this deal, and the store's standing F&I
          // markup is what killed it, so reporting a plain walk would point them
          // at the wrong lever.
          result.status === 'finance_fell_through'
          ? { kind: 'finance_declined' }
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
    tradeVehicleIdRef.current = null;
    setTradeVehicleSold(false);
  };

  const dismissDiscount = () => {
    setDiscountReview(null);
    setDiscountCounterResult(null);
    setDiscountOutcome(null);
    discountVehicleIdRef.current = null;
    setDiscountVehicleSold(false);
  };

  const reset = () => {
    dismissTrade();
    dismissDiscount();
  };

  useEffect(() => {
    const onTradeEscalated = ({
      customerId,
      vehicle,
      currentVehicle,
      book,
      allowanceAsk,
      payoff,
      target,
      recommendedCounter,
      staffConfidence,
    }: {
      customerId: string;
      vehicle: TradeReview['vehicle'];
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
      tradeVehicleIdRef.current = vehicle.id;
      setTradeVehicleSold(false);
      setTradeReview({
        customerId,
        vehicle,
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
      discountVehicleIdRef.current = vehicle.id;
      setDiscountVehicleSold(false);
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

    // #364: the car under an open review can be bought by the customer the
    // player resolved first. The prompt has to stop offering a deal it can no
    // longer make, so it watches the unit leave the lot.
    const onVehicleSold = ({ vehicleId }: { vehicleId: string }) => {
      if (vehicleId === tradeVehicleIdRef.current) setTradeVehicleSold(true);
      if (vehicleId === discountVehicleIdRef.current) {
        setDiscountVehicleSold(true);
      }
    };

    bus.subscribe('trade:escalated', onTradeEscalated);
    bus.subscribe('discount:escalated', onDiscountEscalated);
    bus.subscribe('inventory:vehicle_sold', onVehicleSold);
    return () => {
      bus.unsubscribe('trade:escalated', onTradeEscalated);
      bus.unsubscribe('discount:escalated', onDiscountEscalated);
      bus.unsubscribe('inventory:vehicle_sold', onVehicleSold);
    };
  }, []);

  return {
    tradeReview,
    tradeCounterResult,
    tradeOutcome,
    tradeVehicleSold,
    discountReview,
    discountCounterResult,
    discountOutcome,
    discountVehicleSold,
    decideTrade,
    decideDiscount,
    dismissTrade,
    dismissDiscount,
    reset,
  };
}
