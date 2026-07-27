import type { EventBus } from '../EventBus';
import type { PlaytestLog } from './types';

/**
 * Wire the recorder to the two event families that carry #74's otherwise
 * unobservable acceptance criteria (#332).
 *
 * Unlike the admin console's bus log — opt-in, and far too noisy to leave
 * running — this stays attached for the whole session: the finance mix is a
 * *rate* question, so a partial sample answers it wrongly.
 *
 * `deal:closed` carries no day (DealEngine has no clock), so the day is read
 * from the caller's cursor at capture time — the same seam HistoryLog and
 * Records use. `staff:auto_resolved` carries its own day and is trusted.
 *
 * Returns the detach function.
 */
export function attachPlaytestCapture(
  bus: EventBus,
  log: PlaytestLog,
  getDay: () => number,
): () => void {
  const onDealClosed = (p: {
    customerId: string;
    vehicleId: string;
    agreedPrice: number;
    frontGross: number;
    backGross: number;
    daysInInventory: number;
    paymentMethod: 'cash' | 'finance';
    downPayment: number;
    loanAmount: number;
    term: number;
    apr: number;
  }): void => {
    log.recordDeal({ day: getDay(), ...p });
  };

  const onResolved = (p: {
    customerId: string;
    day: number;
    outcome: 'closed' | 'no_sale';
    reason?: string;
    archetypeLabel?: string;
    wantedCategory?: string;
  }): void => {
    // Closes arrive through `deal:closed` with the full structure; this branch
    // is only the loss half, which has no other carrier of its named reason.
    if (p.outcome !== 'no_sale') return;
    log.recordWalk({
      day: p.day,
      customerId: p.customerId,
      reason: p.reason ?? 'unspecified',
      archetypeLabel: p.archetypeLabel,
      wantedCategory: p.wantedCategory,
    });
  };

  bus.subscribe('deal:closed', onDealClosed);
  bus.subscribe('staff:auto_resolved', onResolved);

  return () => {
    bus.unsubscribe('deal:closed', onDealClosed);
    bus.unsubscribe('staff:auto_resolved', onResolved);
  };
}
