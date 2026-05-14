export type CreditTier = 'A' | 'B' | 'C' | 'D';

export interface TierDef {
  minScore: number;
  apr: number;
}

export interface CreditTierCatalog {
  schemaVersion: number;
  tiers: Record<CreditTier, TierDef>;
}

export interface LoanParams {
  price: number;
  down: number;
  termMonths: number;
  tier: CreditTier;
}

export interface LoanResult {
  principal: number;
  apr: number;
  monthlyPayment: number;
}

export interface CloseDealParams {
  customerId: string;
  vehicleId: string;
  agreedPrice: number;
}

export interface ClosedDealResult {
  customerId: string;
  vehicleId: string;
  year: number;
  make: string;
  model: string;
  agreedPrice: number;
  purchasePrice: number;
  reconCost: number;
  frontGross: number;
  readonly backGross: 0;
}
