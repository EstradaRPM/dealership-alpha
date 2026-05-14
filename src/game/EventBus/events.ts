/**
 * Central registry of every event flowing through the EventBus.
 *
 * Adding a new event = adding one line here. Subscribers and publishers
 * are then statically type-checked against this map.
 *
 * Keep event names namespaced ("domain:verb") and payloads plain data.
 */
import type { Competitor } from '../CompetitorMarket/Competitor';

export interface EventMap {
  'bus:ready': { at: number };

  // GameClock overnight sequence — published in this order by advanceDay():
  //   clock:day_ended → clock:overnight_payroll →
  //   clock:overnight_inventory_arrival → clock:overnight_reputation_drift →
  //   clock:overnight_followup_decay → clock:day_started
  'clock:day_ended': { day: number };
  'clock:overnight_payroll': { day: number };
  'clock:overnight_inventory_arrival': { day: number };
  'clock:overnight_reputation_drift': { day: number };
  'clock:overnight_followup_decay': { day: number };
  'clock:day_started': { day: number };

  // CompetitorMarket → CustomerPool (ADR-0001 §10). Published each
  // clock:day_started; consumed when rolling today's customers.
  'market:competitive_pressure': {
    day: number;
    competitors: ReadonlyArray<Competitor>;
  };

  // CustomerPool lifecycle — published in this order per customer per day:
  //   customer:arrived → customer:state_changed (0-n times) → customer:resolved
  'customer:arrived': { day: number; customerId: string; label: string };
  'customer:state_changed': { customerId: string; from: string; to: string };
  'customer:resolved': { customerId: string; outcome: 'closed' | 'walk' };

  // Inventory — vehicle purchased from auction, moved to lot
  'inventory:vehicle_purchased': { day: number; vehicleId: string; cost: number };

  // Economy — money flows posted to the ledger
  'economy:revenue_posted': { day: number; amount: number; label: string };
  'economy:expense_posted': { day: number; amount: number; label: string };

  // Inventory — vehicle sold off lot
  'inventory:vehicle_sold': { day: number; vehicleId: string };

  // FollowUpPool — a walked customer's heat decayed to zero; no longer actionable
  'followup:customer_archived': { customerId: string; day: number };

  // DealEngine — a deal has been fully closed (vehicle sold, revenue posted)
  'deal:closed': {
    customerId: string;
    vehicleId: string;
    agreedPrice: number;
    frontGross: number;
    backGross: number;
  };
}

export type EventName = keyof EventMap;
export type EventPayload<K extends EventName> = EventMap[K];
export type EventListener<K extends EventName> = (payload: EventPayload<K>) => void;
