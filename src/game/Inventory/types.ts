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
}
