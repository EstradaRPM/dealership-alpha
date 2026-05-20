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
}
