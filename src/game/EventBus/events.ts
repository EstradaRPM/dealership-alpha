/**
 * Central registry of every event flowing through the EventBus.
 *
 * Adding a new event = adding one line here. Subscribers and publishers
 * are then statically type-checked against this map.
 *
 * Keep event names namespaced ("domain:verb") and payloads plain data.
 */
import type { Competitor } from '../CompetitorMarket/Competitor';
import type { EndCardData } from '../EndCard/types';

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
  // Fired after clock:day_started when that day was the last day of a week (day % 7 === 0).
  'clock:week_ended': { day: number };
  // Fired after clock:week_ended when the ending day completes a month
  // (endingDay % clock.daysPerMonth === 0, ~30-day tunable cadence). Slotted
  // last in the advanceDay() sequence so week-close consumers settle first.
  'clock:month_ended': { day: number };

  // FloorSim intra-day logical-tick loop. Public contract LOCKED at the #99
  // HITL gate (see issue #99 sign-off for the authoritative surface). Runs
  // strictly between clock:day_started and the player-gated composition-root
  // call to GameClock.advanceDay() — independent of, never interleaved with,
  // the clock:* overnight sequence. FloorSim NEVER calls GameClock;
  // floor:day_complete signals "enter after-hours", not "advance clock".
  //
  // Canonical per-tick sequence (authoritative ordering for #100/#101/#103):
  //   1 spawn arrivals → 2 admit/walk (floor:customer_walked) →
  //   3 drainDept (resolved + escalated) → 4 escalate (floor:exception_raised)
  //   → 5 floor:tick (settled heartbeat, emitted LAST in the tick) →
  //   6 day-end check (floor:day_complete, exactly once).
  // Per simulated day: floor:tick ×ticksPerDay (ascending 1..ticksPerDay),
  // then floor:day_complete once. (floor:customer_walked #100,
  // floor:exception_raised #103 land with their slices.)
  'floor:tick': {
    day: number;
    /** 1-based tick index within the day, 1..ticksPerDay. */
    tick: number;
    ticksPerDay: number;
    /** Count of customers that arrived on this tick (0..n; #98 skeleton emits ≤1). */
    arrivals: number;
  };
  'floor:day_complete': {
    day: number;
    /** Total logical ticks simulated (== ticksPerDay). */
    ticks: number;
    totalArrivals: number;
  };

  // CompetitorMarket → CustomerPool (ADR-0001 §10). Published each
  // clock:day_started; consumed when rolling today's customers.
  'market:competitive_pressure': {
    day: number;
    competitors: ReadonlyArray<Competitor>;
  };

  // CustomerPool lifecycle — published in this order per customer per day:
  //   customer:arrived → customer:state_changed (0-n times) →
  //   customer:gate_evaluated (one per gate, in gate order, only on a
  //   SalesProcess-driven resolution) → customer:resolved
  //   OR customer:poached (removes from pool before any state changes)
  'customer:arrived': { day: number; customerId: string; label: string };
  'customer:state_changed': { customerId: string; from: string; to: string };
  // Observability only (issue #92): one per gate during SalesProcess-driven
  // resolution, emitted in gate order before customer:resolved. No consumer
  // logic — meters/UI render and tests assert per-gate behavior from this.
  'customer:gate_evaluated': {
    customerId: string;
    day: number;
    /** Gate name in resolution order (GREET/QUALIFY/DEMO/NEGOTIATE/CLOSE). */
    gate: string;
    /** Resolved gate quality q ∈ [0,1]. */
    q: number;
    /** This gate's marginal contribution to each running meter (post − pre). */
    meterDelta: { trustIntegrity: number; value: number };
    /** Set only on the gate the customer walked at; null on every other gate. */
    walkCause:
      | 'patience_drain'
      | 'trust_collapse'
      | 'demo_nonnegotiable_miss'
      | null;
  };
  'customer:resolved': {
    customerId: string;
    outcome: 'closed' | 'walk';
    /** [0,1] Trust/Integrity meter → F&I receptivity input. */
    receptivity: number;
    /** -1 bad review | 0 neutral | 1 positive review → Reputation delta. */
    satisfaction: number;
    /** [0,1] trust+deal blend → future retention / service-customer state. */
    retentionSeed: number;
    /** [0,1] walk warmth for FollowUpPool heat scaling. 0 for closed deals. */
    heat: number;
    /** Realized sale price (= agreedPrice). 0 for non-closes. */
    agreedPrice: number;
    /** Front-end gross margin. 0 for non-closes. */
    frontGross: number;
  };
  'customer:poached': {
    customerId: string;
    day: number;
    competitorId: string;
    competitorName: string;
  };

  // Inventory — vehicle purchased from auction, moved to lot
  'inventory:vehicle_purchased': { day: number; vehicleId: string; cost: number };

  // Economy — money flows posted to the ledger
  'economy:revenue_posted': { day: number; amount: number; label: string };
  'economy:expense_posted': { day: number; amount: number; label: string };

  // Inventory — vehicle sold off lot
  'inventory:vehicle_sold': { day: number; vehicleId: string };

  // FollowUpPool — a walked customer's heat decayed to zero; no longer actionable
  'followup:customer_archived': { customerId: string; day: number };

  // FollowUpPool → DepartmentQueue — hottest follow-up customer(s) ready for morning callback
  'followup:bdc_tasks_ready': {
    day: number;
    entries: ReadonlyArray<{ customerId: string; heat: number; archetypeLabel: string }>;
  };

  // FollowUpPool — a BDC callback attempt succeeded; customer returns to Sales
  'bdc:callback_succeeded': { customerId: string; day: number; archetypeLabel: string };

  // DealEngine — a deal has been fully closed (vehicle sold, revenue posted)
  'deal:closed': {
    customerId: string;
    vehicleId: string;
    agreedPrice: number;
    frontGross: number;
    backGross: number;
    daysInInventory: number;
  };

  // StaffOrg — roster changes
  'staff:hired': { staffId: string; roleId: string; day: number; hiringCost: number };
  'staff:fired': { staffId: string; roleId: string; day: number };

  // StaffDispatch — salesperson auto-resolved a sales queue item
  'staff:auto_resolved': {
    customerId: string;
    staffId: string;
    day: number;
    outcome: 'closed' | 'no_sale';
    grossImpact: number;
  };

  // StaffMorale — staff member quit due to low morale
  'staff:quit': { staffId: string; roleId: string; day: number; morale: number };

  // CapacityManager — customer admitted (within daily capacity)
  'capacity:customer_admitted': { day: number; customerId: string; label: string };

  // CapacityManager — customer turned away (demand exceeded capacity)
  'capacity:missed_opportunity': { day: number; customerId: string; label: string };

  // Reputation — customer satisfaction penalty (stub; Reputation module consumes this in v2)
  'reputation:satisfaction_hit': { day: number; amount: number; reason: string };

  // CareerProgression — player's dealership advanced to the next tier
  'career:tier_up': { fromTier: number; toTier: number; day: number };

  // CareerProgression — bankruptcy outcomes (tier-aware per issue #30).
  //   terminal: Tier 1 game-over; routes to end-card flow.
  //   contraction: Tier 2 forced back to Tier 1 with debt overhang.
  //   compliance: Tier 3+ auto-applied cash drain + rep hit; tier preserved.
  'career:bankruptcy_terminal': { day: number; tier: number };
  'career:bankruptcy_contraction': {
    day: number;
    fromTier: number;
    debtPrincipal: number;
  };
  'career:bankruptcy_compliance': {
    day: number;
    tier: number;
    cashCost: number;
    reputationHit: number;
  };
  'career:debt_payment_made': {
    day: number;
    amount: number;
    remainingBalance: number;
  };

  // Reputation/RegulatoryMeter — AG complaint outcomes (tier-aware per issue #31).
  //   terminal: Tier 1 game-over.
  //   contraction: Tier 2 forced back to Tier 1 + license suspension window.
  //   consent_decree: Tier 3+ auto-applied cash drain + rep hit; tier preserved.
  'regulatory:ag_complaint_terminal': { day: number; tier: number; pressure: number };
  'regulatory:ag_complaint_contraction': {
    day: number;
    fromTier: number;
    suspensionDays: number;
  };
  'regulatory:ag_complaint_consent_decree': {
    day: number;
    tier: number;
    cashCost: number;
    reputationHit: number;
  };
  'regulatory:suspension_lifted': { day: number };

  // Severe-event signals that accumulate indictment pressure (issue #32).
  // Published by domain modules when a severe regulatory violation occurs.
  'regulatory:lemon_law_incident': { day: number; customerId: string };
  'regulatory:audit_failure': { day: number };
  'deal:fraud_flag': { day: number; customerId: string; vehicleId: string };

  // CareerProgression — indictment outcomes (tier-aware per issue #32).
  //   terminal: Tier 1 game-over with prison-sentence flavor.
  //   contraction: Tier 2 player loses personal stake + business contracts.
  //   legal_defense: Tier 3+ legal-defense investment + reputation crater; tier preserved.
  'career:indictment_terminal': { day: number; tier: number; pressure: number };
  'career:indictment_contraction': {
    day: number;
    fromTier: number;
    stakePenalty: number;
  };
  'career:indictment_legal_defense': {
    day: number;
    tier: number;
    cashCost: number;
    reputationHit: number;
  };

  // ServiceQueue — daily service intake items generated at Tier 2+
  'service:intake_ready': {
    day: number;
    items: ReadonlyArray<{
      serviceItemId: string;
      type: string;
      label: string;
      baseRevenue: number;
    }>;
  };

  // EndCard — all terminal paths converge here; UI subscribes to show the end-card screen
  'career:game_over': { day: number; data: EndCardData };

  // CareerEndings — successful career endings (issue #35).
  // Each routes through EndCardManager to produce a success end-card.
  'career:retired': { day: number; tier: number; cashOnHand: number; careerYear: number };
  'career:pe_offer_made': {
    day: number;
    tier: number;
    offerAmount: number;
  };
  'career:pe_sellout': { day: number; tier: number; offerAmount: number };
  'career:family_handoff': { day: number; tier: number; careerYear: number };

  // ServiceDispatch — a service ticket was auto-resolved by a service advisor
  'service:ticket_closed': {
    serviceItemId: string;
    day: number;
    revenue: number;
    advisorId: string;
  };

  // CloseEarly — player chose to end the day before natural close
  'player:close_early': { day: number; walkCount: number; reputationHit: number };
}

export type EventName = keyof EventMap;
export type EventPayload<K extends EventName> = EventMap[K];
export type EventListener<K extends EventName> = (payload: EventPayload<K>) => void;
