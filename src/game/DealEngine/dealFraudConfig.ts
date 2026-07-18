/**
 * Payment-packing fraud tunables (#327). A *financed* deal whose total F&I
 * retail burden exceeds `packFraction` of the vehicle price is treated as
 * payment packing — inflating the monthly payment with undisclosed back-end
 * markup, a structuring/disclosure violation that produces indictment pressure.
 */
export interface DealFraudConfig {
  schemaVersion: number;
  /**
   * Fraud trips when `sum(fniProduct.price) > agreedPrice * packFraction` on a
   * financed deal. Set high enough that normal attach never trips it — only
   * egregious stacking (heavy F&I on cheap metal) crosses it.
   */
  packFraction: number;
}

export function loadDealFraudConfig(): DealFraudConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../../../data/deal-fraud.json') as DealFraudConfig;
}
