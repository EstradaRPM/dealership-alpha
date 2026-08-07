export type CreditTier = 'A' | 'B' | 'C' | 'D';

export interface TierDef {
  minScore: number;
  apr: number;
  maxTerm: number;
  ptiCap: number;
  minDownPct: number;
  ltvCeiling: number;
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
  // Deal-structuring fields (round-tripped to deal:closed for KPI splits, #148).
  // Optional for caller convenience — when omitted, defaults to a cash deal
  // (downPayment=agreedPrice, loanAmount=0, term=0, apr=0). Production callers
  // (CustomerPool real-close, #147 StaffDispatch tracer) supply them
  // explicitly; legacy tests that don't care about deal-structure rely on the
  // default. Either supply paymentMethod or omit all five.
  paymentMethod?: 'cash' | 'finance';
  downPayment?: number;
  loanAmount?: number;
  /** Months; 0 for cash. */
  term?: number;
  /** Annualized rate as a decimal; 0 for cash. */
  apr?: number;
  /**
   * How the buyer read the visit that produced this close (#363) — round-tripped
   * to `deal:closed` so `CustomerPool` can publish the honest scalars on
   * `customer:resolved` instead of re-running the sales process against a stub
   * vehicle. DealEngine does not read it; the close flow that ran the process
   * (StaffDispatch) is the only caller that can know it. Omit when no sales
   * process ran.
   */
  salesQuality?: DealSalesQuality;
}

/** @see CloseDealParams.salesQuality */
export interface DealSalesQuality {
  receptivity: number;
  satisfaction: number;
  retentionSeed: number;
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
  paymentMethod: 'cash' | 'finance';
  downPayment: number;
  loanAmount: number;
  term: number;
  apr: number;
}
