import type { EventBus } from '../EventBus';
import type {
  DayRange,
  DealRecord,
  KPIDayTotals,
  KPISnapshot,
  KPIDashboardSnapshot,
} from './types';

export interface KPIDashboard {
  /**
   * The computed read-model. With no argument this is the career-to-date read;
   * with a `range` it is the same math over the deals that closed inside that
   * inclusive day window (#351) — the Finance dashboard's time-range chips.
   * `dailyCarryingCost` is a live burn rate, not an accrual, so it rides every
   * snapshot unchanged regardless of the window.
   */
  getSnapshot(range?: DayRange): KPISnapshot;
  /**
   * Per-day retail flow across the window (#351), oldest→newest, one entry for
   * every day in the range including days with no deals. The series behind the
   * dashboard's sparklines and hero trend chart.
   */
  getDailyTotals(range: DayRange): readonly KPIDayTotals[];
  snapshot(): KPIDashboardSnapshot;
  restore(snap: KPIDashboardSnapshot): void;
}

export interface KPIDashboardDeps {
  bus: EventBus;
  /**
   * Live current-day read — the clock's `currentDay` (#351), the same provider
   * shape `TierGate` takes. `deal:closed` carries no day, and a private cursor
   * latched off the bus would read 1 for the rest of a session resumed from a
   * save (a restore fires no `clock:day_started`), silently stamping a whole
   * day of deals onto day 1. The clock owns the day; this module asks it.
   *
   * Optional only as a test seam; defaults to day 1.
   */
  getCurrentDay?: () => number;
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
  productGross: 0,
  reserveGross: 0,
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
  let totalProduct = 0;
  let totalReserve = 0;
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
    totalProduct += d.productGross ?? 0;
    totalReserve += d.reserveGross ?? 0;
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
    productGross: totalProduct,
    reserveGross: totalReserve,
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
  const getCurrentDay = deps.getCurrentDay ?? (() => 1);

  bus.subscribe('economy:carrying_cost_posted', (payload) => {
    dailyCarryingCost = payload.totalCost;
  });

  bus.subscribe('deal:closed', (payload) => {
    deals.push({
      day: getCurrentDay(),
      frontGross: payload.frontGross,
      backGross: payload.backGross,
      productGross: payload.productGross,
      reserveGross: payload.reserveGross,
      daysInInventory: payload.daysInInventory,
      agreedPrice: payload.agreedPrice,
      paymentMethod: payload.paymentMethod,
      downPayment: payload.downPayment,
      term: payload.term,
      apr: payload.apr,
    });
  });

  function inRange(range: DayRange): DealRecord[] {
    return deals.filter((d) => d.day >= range.fromDay && d.day <= range.toDay);
  }

  return {
    getSnapshot(range?: DayRange): KPISnapshot {
      return computeSnapshot(range ? inRange(range) : deals, dailyCarryingCost);
    },

    getDailyTotals(range): readonly KPIDayTotals[] {
      const byDay = new Map<
        number,
        { units: number; front: number; back: number; product: number; reserve: number }
      >();
      for (const d of inRange(range)) {
        const bucket =
          byDay.get(d.day) ?? { units: 0, front: 0, back: 0, product: 0, reserve: 0 };
        bucket.units += 1;
        bucket.front += d.frontGross;
        bucket.back += d.backGross;
        bucket.product += d.productGross ?? 0;
        bucket.reserve += d.reserveGross ?? 0;
        byDay.set(d.day, bucket);
      }
      const out: KPIDayTotals[] = [];
      // Every day in the window gets a row, traded or not — a series that skips
      // the quiet days draws a shape the business never had.
      for (let day = range.fromDay; day <= range.toDay; day++) {
        const bucket = byDay.get(day);
        out.push({
          day,
          units: bucket?.units ?? 0,
          frontGross: bucket?.front ?? 0,
          backGross: bucket?.back ?? 0,
          productGross: bucket?.product ?? 0,
          reserveGross: bucket?.reserve ?? 0,
          gross: (bucket?.front ?? 0) + (bucket?.back ?? 0),
        });
      }
      return out;
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
      // Pre-#351 records have no day. Stamping 0 keeps them in the lifetime
      // read while excluding them from every real (day ≥ 1) window, rather
      // than inventing a day they did not close on.
      // #365: a deal written before the back-end split carries neither half.
      // Zeroing both keeps its `backGross` intact in every total while
      // refusing to attribute it to products or reserve, which is the only
      // honest reading of a record that never recorded the difference.
      deals.push(
        ...snap.deals.map((d) => ({
          ...d,
          day: d.day ?? 0,
          productGross: d.productGross ?? 0,
          reserveGross: d.reserveGross ?? 0,
        })),
      );
      dailyCarryingCost = snap.dailyCarryingCost;
    },
  };
}
