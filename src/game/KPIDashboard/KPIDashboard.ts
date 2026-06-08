import type { EventBus } from '../EventBus';
import type { DealRecord, KPISnapshot, KPIDashboardSnapshot } from './types';

export interface KPIDashboard {
  getSnapshot(): KPISnapshot;
  snapshot(): KPIDashboardSnapshot;
  restore(snap: KPIDashboardSnapshot): void;
}

export interface KPIDashboardDeps {
  bus: EventBus;
}

// Threshold above which a finance deal is bucketed as "heavy-down" (a
// hybrid-style pattern the player wants to see broken out). Tunable here so
// future calibration doesn't touch logic.
const HEAVY_DOWN_THRESHOLD = 0.25;

const ZERO_SNAPSHOT: KPISnapshot = {
  unitsRetailed: 0,
  pvr: 0,
  fniPpru: 0,
  avgFrontGross: 0,
  avgBackGross: 0,
  avgDii: 0,
  cashUnits: 0,
  cashGross: 0,
  financeUnits: 0,
  financeGross: 0,
  heavyDownUnits: 0,
  avgApr: 0,
  avgTerm: 0,
  avgDownPct: 0,
  dailyCarryingCost: 0,
};

function computeSnapshot(
  deals: readonly DealRecord[],
  dailyCarryingCost: number,
): KPISnapshot {
  const n = deals.length;
  if (n === 0) return { ...ZERO_SNAPSHOT, dailyCarryingCost };

  let totalFront = 0;
  let totalBack = 0;
  let totalDii = 0;
  let cashUnits = 0;
  let cashGross = 0;
  let financeUnits = 0;
  let financeGross = 0;
  let heavyDownUnits = 0;
  let totalApr = 0;
  let totalTerm = 0;
  let totalDownPct = 0;

  for (const d of deals) {
    totalFront += d.frontGross;
    totalBack += d.backGross;
    totalDii += d.daysInInventory;
    const dealGross = d.frontGross + d.backGross;
    if (d.paymentMethod === 'cash') {
      cashUnits += 1;
      cashGross += dealGross;
    } else {
      financeUnits += 1;
      financeGross += dealGross;
      totalApr += d.apr;
      totalTerm += d.term;
      const downPct = d.agreedPrice > 0 ? d.downPayment / d.agreedPrice : 0;
      totalDownPct += downPct;
      if (downPct >= HEAVY_DOWN_THRESHOLD) heavyDownUnits += 1;
    }
  }

  return {
    unitsRetailed: n,
    pvr: (totalFront + totalBack) / n,
    fniPpru: totalBack / n,
    avgFrontGross: totalFront / n,
    avgBackGross: totalBack / n,
    avgDii: totalDii / n,
    cashUnits,
    cashGross,
    financeUnits,
    financeGross,
    heavyDownUnits,
    avgApr: financeUnits > 0 ? totalApr / financeUnits : 0,
    avgTerm: financeUnits > 0 ? totalTerm / financeUnits : 0,
    avgDownPct: financeUnits > 0 ? totalDownPct / financeUnits : 0,
    dailyCarryingCost,
  };
}

export function createKPIDashboard(deps: KPIDashboardDeps): KPIDashboard {
  const { bus } = deps;
  const deals: DealRecord[] = [];
  // Latest day's lot-wide floorplan + carrying burn (#173). Tracked off the
  // bus so the snapshot can surface it as a line item without Inventory access.
  let dailyCarryingCost = 0;

  bus.subscribe('economy:carrying_cost_posted', (payload) => {
    dailyCarryingCost = payload.totalCost;
  });

  bus.subscribe('deal:closed', (payload) => {
    deals.push({
      frontGross: payload.frontGross,
      backGross: payload.backGross,
      daysInInventory: payload.daysInInventory,
      agreedPrice: payload.agreedPrice,
      paymentMethod: payload.paymentMethod,
      downPayment: payload.downPayment,
      term: payload.term,
      apr: payload.apr,
    });
  });

  return {
    getSnapshot(): KPISnapshot {
      return computeSnapshot(deals, dailyCarryingCost);
    },

    snapshot(): KPIDashboardSnapshot {
      return {
        schemaVersion: 1,
        deals: deals.map((d) => ({ ...d })),
        dailyCarryingCost,
      };
    },

    restore(snap) {
      deals.length = 0;
      deals.push(...snap.deals.map((d) => ({ ...d })));
      dailyCarryingCost = snap.dailyCarryingCost;
    },
  };
}
