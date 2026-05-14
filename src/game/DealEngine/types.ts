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

export interface FniProduct {
  id: string;
  label: string;
  shortLabel: string;
  defaultPrice: number;
  cost: number;
  requiredRole?: string;
}

export interface FniAutoAttachConfig {
  baseAttachRates: Record<string, number>;
  skillMultiplierRange: [number, number];
}

export interface FniProductCatalog {
  schemaVersion: number;
  products: FniProduct[];
}

export interface AttachedFniProduct {
  productId: string;
  price: number;
}

export interface CloseDealParams {
  customerId: string;
  vehicleId: string;
  agreedPrice: number;
  fniProducts?: AttachedFniProduct[];
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
  backGross: number;
  daysInInventory: number;
  fniProducts: AttachedFniProduct[];
}
