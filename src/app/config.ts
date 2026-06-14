// Module-level configuration for the app composition root.
//
// All of this is seed-free, built once at module load, and was formerly inlined
// at the top of App.tsx (#242 decomposition). Pulling it here keeps the React
// tree (AppRoot + the state hooks) free of the tunable-loading + pure-builder
// noise, and gives UI slices one stable place to read these from instead of
// editing the 1.8k-line App.tsx.
import { type ImageSourcePropType } from 'react-native';
import { loadTunables } from '../game/data';
import { loadTradePolicyConfig } from '../game/DealEngine';
import { loadInventoryConfig } from '../game/Inventory';
import { loadStaffArchetypes, loadStaffTaxonomy } from '../game/NPC';
import { loadPricingStrategiesConfig } from '../game/MarketEconomy';
import { loadRegulatoryTunables } from '../game/Reputation';
import { loadTierConfig } from '../game/CareerProgression';
import { SALES_ARCHETYPES } from '../game/CustomerPool';
import type { World } from '../createWorld';
import type { DeptKey } from '../game/DepartmentQueue';
import type { LotVehicle } from '../game/Inventory';
import type { PersonnelRoleOption } from '../ui/PersonnelScreen';
import type { CashDeltaSplit } from '../ui/HomeTab';
import type {
  DemandCoverageGap,
  DemandReadoutEntry,
  DemandTargetingLever,
} from '../ui/DemandReadout';

// Tier-keyed hero art for the shell's header backdrop. Metro requires static
// require() calls — the map must live at module scope.
export const HERO_BY_TIER: Partial<Record<number, ImageSourcePropType>> = {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  1: require('../../assets/hero/lot-tier1.jpg'),
  // 2 and 3 added when art lands (#251)
};

export const DEPT_TITLES: Record<DeptKey, string> = {
  sales: 'Sales',
  service: 'Service',
  bdc: 'BDC',
  office: 'Office',
  lot: 'Lot',
};

// Hand-play modal default (#118): sourced from a tunable, never a magic
// number. false ⇒ opening the modal auto-pauses the day; true ⇒ the day
// keeps running live behind it (the #74/#105 felt-pacing comparison path).
export const HAND_PLAY_LIVE = loadTunables().handPlay.playtestLiveDefault;

// Representative open-hours window for the FLOOR-OPEN HUD clock (#121).
export const RENDER_LOOP = loadTunables().renderLoop;

// Want-axis fit a closed deal must clear to count as a "strong match" (#199) —
// drives the floor toast + DayRecap tally. Tunable, never a magic number.
export const STRONG_MATCH_THRESHOLD =
  loadTunables().matchPayoff.strongMatchThreshold;

// Hours-of-op lever options (#120/#207). The selected option's scaled
// ticksPerDay is fed into FloorSim (via getHoursOfOpTicksPerDay → createWorld →
// the floor seam → createFloorSim's additive ticksPerDay override), so a longer
// shift literally runs more ticks — observable on the FLOOR-OPEN HUD clock.
export const HOURS_OF_OP = loadTunables().ownership.hoursOfOp;

// Paid pre-purchase inspection cost shown on the auction-board action (#164).
export const INSPECTION_COST = loadInventoryConfig().inspection.cost;

// Aged-unit threshold for the pricing-screen aging warning (#173/#175).
export const AGED_THRESHOLD_DAYS = loadInventoryConfig().carrying.agedThresholdDays;

// Trade-acquisition policy catalog (#172). Seed-free; the selected id persists
// per save slot and resolves to the acceptance-target multiplier the trade
// resolver reads. Default = market (1.0).
export const TRADE_POLICY = loadTradePolicyConfig();

// List-price strategy catalog (#154). Seed-free; the selected id persists per
// save slot and drives the staff-suggested list price on the pricing screen
// (#175). Default = market.
export const PRICING_STRATEGIES = loadPricingStrategiesConfig();
export const PRICING_STRATEGY_OPTIONS = Object.entries(
  PRICING_STRATEGIES.strategies,
).map(([id, s]) => ({ id, label: s.label, blurb: s.blurb }));
export const REGULATORY_TUNABLES = loadRegulatoryTunables();

// Tier ladder labels for the shell header (#215). Seed-free.
export const TIER_CONFIG = loadTierConfig();

export const DEFAULT_HIRING_ROLE_ID = 'salesperson';

// staffTaxonomy is seed-free: kept module-level so SKILL_CAPS (PersonnelScreen
// bars, #120) and the FLOOR-OPEN staff-strip department lookup don't depend on
// a built World.
export const staffTaxonomy = loadStaffTaxonomy();
export const staffArchetypes = loadStaffArchetypes();
// skill_id → cap, for the PersonnelScreen skill bars (Hiring lever, #120).
export const SKILL_CAPS: Record<string, number> = Object.fromEntries(
  Object.entries(staffTaxonomy.skills).map(([id, s]) => [id, s.cap]),
);

// role_id → humanized label + serving department, for the impressionistic
// FLOOR-OPEN staff strip (#117). Pure read mapping off the role catalog.
export function humanizeRole(roleId: string): string {
  return roleId
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

const HIRABLE_ROLE_IDS = new Set(
  Object.values(staffArchetypes).map((a) => a.role_id),
);

export function buildHiringRoleOptions(tier: number): PersonnelRoleOption[] {
  return Object.entries(staffTaxonomy.roles)
    .filter(([roleId, role]) => {
      if (!HIRABLE_ROLE_IDS.has(roleId)) return false;
      if (
        roleId !== DEFAULT_HIRING_ROLE_ID &&
        role.tier !== 'manager' &&
        role.tier !== 'gm'
      ) {
        return false;
      }
      return (role.hireTier ?? 1) <= tier;
    })
    .map(([id]) => ({ id, label: humanizeRole(id) }))
    .sort((a, b) => {
      if (a.id === DEFAULT_HIRING_ROLE_ID) return -1;
      if (b.id === DEFAULT_HIRING_ROLE_ID) return 1;
      return a.label.localeCompare(b.label);
    });
}

// persona id → human label for the #198 observed-mix readout. Sourced from the
// same SALES_ARCHETYPES table the spawn draw resolves against — never a magic
// string list.
export const PERSONA_LABELS: Record<string, string> = Object.fromEntries(
  SALES_ARCHETYPES.map((a) => [a.personId, a.label]),
);
const DEMAND_SHAPER = loadTunables().demandShaper;
const COVERAGE_CATEGORY_LABELS: Record<string, string> = {
  sedan: 'sedans',
  truck: 'trucks',
  suv: 'SUVs',
};

export function buildTargetingLevers(world: World): DemandTargetingLever[] {
  return world.demandShaper.getInfluenceInputs().map((input) => ({
    id: input.id,
    label: input.label,
    lean: Object.entries(input.weights)
      .filter(([, weight]) => weight > 0)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([persona, weight]) => ({
        persona,
        label: PERSONA_LABELS[persona] ?? persona,
        weight,
      })),
  }));
}

export function buildCoverageGap(
  entries: readonly DemandReadoutEntry[],
  lotVehicles: readonly LotVehicle[],
): DemandCoverageGap | null {
  const personaCategory = DEMAND_SHAPER.coverageCategoryByPersona ?? {};
  const wantedByCategory: Record<string, number> = {};
  for (const entry of entries) {
    const category = personaCategory[entry.persona];
    if (!category) continue;
    wantedByCategory[category] = (wantedByCategory[category] ?? 0) + entry.count;
  }
  const stockedByCategory: Record<string, number> = {};
  for (const vehicle of lotVehicles) {
    stockedByCategory[vehicle.category] =
      (stockedByCategory[vehicle.category] ?? 0) + 1;
  }
  const [category, wantedCount] =
    Object.entries(wantedByCategory)
      .filter(([, wanted]) => wanted > 0)
      .sort(([, a], [, b]) => b - a)
      .find(([category]) => (stockedByCategory[category] ?? 0) === 0) ?? [];
  if (!category || wantedCount == null) return null;
  return {
    category,
    label: COVERAGE_CATEGORY_LABELS[category] ?? category,
    wantedCount,
    stockCount: stockedByCategory[category] ?? 0,
  };
}

// Month-close cadence — sourced from the same tunable GameClock uses, never
// a magic number. clock:month_ended fires on endingDay % daysPerMonth === 0.
export const DAYS_PER_MONTH = loadTunables().clock.daysPerMonth;

// Shape-check the persisted cash-delta split (#255) coming back out of the
// untyped save envelope; anything malformed degrades to "no delta yet".
export function readPersistedCashDelta(value: unknown): CashDeltaSplit | null {
  if (value == null || typeof value !== 'object') return null;
  const { ops, stock } = value as Partial<CashDeltaSplit>;
  return typeof ops === 'number' && typeof stock === 'number'
    ? { ops, stock }
    : null;
}
