export type VehicleCondition = 'clean' | 'average' | 'rough';
export type VehicleCategory = 'sedan' | 'truck' | 'suv';

export interface InspectionResult {
  readonly reconLow: number;
  readonly reconHigh: number;
}

export type InspectionStatus = 'none' | 'pending' | 'completed';

export interface AuctionListing {
  readonly id: string;
  readonly templateId: string;
  /** Opaque canonical brand id (join key); never a display string. */
  readonly brand: string;
  readonly year: number;
  readonly make: string;
  readonly model: string;
  readonly trim: string;
  readonly mileage: number;
  readonly condition: VehicleCondition;
  readonly conditionReport: string;
  readonly askingPrice: number;
  readonly reconCost: number;
  readonly category: VehicleCategory;
  /**
   * Auction source the listing came from (slice #160). Each save rolls a
   * hidden reliability per source — the player learns which lanes produce
   * honest book vs. wild swings.
   */
  readonly sourceId: string;
  /**
   * Paid pre-purchase inspection state (#164). `none` = no inspection
   * requested; `pending` = paid, awaiting result (purchase blocked); `completed`
   * = result ready, listing held into a single follow-up day for purchase.
   */
  readonly inspectionStatus: InspectionStatus;
  /** Day the inspection result becomes available (and purchase unblocks). */
  readonly inspectionAvailableDay?: number;
  /**
   * Tightened recon band produced by the inspection (#164). Centered on the
   * realized recon truth with half-width = realized × halfWidthFraction.
   */
  readonly inspectionResult?: InspectionResult;
}

/**
 * Input to `Inventory.acquireFromTrade` (#171) — the customer's trade vehicle
 * (the car they drove in on, structurally the `trade:resolved` `currentVehicle`
 * snapshot) plus the negotiated terms. `agreedAllowance` becomes the lot
 * vehicle's cost basis (non-cash: offset against deal cash, never posted as an
 * Economy expense). `staffConfidence` is the UCM condition-read confidence at
 * acquisition (0 = no UCM); it feeds the recon-variance roll's source-reliability
 * gate, so a confident appraisal clusters realized recon near the estimate while
 * an unread trade throws the same wide lemon tails as a fringe auction lane.
 */
export interface TradeAcquisitionInput {
  readonly customerId: string;
  readonly currentVehicle: {
    readonly templateId: string;
    readonly brand: string;
    readonly make: string;
    readonly model: string;
    readonly year: number;
    readonly mileage: number;
    readonly condition: VehicleCondition;
    readonly category: VehicleCategory;
    readonly loanPayoff: number | null;
  };
  /** Agreed trade allowance = the acquired unit's cost basis (non-cash). */
  readonly agreedAllowance: number;
  /** UCM condition-read confidence at acquisition (0 = no UCM). */
  readonly staffConfidence: number;
}

export interface LotVehicle {
  readonly id: string;
  readonly templateId: string;
  /** Opaque canonical brand id (join key); never a display string. */
  readonly brand: string;
  readonly year: number;
  readonly make: string;
  readonly model: string;
  readonly trim: string;
  readonly mileage: number;
  readonly condition: VehicleCondition;
  readonly conditionReport: string;
  readonly purchasePrice: number;
  readonly reconCost: number;
  readonly category: VehicleCategory;
  readonly arrivalDay: number;
  readonly daysInInventory: number;
  /**
   * Accumulated floorplan + carrying cost posted against this unit since it
   * landed on the lot (#173). Grows by `dailyCarryingCost` on each daily tick.
   */
  readonly carryingCostToDate: number;
  /**
   * The carrying cost posted on the most recent daily tick (#173) — the unit's
   * current daily burn rate, surfaced on the lot view.
   */
  readonly dailyCarryingCost: number;
  /**
   * `true` once `daysInInventory` exceeds the tunable aged threshold (#173).
   * Computed on the daily tick so the UI can flag stale inventory without
   * re-reading config.
   */
  readonly aged: boolean;
  /**
   * Market-suggested retail (vAuto-style). v1 has no market/economy engine,
   * so this is a flat cost-basis placeholder (`purchasePrice + reconCost`);
   * the future simulated retail-value engine drops in here without changing
   * the Pricing lever or any consumer.
   */
  readonly suggestedRetail: number;
  /**
   * Player-set asking price (the MANAGERIAL Pricing lever, #120). Defaults to
   * `suggestedRetail`; the player decides how to interpret the suggestion
   * (profit vs. traffic). Deep DealEngine consumption is a downstream slice.
   */
  readonly askingPrice: number;
  /**
   * Recon process state (slice #162). Vehicles enter recon on purchase. The
   * estimate displayed at auction (`reconCost`) is what the player budgeted;
   * the hidden realized cost may exceed it (asymmetric long tail gated by
   * condition × source-reliability × mileage extreme). When realized exceeds
   * estimate by `surpriseThreshold`, recon pauses and an
   * `inventory:recon_surprise` event fires — the player must `authorizeReconSpend`
   * or `abandonRecon`.
   */
  readonly reconStatus: 'in_progress' | 'paused_for_decision' | 'complete' | 'abandoned';
  /** Auction-listed recon estimate (the player's budget at point of purchase). */
  readonly reconEstimate: number;
  /**
   * Hidden realized recon total rolled at acquisition. Convention: presented
   * to the player only piecewise via daily spend ticks and surprise events,
   * not surfaced directly in UI. Engine + tests read this for determinism.
   */
  readonly reconRealizedCost: number;
  readonly reconDaysRemaining: number;
  readonly reconDaysTotal: number;
  /**
   * Tail-bucket the realized cost came from. `within` for routine recon
   * (≤ surpriseThreshold over estimate), tail buckets seed the surprise
   * event template selection.
   */
  readonly reconBucket: 'within' | 'minor' | 'major' | 'catastrophic';
}
