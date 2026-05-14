import type { EventBus } from '../EventBus';
import type { StaffOrg } from '../StaffOrg';
import type { DealRecord, KPISnapshot } from './types';

export interface KPIDashboard {
  readonly isUnlocked: boolean;
  getSnapshot(): KPISnapshot;
}

export interface KPIDashboardDeps {
  bus: EventBus;
  staffOrg: StaffOrg;
}

const ZERO_SNAPSHOT: KPISnapshot = {
  unitsRetailed: 0,
  pvr: 0,
  fniPpru: 0,
  avgFrontGross: 0,
  avgBackGross: 0,
  avgDii: 0,
};

function computeSnapshot(deals: readonly DealRecord[]): KPISnapshot {
  const n = deals.length;
  if (n === 0) return ZERO_SNAPSHOT;

  let totalFront = 0;
  let totalBack = 0;
  let totalDii = 0;
  for (const d of deals) {
    totalFront += d.frontGross;
    totalBack += d.backGross;
    totalDii += d.daysInInventory;
  }

  return {
    unitsRetailed: n,
    pvr: (totalFront + totalBack) / n,
    fniPpru: totalBack / n,
    avgFrontGross: totalFront / n,
    avgBackGross: totalBack / n,
    avgDii: totalDii / n,
  };
}

export function createKPIDashboard(deps: KPIDashboardDeps): KPIDashboard {
  const { bus, staffOrg } = deps;
  const deals: DealRecord[] = [];

  bus.subscribe('deal:closed', ({ frontGross, backGross, daysInInventory }) => {
    deals.push({ frontGross, backGross, daysInInventory });
  });

  return {
    get isUnlocked(): boolean {
      return staffOrg.currentRoster.some((s) => s.role_id === 'gm');
    },

    getSnapshot(): KPISnapshot {
      return computeSnapshot(deals);
    },
  };
}
