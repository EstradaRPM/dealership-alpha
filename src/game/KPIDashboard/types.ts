export interface DealRecord {
  frontGross: number;
  backGross: number;
  daysInInventory: number;
}

export interface KPISnapshot {
  unitsRetailed: number;
  pvr: number;
  fniPpru: number;
  avgFrontGross: number;
  avgBackGross: number;
  avgDii: number;
}
