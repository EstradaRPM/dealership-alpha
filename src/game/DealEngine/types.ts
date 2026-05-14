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
