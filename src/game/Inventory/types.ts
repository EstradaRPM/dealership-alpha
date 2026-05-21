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

export interface LotVehicle {
  readonly id: string;
  readonly templateId: string;
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
