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
import type {
  NewsReliability,
  NewsTrigger,
  WeeklySummaryShape,
} from '../MarketEconomy/schemas';

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
  // #136: night-before MANAGERIAL prep signal — published by DayLoopController
  // when MANAGERIAL phase is (re-)entered for an upcoming day, so prep-side
  // consumers (auction board, etc.) can populate state for the day the player
  // is *about* to play. Fires on cold-start composition (upcomingDay = clock
  // current day, the bootstrap "night before Day 1") and on every FLOOR_OPEN
  // → MANAGERIAL transition (upcomingDay = clock current day + 1, since the
  // clock has not yet been advanced by the next nextDay() call).
  'clock:managerial_prep': { upcomingDay: number };
  // Fired after clock:day_started when that day was the last day of a week (day % 7 === 0).
  'clock:week_ended': { day: number };
  // Fired after clock:week_ended when the ending day completes a month
  // (endingDay % clock.daysPerMonth === 0, ~30-day tunable cadence). Slotted
  // last in the advanceDay() sequence so week-close consumers settle first.
  'clock:month_ended': { day: number };

  // TierGate — the single 4-band monthly verdict (#232), fired once on
  // clock:month_ended on the multi-dimensional tier GATE. `overall` is the WORST
  // active face (the gate is multi-dimensional; the binding constraint grades
  // the month — macro-loop-spine §10). `faces` carries each active face's band +
  // its achieved/target `ratio`. This is where month-end confetti / bonus /
  // escalation hang — never a daily grade (goals-targets-design decision 1).
  'tierGate:month_verdict': {
    day: number;
    /** Running gameplay month index (1-based). */
    month: number;
    tier: number;
    overall: 'exceed' | 'meet' | 'nearMiss' | 'miss';
    faces: {
      id: string;
      band: 'exceed' | 'meet' | 'nearMiss' | 'miss';
      ratio: number;
    }[];
  };

  // Records (#329): a durable high-water mark was beaten. Published by the
  // Records module the moment a mark falls — `bestSingleDeal` within
  // `deal:closed`, the day marks within `floor:day_complete` (so they are all
  // in before the day-close Reveal is assembled), `bestMonthGross` within
  // `clock:month_ended`.
  //
  // `previousValue` is null the FIRST time a mark is ever set — there was
  // nothing to beat. The engine still reports it (it genuinely is the best
  // day so far); the presentation decides whether a first-ever mark earns a
  // crown on the feed (#330).
  'records:broken': {
    day: number;
    kind:
      | 'bestDayGross'
      | 'bestMonthGross'
      | 'bestPvr'
      | 'bestStreak'
      | 'bestSingleDeal'
      | 'mostUnitsInDay';
    value: number;
    /** The mark this beat, or null if this is the first mark of its kind. */
    previousValue: number | null;
    /** Deal that set the mark — `bestSingleDeal` only. */
    vehicleId?: string;
    customerId?: string;
    /** Running 1-based month index — `bestMonthGross` only. */
    month?: number;
  };

  // FloorSim intra-day logical-tick loop. Public contract LOCKED at the #99
  // HITL gate (see issue #99 sign-off for the authoritative surface). Runs
  // strictly between clock:day_started and the player-gated composition-root
  // call to GameClock.advanceDay() — independent of, never interleaved with,
  // the clock:* overnight sequence. FloorSim NEVER calls GameClock;
  // floor:day_complete signals "enter after-hours", not "advance clock".
  //
  // Canonical per-tick sequence (authoritative ordering for #100/#101):
  //   1 spawn arrivals → 2 admit/walk (floor:customer_walked) →
  //   3 drainDept (resolved + escalated; escalated only tallied) →
  //   4 floor:tick (settled heartbeat, emitted LAST in the tick) →
  //   5 day-end check (floor:day_complete, exactly once).
  // Per simulated day: floor:tick ×ticksPerDay (ascending 1..ticksPerDay),
  // then floor:day_complete once.
  'floor:tick': {
    day: number;
    /** 1-based tick index within the day, 1..ticksPerDay. */
    tick: number;
    ticksPerDay: number;
    /** Count of customers that arrived on this tick (0..n; #98 skeleton emits ≤1). */
    arrivals: number;
  };
  // Step 2 of the canonical per-tick sequence: emitted once per customer
  // turned away because per-tick admittance was exhausted (a felt, in-day
  // walk — not a daily aggregate). Emitted before floor:tick on the same
  // tick. Observability only; CapacityManager owns the domain consequence
  // (capacity:missed_opportunity + reputation:satisfaction_hit) via the
  // injected capacity seam. customerId individuation lands with the spawn
  // seam (#101); until then arrivals/walks are count-based.
  'floor:customer_walked': {
    day: number;
    /** 1-based tick the walk occurred on, 1..ticksPerDay. */
    tick: number;
  };
  'floor:day_complete': {
    day: number;
    /** Total logical ticks simulated (== ticksPerDay). */
    ticks: number;
    totalArrivals: number;
  };

  // CompetitorMarket ambient heartbeat (ADR-0001 §10). Published each
  // clock:day_started with the live rival roster — the market force the player
  // operates within. Read by KPI/market-visibility surfaces; no game-logic
  // consumer mutates state off it.
  'market:competitive_pressure': {
    day: number;
    competitors: ReadonlyArray<Competitor>;
  };

  // CompetitorMarket → MarketEconomy (slice #158). Emitted during the weekly
  // personality drift on `clock:day_ended` (day % 7 === 0) when a competitor's
  // pricing index moves by at least `competitorMarket.pricingChangeThreshold`.
  // Carries the brand's segment_affinity so consumers don't need to dereference
  // the brand catalog. `newPricing > oldPricing` means prices went up (the
  // `pricing` stat reads as "how high prices are" — see ScoreCompetitor's
  // `(1 - pricing)` term). MarketEconomy fans the delta out as a synthetic
  // comp per segment, weighted by affinity.
  'competitor:price_changed': {
    day: number;
    competitorId: string;
    brand: string;
    oldPricing: number;
    newPricing: number;
    segmentAffinity: Readonly<Record<string, number>>;
  };

  // CustomerPool lifecycle — published in this order per customer per day:
  //   customer:arrived → customer:state_changed (0-n times) →
  //   customer:gate_evaluated (one per gate, in gate order, only on a
  //   SalesProcess-driven resolution) → customer:resolved
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

  // MarketEconomy → world (slice #159). Stochastic shock scheduler activates a
  // catalog shock deterministically from masterSeed + day on clock:day_started
  // and emits `market:shock_started`; on its expectedEndDay (or earlier under
  // future preconditions) emits `market:shock_resolved`. The active set
  // modulates segmentHeat via the composer's activeShockMod term; consumers
  // (KPI, news) read these for visibility. `instanceId` disambiguates repeat
  // activations of the same shock id and is `${shockId}@${startDay}`.
  'market:shock_started': {
    day: number;
    shockId: string;
    instanceId: string;
    label: string;
    segmentMagnitudes: Readonly<Record<string, number>>;
    expectedEndDay: number;
  };
  'market:shock_resolved': {
    day: number;
    shockId: string;
    instanceId: string;
  };

  // MarketEconomy → world (slice #176). The segment-heat monitor evaluates the
  // composite (personality + comp drift + active shocks) once per
  // clock:day_started and publishes ONLY when a segment has moved at least
  // `marketEconomy.heatMonitor.deltaThreshold` since it was last reported —
  // deliberately not a daily heartbeat (the #267 lesson: continuous ambient
  // state belongs on the KPI surface, discrete changes belong on the wire).
  // `delta` is measured against the last *reported* heat, not yesterday's, so
  // slow persistent drift eventually reports once rather than never.
  'market:segment_heat_updated': {
    day: number;
    segment: string;
    heat: number;
    previousHeat: number;
    delta: number;
  };

  // MarketNews → world (slice #176). One published industry-wire headline.
  // `reliability` is the load-bearing axis the player learns to price in:
  // `direct` already happened, `leading` is a forward call from the analyst
  // desk that fires ahead of a shock and is allowed to be wrong, `lagging`
  // only confirms a trend already visible in the player's own numbers.
  // `trigger`/`segment`/`direction` are the structural tag — what the headline
  // is about, for consumers that shouldn't parse prose. Published inside the
  // MarketEconomy day tick (after shocks + heat) and on the observed events
  // themselves; capped per day by `marketEconomy.news.maxHeadlinesPerDay`.
  'news:headline_published': {
    day: number;
    headlineId: string;
    source: string;
    sourceLabel: string;
    reliability: NewsReliability;
    text: string;
    trigger: NewsTrigger;
    segment: string | null;
    direction: 'up' | 'down';
  };

  // MarketEconomy → world (slice #177). The weekly market report — the trade
  // pub's longer-form column, published on `marketEconomy.weeklyReport.
  // publishDayOfWeek` inside the same day tick as the wire (after it), and
  // standing as the Home-screen card until the next one replaces it. It is NOT
  // a headline: it never spends the daily wire budget and never enters the
  // ticker's ring buffer. The payload is the summary line only — consumers that
  // need the moves/calls read `marketEconomy.weeklyReport.getActive()`, which
  // is the persisted article. `shape` is the week's structural read (all movers
  // agreeing up/down, pulling against each other, or nothing clearing the bar).
  'market:weekly_report_published': {
    day: number;
    weekIndex: number;
    fromDay: number;
    toDay: number;
    shape: WeeklySummaryShape;
    summary: string;
    forwardCallCount: number;
  };

  // Inventory — vehicle purchased from auction, moved to lot.
  // Carries the structural snapshot MarketEconomy's compHistory needs to
  // re-compute the anchor of the comp without depending on Inventory
  // internals. The slice-#157 wholesale-comp consumer reads category + the
  // anchor-input fields to record `(price / anchor) - 1` for segment drift.
  'inventory:vehicle_purchased': {
    day: number;
    vehicleId: string;
    cost: number;
    templateId: string;
    /** Opaque canonical brand id (join key) — MarketEconomy resolves brand-tier from this. */
    brand: string;
    make: string;
    year: number;
    mileage: number;
    condition: 'clean' | 'average' | 'rough';
    category: string;
    reconCost: number;
  };

  // Inventory — a customer's trade-in entered the lot as a new LotVehicle
  // (#171). Parallel to `vehicle_purchased`, but a *non-cash* acquisition: the
  // `allowance` cost basis is offset against the deal cash in the close
  // structure (#169), NOT posted as a separate Economy expense — which is why
  // this is a distinct event name (Economy/MarketEconomy subscribe to
  // `vehicle_purchased`, not this). The acquired unit then participates in the
  // normal recon → carrying-cost → listing → sale flow. `reconCost` is the
  // estimate the staff condition-read produced at acquisition.
  'inventory:vehicle_acquired_via_trade': {
    day: number;
    vehicleId: string;
    customerId: string;
    /** Cost basis = agreed trade allowance (non-cash). */
    allowance: number;
    templateId: string;
    /** Opaque canonical brand id (join key); never a display string. */
    brand: string;
    make: string;
    year: number;
    mileage: number;
    condition: 'clean' | 'average' | 'rough';
    category: string;
    reconCost: number;
  };

  // Inventory — mid-recon surprise fires when realized cost crosses
  // surpriseThreshold × estimate (slice #162). Player must call
  // `authorizeReconSpend` or `abandonRecon`; recon is paused until they do.
  'inventory:recon_surprise': {
    day: number;
    vehicleId: string;
    templateId: string;
    reason: string;
    estimate: number;
    revisedTotal: number;
    spentToDate: number;
    bucket: 'minor' | 'major' | 'catastrophic';
  };

  // Inventory — recon process finished cleanly (no surprise, or surprise
  // authorized and amortized through). reconCost on the lot vehicle now
  // equals the realized total. Slice #162.
  'inventory:recon_completed': {
    day: number;
    vehicleId: string;
    realizedCost: number;
    estimate: number;
    bucket: 'within' | 'minor' | 'major' | 'catastrophic';
  };

  // Economy — money flows posted to the ledger
  'economy:revenue_posted': { day: number; amount: number; label: string };
  'economy:expense_posted': { day: number; amount: number; label: string };

  // Inventory — daily floorplan + carrying cost accrual (#173). Fires once per
  // day from the lot pass after each unit's recon advances. `totalCost` is the
  // aggregate burn already posted to Economy (as a single `forceDebit`);
  // `vehicleCount` is how many units it covered. Both are 0 on a day the lot is
  // empty (no aggregate expense is posted then, but the event still fires so
  // KPI/UI see the zero-burn day). KPIDashboard consumes this for the daily
  // carrying-cost line item; full month aggregation lands in slice #178/#25.
  'economy:carrying_cost_posted': {
    day: number;
    totalCost: number;
    vehicleCount: number;
  };

  // Inventory — vehicle sold off lot. Carries the same snapshot as
  // vehicle_purchased plus the realized sale price so MarketEconomy's
  // compHistory can record a retail comp without consulting DealEngine.
  'inventory:vehicle_sold': {
    day: number;
    vehicleId: string;
    salePrice: number;
    templateId: string;
    /** Opaque canonical brand id (join key) — MarketEconomy resolves brand-tier from this. */
    brand: string;
    make: string;
    year: number;
    mileage: number;
    condition: 'clean' | 'average' | 'rough';
    category: string;
    purchasePrice: number;
    reconCost: number;
    /**
     * Powertrain axis (#298). The join seam InstalledBase reads to register an
     * owner's vehicle type without re-deriving it. The catalog is ICE-only
     * today, so Inventory emits `'ice'`; EV/hybrid templates flow through here
     * unchanged when the powertrain axis is modeled.
     */
    powertrain: 'ice' | 'hybrid' | 'ev';
  };

  // FollowUpPool — a walked customer's heat decayed to zero; no longer actionable
  'followup:customer_archived': { customerId: string; day: number };

  // FollowUpPool → DepartmentQueue — hottest follow-up customer(s) ready for morning callback
  'followup:bdc_tasks_ready': {
    day: number;
    entries: ReadonlyArray<{ customerId: string; heat: number; archetypeLabel: string }>;
  };

  // FollowUpPool — a BDC callback attempt succeeded; customer returns to Sales
  'bdc:callback_succeeded': { customerId: string; day: number; archetypeLabel: string };

  // DealEngine — a deal has been fully closed (vehicle sold, revenue posted).
  // Deal-structuring fields (paymentMethod / downPayment / loanAmount / term /
  // apr) ride the event so KPI splits (#148) can aggregate cash vs finance vs
  // heavy-down without re-deriving from customer state. Cash closes:
  // paymentMethod='cash', downPayment=agreedPrice, loanAmount=0, term=0, apr=0.
  // Finance closes: term/apr from credit tier; downPayment derived from the
  // customer's behavioral down fraction × agreedPrice.
  'deal:closed': {
    customerId: string;
    vehicleId: string;
    agreedPrice: number;
    frontGross: number;
    backGross: number;
    daysInInventory: number;
    paymentMethod: 'cash' | 'finance';
    downPayment: number;
    loanAmount: number;
    /** Months; 0 for cash. */
    term: number;
    /** Annualized rate as a decimal (e.g. 0.07); 0 for cash. */
    apr: number;
  };

  // DealEngine — a customer's trade-in resolved during a closing deal (#169).
  // Fires only on a *routine* trade that auto-resolved silently, after the deal
  // reached close and before DealEngine.closeDeal, so it precedes the matching
  // `deal:closed` for that customer. `currentVehicle` is the car the customer
  // drove in on (the asset the dealer acquires); `agreedAllowance` is the gross
  // credit; `action` is the staff decision ('accept' or 'counter'); `hadCounter`
  // is true when the customer took a staff counter rather than their ask.
  // Unusual trades (player overlay, slice 16) and underwater abandons do NOT
  // emit this. Inventory consumes this event (#171) to materialize the
  // acquired trade onto the lot via `inventory:vehicle_acquired_via_trade`;
  // #169 nets the equity into the deal structure (downPayment / loanAmount).
  // `staffConfidence` is the UCM condition-read confidence behind the
  // appraisal (0 = no UCM), carried so the acquisition's recon-variance roll
  // reads the same figure the resolution used (mirrors `trade:escalated`).
  'trade:resolved': {
    customerId: string;
    currentVehicle: {
      templateId: string;
      /** Opaque canonical brand id (join key); never a display string. */
      brand: string;
      make: string;
      model: string;
      year: number;
      mileage: number;
      condition: 'clean' | 'average' | 'rough';
      category: 'sedan' | 'truck' | 'suv';
      loanPayoff: number | null;
    };
    agreedAllowance: number;
    action: 'accept' | 'counter';
    hadCounter: boolean;
    staffConfidence: number;
  };

  // DealEngine/StaffDispatch — an *unusual* trade with no manager to handle it
  // (or an ask over the player override) escalated to the #84 manager-attention
  // overlay (#170). Published by the close-flow seam (StaffDispatch) when
  // `resolveTradeIn` returns `player_review`; the composition root subscribes to
  // open the overlay + pause the day (via the render-loop `hold`). The deal is
  // held for the player — no `deal:closed` fires for this customer this pass.
  // Carries the full review surface so the overlay needs no further lookups.
  'trade:escalated': {
    customerId: string;
    day: number;
    currentVehicle: {
      templateId: string;
      /** Opaque canonical brand id (join key); never a display string. */
      brand: string;
      make: string;
      model: string;
      year: number;
      mileage: number;
      condition: string;
      category: string;
      loanPayoff: number | null;
    };
    /** Honest wholesale book for the trade. */
    book: number;
    /** What the customer wants for the trade. */
    allowanceAsk: number;
    /** Outstanding lien (0 for a free-and-clear owner). */
    payoff: number;
    /** Staff's internal acceptance target. */
    target: number;
    /** Advisory counter the salesperson would have offered. */
    recommendedCounter: number;
    /** UCM condition-read confidence behind the appraisal (0 = no UCM). */
    staffConfidence: number;
  };

  // SalesProcess/StaffDispatch — the customer would buy only below the
  // salesperson's margin floor, and no sales manager is on roster to adjudicate
  // the discount exception (#222). Published by StaffDispatch after the pure
  // SalesProcess evaluator returns an uncloseable price formation; the deal is
  // held for the player and resumes through the same close path after an
  // accepted ask/counter. Carries the full review surface so the overlay needs
  // no further lookups.
  'discount:escalated': {
    customerId: string;
    day: number;
    vehicle: {
      id: string;
      make: string;
      model: string;
      year: number;
      mileage: number;
      category: string;
    };
    marketPrice: number;
    askingPrice: number;
    customerTargetPrice: number;
    salespersonCounter: number;
    minimumAcceptablePrice: number;
    frontGrossAtAsk: number;
    canAcceptAsk: boolean;
    // Acceptance-heat readout (#287): the modal frames the negotiation as a
    // reactive accept-% rather than a raw "N offers left" countdown.
    counterAttempts: number;
    priorMisses: number;
    salespersonCounterAcceptProb: number;
    priceSensitivity: number;
    missPenalty: number;
  };

  // StaffOrg — roster changes
  'staff:hired': { staffId: string; roleId: string; day: number; hiringCost: number };
  'staff:fired': { staffId: string; roleId: string; day: number };
  // Promotion moves an existing loyal staffer up a legal role edge (in place —
  // the staff id is preserved so morale/dispatch bindings survive). Cheaper,
  // loyalty-flavored alternative to hiring a cold candidate.
  'staff:promoted': { staffId: string; fromRoleId: string; toRoleId: string; day: number };

  // StaffOrg — the raise negotiation (#356, C1 R2). Growth never silently
  // reprices anyone: when a member's derived grade outgrows the grade their wage
  // is set at, they ASK, and the player answers. `staff:raise_requested` is
  // emitted on `clock:day_started` (grade only moves overnight, so the morning
  // is when it can have changed) for each member with no outstanding request and
  // no running refusal cooldown.
  //
  // This is the ONE retention/poaching family: a rival's offer is the same
  // moment with a name and a deadline on it, carried as extra fields here rather
  // than as a second event pair.
  'staff:raise_requested': {
    staffId: string;
    roleId: string;
    day: number;
    /** What they are on now — `wage(role, paidGrade)`. */
    currentWage: number;
    /** What they are asking for — `wage(role, grade)`. */
    askedWage: number;
    paidGrade: number;
    grade: number;
  };
  // Emitted by `acceptRaise` / `refuseRaise`. StaffMorale is the consumer: the
  // morale consequence of either answer lives there, because StaffOrg owns the
  // roster and never reaches into the morale dimension layered over it.
  'staff:raise_answered': {
    staffId: string;
    roleId: string;
    day: number;
    accepted: boolean;
    /** The wage they were on when they asked. */
    currentWage: number;
    /** The wage they asked for — what they are now on if `accepted`. */
    askedWage: number;
  };

  // StaffDispatch — salesperson auto-resolved a sales queue item
  'staff:auto_resolved': {
    customerId: string;
    staffId: string;
    day: number;
    outcome: 'closed' | 'no_sale';
    grossImpact: number;
    /**
     * Inventory-buyer match quality of the closed deal (#199): the want-axis
     * `fit` ∈ [0,1] of the vehicle `pickVehicleForMatch` selected — how well
     * the stocked unit met what the buyer wanted. Present only on
     * `outcome: 'closed'`; the loop's match-payoff beat (floor toast + recap
     * tally) thresholds this into "strong match". Omitted on `no_sale`.
     */
    matchQuality?: number;
    /**
     * The matched vehicle's category (#320, the engagement-spine starred-win
     * reaction) — the "what they got" half of the win narrative, paired with
     * `matchQuality` ("how well it fit"). Present only on `outcome: 'closed'`.
     */
    vehicleCategory?: 'sedan' | 'truck' | 'suv';
    /**
     * The customer's archetype label, e.g. `'Young Family'` — the same label
     * `customer:arrived` carries. Present on `outcome: 'closed'` (#320, the
     * "who" half of the starred win reaction) and on `outcome: 'no_sale'`
     * once a customer session was established (#321, the "who" half of the
     * starred walk-off reaction) — omitted only for the pre-session
     * `'no_session'`/`'not_sales'` reasons.
     */
    archetypeLabel?: string;
    /**
     * The customer's *wanted* vehicle category (#321) — nearest-category
     * classification off their want-vector (`wantedVehicleCategory`),
     * independent of any matched vehicle. Present only on `outcome: 'no_sale'`
     * once a customer session was established (same coverage as
     * `archetypeLabel` above); names the "what they wanted" half of the
     * starred walk-off reaction, used when the closed-deal `vehicleCategory`
     * (what they actually got) doesn't apply.
     */
    wantedCategory?: 'sedan' | 'truck' | 'suv';
    /**
     * Named reason for a `no_sale` outcome (#147 tracer): `'no_session'`,
     * `'not_sales'`, `'no_fit'`, `'no_close'`, the trade walks
     * (`'trade_negative_equity'` — underwater trade (#169);
     * `'trade_manager_declined'` — escalation manager refused (#170);
     * `'trade_player_declined'` — player refused a held trade (#201)), the
     * discount-review walks (`'discount_player_declined'` — player refused a
     * held discount; `'discount_below_cost'` — accepted price below cost;
     * `'discount_haggle_exhausted'` — counters ran out), or a SalesProcess
     * `WalkCause` (`'patience_drain' | 'trust_collapse' |
     * 'demo_nonnegotiable_miss'`). Omitted on `outcome: 'closed'`. An *unusual*
     * trade or discount escalated to the player emits its escalation event
     * instead (#170/#222).
     */
    reason?: string;
  };

  // StaffMorale — staff member quit due to low morale
  'staff:quit': { staffId: string; roleId: string; day: number; morale: number };

  // CapacityManager — customer admitted (within daily capacity)
  'capacity:customer_admitted': { day: number; customerId: string; label: string };

  // CapacityManager — customer turned away (demand exceeded capacity)
  'capacity:missed_opportunity': { day: number; customerId: string; label: string };

  // Reputation — customer satisfaction penalty (stub; Reputation module will consume this later)
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

  // InstalledBase (#300, parent #297) — the day's returning-owner service
  // stream. Emitted on clock:day_started after each due owner's seeded return
  // roll, for the future ServiceDemand to compose into the NPC-bound service
  // intake. Fires every day (possibly with an empty `returns`) so consumers get
  // a reliable daily signal. Deterministic from masterSeed + day + ownerId
  // (#122 replay-safe). Each entry carries the customer + vehicle identity and
  // the age-selected due job category.
  'installedBase:returns_ready': {
    day: number;
    returns: ReadonlyArray<{
      ownerId: string;
      customerId: string;
      vehicleId: string;
      category: string;
      powertrain: 'ice' | 'hybrid' | 'ev';
      jobCategory: 'oil_filters' | 'tires_brakes' | 'drivetrain' | 'electronics';
      ageDays: number;
    }>;
  };

  // InstalledBase repeat-buyer leads (#306, parent #297) — the day's aged-out,
  // still-loyal owners re-entering Sales as warm repeat buyers. Emitted on
  // clock:day_started alongside installedBase:returns_ready (fires every day,
  // possibly empty). The composition root maps each lead's `category` onto a
  // matching sales archetype and spawns it into CustomerPool. One lead per
  // ownership (deduped by the owner's persisted `repeatLeadEmitted`).
  'installedBase:repeat_buyer_ready': {
    day: number;
    leads: ReadonlyArray<{
      ownerId: string;
      customerId: string;
      vehicleId: string;
      category: string;
      loyalty: number;
    }>;
  };

  // InstalledBase permanent defection (#306, parent #297) — an owner left the
  // base for good: sustained bad service experiences (`reason` carries the last
  // outcome — 'missed'/'unserved'/'gouged') or sustained non-returns
  // ('sustained_non_return'). Terminal for that ownership record.
  'installedBase:owner_defected': {
    day: number;
    ownerId: string;
    customerId: string;
    reason: string;
  };

  // ServiceDemand (#302, parent #297) — the day's enriched service intake.
  // Composed on each installedBase:returns_ready: the returning owners folded in
  // as the primary stream plus a conquest floor of fresh walk-ins (scaled by
  // reputation × service marketing), each ticket carrying customer + vehicle
  // identity, the due job/parts category, and the base ticket revenue. This is
  // the stream that replaces ServiceQueue's synthetic seed × day roll (consumer
  // rewire is a later slice). Deterministic from masterSeed + day + the live
  // installed base (#122 replay-safe).
  'serviceDemand:intake_ready': {
    day: number;
    intake: ReadonlyArray<{
      ticketId: string;
      source: 'return' | 'conquest';
      customerId: string;
      vehicleId: string;
      category: string;
      powertrain: 'ice' | 'hybrid' | 'ev';
      jobCategory: 'oil_filters' | 'tires_brakes' | 'drivetrain' | 'electronics';
      baseRevenue: number;
    }>;
  };

  // ServiceQueue (#80, rewired #303 parent #297) — the day's enriched, NPC-bound
  // service intake. ServiceQueue subscribes to serviceDemand:intake_ready,
  // applies the Tier-2 gate, and re-publishes the stream (the synthetic seed×day
  // roll is retired) for DepartmentQueue (Service lane) + ServiceDispatch. Each
  // item carries the customer + vehicle identity, the due job/parts category, the
  // base ticket revenue, and a display label. ORDERING: fires within the
  // clock:day_started dispatch, downstream of
  // installedBase:returns_ready → serviceDemand:intake_ready (InstalledBase →
  // ServiceDemand → ServiceQueue), so the Service lane is populated before the
  // day's drain. Silent below Tier 2.
  'service:intake_ready': {
    day: number;
    items: ReadonlyArray<{
      serviceItemId: string;
      source: 'return' | 'conquest';
      customerId: string;
      vehicleId: string;
      category: string;
      powertrain: 'ice' | 'hybrid' | 'ev';
      jobCategory: 'oil_filters' | 'tires_brakes' | 'drivetrain' | 'electronics';
      baseRevenue: number;
      label: string;
    }>;
  };

  // ── Body Shop (#312–#317, parent #297) ─────────────────────────────────────
  // The Body Shop runs the SAME shared department assembly line as Service
  // (docs/planning/shared-department-structure.md, LOCKED) but feeds it from its
  // own recipe package. Per that doc's event-name decision (§ "Event-name
  // generalization"), we MIRROR the service:* set with a parallel bodyshop:* set
  // bound to the same resolver rather than collapsing both into a dept:* family —
  // this keeps the service:* payloads byte-stable (Service tests + persistence
  // envelopes don't churn). The category union widens to the four Body-Shop
  // collision categories. The dispatch/resolution bodyshop:* events
  // (ticket_closed / parts_consumed / job_missed …) join the catalog with the
  // Body-Shop drain slice (#314); #312 lands only the demand → queue pair.

  // CollisionStream (#313, the Body-Shop demand spine) — the day's enriched,
  // NPC-bound collision intake. Mirrors serviceDemand:intake_ready: each ticket
  // carries customer + vehicle identity, the due collision job/parts category,
  // and the base ticket revenue. `source` is the Body-Shop demand channel —
  // `insurance` (DRP claim work) vs `retail` (customer-pay) — the axis the
  // Body-Shop pricing satellite (insurance-DRP ↔ retail posture) reads. #312
  // ships the event shape with a placeholder feed; CollisionStream populates it.
  'bodyshop:demand_ready': {
    day: number;
    intake: ReadonlyArray<{
      ticketId: string;
      source: 'insurance' | 'retail';
      customerId: string;
      vehicleId: string;
      category: string;
      powertrain: 'ice' | 'hybrid' | 'ev';
      jobCategory: 'windows_glass' | 'doors_panels' | 'interior_trim' | 'paint';
      baseRevenue: number;
    }>;
  };

  // BodyShopQueue (#312, parent #297) — the day's enriched, NPC-bound Body-Shop
  // intake. The Tier-3 mirror of service:intake_ready: BodyShopQueue subscribes to
  // bodyshop:demand_ready, applies the Tier-3 gate, and re-publishes the stream
  // (each item gaining a display `label` derived from the collision job category)
  // for the Body-Shop lane + drain. ORDERING: fires within the clock:day_started
  // dispatch, downstream of bodyshop:demand_ready (CollisionStream → BodyShopQueue),
  // so the Body-Shop lane is populated before the day's drain. Silent below
  // Tier 3 (the Body Shop is dark until the showroom tier).
  'bodyshop:intake_ready': {
    day: number;
    items: ReadonlyArray<{
      bodyShopItemId: string;
      source: 'insurance' | 'retail';
      customerId: string;
      vehicleId: string;
      category: string;
      powertrain: 'ice' | 'hybrid' | 'ev';
      jobCategory: 'windows_glass' | 'doors_panels' | 'interior_trim' | 'paint';
      baseRevenue: number;
      label: string;
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

  // ServiceDispatch parts gate (#304, parent #297) — emitted by the shared
  // service resolver, which the legacy once-per-intake path AND the per-tick
  // floor drain both call (identical outcomes; only cadence differs). All three
  // fire within the same resolve step as service:ticket_closed, downstream of
  // service:intake_ready in the clock:day_started dispatch.

  // A completed job consumed one matching-category part from PartsInventory.
  // Fires immediately before the service:ticket_closed for that same ticket.
  'service:parts_consumed': {
    serviceItemId: string;
    day: number;
    jobCategory: 'oil_filters' | 'tires_brakes' | 'drivetrain' | 'electronics';
    advisorId: string;
  };

  // No matching part on hand and rush ordering not yet unlocked: the job is
  // turned away. The would-be ticket revenue is lost and a CSI hit feeds back
  // into base health / Reputation. TERMINAL for the ticket — no
  // service:ticket_closed fires for a missed job.
  'service:job_missed': {
    serviceItemId: string;
    day: number;
    customerId: string;
    vehicleId: string;
    jobCategory: 'oil_filters' | 'tires_brakes' | 'drivetrain' | 'electronics';
    lostRevenue: number;
    csiHit: number;
    advisorId: string;
  };

  // No matching part on hand but rush ordering is unlocked: an emergency rush
  // order (the premium supplier tier in PartsInventory) lets the job complete
  // instead of missing. Fires immediately before the service:ticket_closed for
  // that ticket; the premium cost is the rush-tier cash debit PartsInventory
  // posts on the order.
  'service:job_rushed': {
    serviceItemId: string;
    day: number;
    customerId: string;
    vehicleId: string;
    jobCategory: 'oil_filters' | 'tires_brakes' | 'drivetrain' | 'electronics';
    revenue: number;
    advisorId: string;
  };

  // ServiceDispatch capacity gate (#305, parent #297) — a job that backed up in
  // the queue past serviceDispatch.maxWaitTicks because concurrent capacity
  // (slots = min(bays, advisors on duty)) couldn't reach it leaves UNSERVED.
  // Distinct from service:job_missed (a parts-stockout): this is capacity
  // starvation, not a stockout. TERMINAL for the ticket — no
  // service:ticket_closed fires. The would-be revenue is lost and a CSI hit
  // feeds back into base health / Reputation. Drain path only (the legacy
  // once-per-intake path has no capacity model).
  'service:job_unserved': {
    serviceItemId: string;
    day: number;
    customerId: string;
    vehicleId: string;
    jobCategory: 'oil_filters' | 'tires_brakes' | 'drivetrain' | 'electronics';
    lostRevenue: number;
    csiHit: number;
    waitTicks: number;
  };

  // ── Body Shop dispatch (#314, parent #297) ─────────────────────────────────
  // The Body-Shop drain resolves bodyshop:intake_ready through the SAME shared
  // department-dispatch engine as Service (advisor pick, parts gate, min(bays,
  // advisors) capacity, read-model). Per the locked event-name decision (#312)
  // these MIRROR the service:* dispatch set as a parallel bodyshop:* family bound
  // to that same engine (NOT a collapsed dept:* family), keeping service:* payloads
  // byte-stable. The id field is `bodyShopItemId`; the jobCategory union is the
  // four Body-Shop collision categories. Revenue is governed by the insurance/
  // retail channel posture (insurance rate-capped, retail player-priced), so a
  // ticket carries no posture itself — the closed `revenue` already reflects it.

  // A Body-Shop ticket was auto-resolved by a body-shop advisor.
  'bodyshop:ticket_closed': {
    bodyShopItemId: string;
    day: number;
    revenue: number;
    advisorId: string;
  };

  // A completed Body-Shop job consumed one matching-category part from
  // PartsInventory. Fires immediately before bodyshop:ticket_closed for that
  // ticket.
  'bodyshop:parts_consumed': {
    bodyShopItemId: string;
    day: number;
    jobCategory: 'windows_glass' | 'doors_panels' | 'interior_trim' | 'paint';
    advisorId: string;
  };

  // No matching part on hand and rush ordering not yet unlocked: the job is turned
  // away. TERMINAL — no bodyshop:ticket_closed fires for a missed job.
  'bodyshop:job_missed': {
    bodyShopItemId: string;
    day: number;
    customerId: string;
    vehicleId: string;
    jobCategory: 'windows_glass' | 'doors_panels' | 'interior_trim' | 'paint';
    lostRevenue: number;
    csiHit: number;
    advisorId: string;
  };

  // No matching part on hand but rush ordering is unlocked: an emergency rush
  // order lets the job complete instead of missing. Fires immediately before
  // bodyshop:ticket_closed for that ticket.
  'bodyshop:job_rushed': {
    bodyShopItemId: string;
    day: number;
    customerId: string;
    vehicleId: string;
    jobCategory: 'windows_glass' | 'doors_panels' | 'interior_trim' | 'paint';
    revenue: number;
    advisorId: string;
  };

  // A Body-Shop job that backed up past the dispatch maxWaitTicks because
  // concurrent capacity (slots = min(bays, advisors on duty)) couldn't reach it
  // leaves UNSERVED. Distinct from bodyshop:job_missed (a parts stockout):
  // capacity starvation. TERMINAL — no bodyshop:ticket_closed fires. Drain only.
  'bodyshop:job_unserved': {
    bodyShopItemId: string;
    day: number;
    customerId: string;
    vehicleId: string;
    jobCategory: 'windows_glass' | 'doors_panels' | 'interior_trim' | 'paint';
    lostRevenue: number;
    csiHit: number;
    waitTicks: number;
  };
}

export type EventName = keyof EventMap;
export type EventPayload<K extends EventName> = EventMap[K];
export type EventListener<K extends EventName> = (payload: EventPayload<K>) => void;
