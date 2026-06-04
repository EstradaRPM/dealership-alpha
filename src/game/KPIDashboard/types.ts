export interface DealRecord {
  frontGross: number;
  backGross: number;
  daysInInventory: number;
  agreedPrice: number;
  paymentMethod: 'cash' | 'finance';
  downPayment: number;
  term: number;
  apr: number;
}

export interface KPISnapshot {
  unitsRetailed: number;
  pvr: number;
  fniPpru: number;
  avgFrontGross: number;
  avgBackGross: number;
  avgDii: number;
  cashUnits: number;
  cashGross: number;
  financeUnits: number;
  financeGross: number;
  heavyDownUnits: number;
  avgApr: number;
  avgTerm: number;
  avgDownPct: number;
  /**
   * Total floorplan + carrying cost burned on the most recent day (#173), off
   * the latest `economy:carrying_cost_posted`. The day's lot-wide burn rate;
   * full month-to-date aggregation lands in slice #25.
   */
  dailyCarryingCost: number;
}
