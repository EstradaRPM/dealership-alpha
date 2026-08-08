export type CreditTier = 'A' | 'B' | 'C' | 'D';

export interface TierDef {
  minScore: number;
  /**
   * The LENDER's cost of money on this program (#365) — what the store buys the
   * paper at, never what the customer is quoted. The customer's rate is
   * `buyRate + markup`; the dealer keeps a share of that spread as reserve.
   * Renamed from `apr`, which was the lie: the tier table has always held the
   * wholesale rate and called it the retail one.
   */
  buyRate: number;
  /** Maximum rate markup this lender allows, in points of APR (0.025 = 2.5). */
  markupCapPts: number;
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
}

/** `LoanParams` plus the credit tier whose program the engine should quote. */
export interface StructureParams extends LoanParams {
  tier: CreditTier;
}

export interface LoanResult {
  principal: number;
  /** The rate the payment was actually built from — the CUSTOMER's rate. */
  apr: number;
  monthlyPayment: number;
}

/**
 * Finance reserve tunables (#365), the `fniReserve` section of
 * `data/tunables.json`.
 */
export interface FniReserveConfig {
  /** The dealer's share of the discounted rate spread; the lender keeps the rest. */
  dealerSharePct: number;
  /** Markup a store with no `f&i-manager` on the desk earns, in points of APR. */
  ambientMarkupPts: number;
  /** The target an F&I desk works to at the Balanced posture (#366 makes it a dial). */
  balancedMarkupPts: number;
}

/**
 * What the store quotes a financed customer (#365) — resolved once per deal and
 * read by BOTH the affordability gate and the close, so the rate the payment is
 * measured against and the rate the contract is written at can never disagree.
 */
export interface FinanceQuote {
  /** The lender's cost of money. */
  readonly buyRate: number;
  /** Resolved markup in points of APR, already clamped to the tier's cap. */
  readonly markupPts: number;
  /** `buyRate + markupPts` — the rate the customer pays. */
  readonly customerRate: number;
}

/** Inputs to the reserve calculation (#365). */
export interface ReserveInput {
  readonly amountFinanced: number;
  readonly termMonths: number;
  readonly buyRate: number;
  /** `buyRate + markup`; equal to `buyRate` means no spread and no reserve. */
  readonly customerRate: number;
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
  /** The CUSTOMER's annualized rate as a decimal (`buyRate + markup`); 0 for cash. */
  apr?: number;
  /**
   * The lender's cost of money behind `apr` (#365). The reserve the store earns
   * is its share of the discounted spread between the two, so a caller that
   * omits this earns none: omitted ⇒ `apr`, i.e. zero spread. Production callers
   * (StaffDispatch, CustomerPool) pass the `FinanceQuote` they already resolved
   * for the affordability gate; legacy harnesses that only care about deal
   * structure keep their pre-#365 numbers.
   */
  buyRate?: number;
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
  /** `productGross + reserveGross` — the total back end (#365). */
  backGross: number;
  /** Margin on the F&I products that attached. */
  productGross: number;
  /** The store's share of the discounted rate spread; 0 on a cash deal. */
  reserveGross: number;
  daysInInventory: number;
  fniProducts: AttachedFniProduct[];
  paymentMethod: 'cash' | 'finance';
  downPayment: number;
  loanAmount: number;
  term: number;
  apr: number;
}
