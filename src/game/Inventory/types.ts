export type VehicleCondition = 'clean' | 'average' | 'rough';
export type VehicleCategory = 'sedan' | 'truck' | 'suv';

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
}
