// ── Empty-state catalog (#389) ───────────────────────────────────────────────
// The one place the game says "there is nothing here yet". A region with
// nothing in it is the surface a brand-new player meets FIRST — before a single
// day has run, every list, panel and chart in the game is empty — so each of
// these sentences has to name what is missing AND what the player can do about
// it. A blank box is indistinguishable from a broken one.
//
// Copy is DATA, the #386 rule: `data/empty-states.json` holds every string and
// `tests/EmptyStates.test.tsx` fails the build if one appears as a literal
// under `src/`. That is what stops the same "nothing here yet" being worded
// three ways on three surfaces.
import { z } from 'zod';
import { parseData } from '../../game/data';

/**
 * Every region in the game that can be empty.
 *
 * The list is closed and the loader refuses a catalog missing any of it, so a
 * new empty region is a compile-time edit here plus a line of copy there —
 * never a list that silently renders as a blank box.
 *
 * Five ids are drawn from TWO places on purpose, because the same region is
 * reachable from two rooms: `demand_readout` (Home's market band and Growth's
 * demand console), `lot_no_spaces` (the Lot's sourcing block and the auction's
 * bidding notice), `parts_coverage` (Service and the Body Shop), `gate_trend`
 * (the Home gate strip and the Growth gate board) and `no_saved_games` (the
 * main menu and the in-game load list). Splitting one back into two gives the
 * player two wordings of one fact and two entries that can drift.
 */
export const EMPTY_STATE_IDS = [
  // Home
  'home_today',
  'home_glance_demand',
  'home_glance_campaign',
  // Shared: Home's market band and Growth's demand console
  'demand_readout',
  // Shared: the Home gate strip and the Growth gate board
  'gate_trend',
  // Growth
  'growth_weekly_report',
  'growth_wire',
  'growth_wire_headlines',
  'growth_finance_mix',
  'growth_finance_mix_locked',
  'growth_facility',
  'growth_facility_at_ceiling',
  'growth_gate_board',
  'growth_gate_faces',
  'growth_gate_streak',
  'demand_targeting_levers',
  // Finance
  'finance_no_deals',
  'finance_no_gross',
  'finance_no_departments',
  'finance_no_postings',
  'finance_no_spend',
  'finance_stat_trend',
  'finance_month_results',
  // People
  'people_department_roster',
  'people_hiring_no_role',
  'people_hiring_no_applicants',
  'people_roster_empty',
  'people_roster_full',
  'people_no_managers',
  'people_manager_absent',
  // The Lot and the auction
  'lot_stock_count',
  'lot_stock_list',
  'lot_no_spaces',
  'auction_bidding_closed',
  'auction_no_listings',
  // The department rooms
  'service_demand_heat',
  'body_shop_demand_heat',
  'parts_coverage',
  'department_queue',
  // The market read
  'market_state_segments',
  'market_state_shocks',
  // The live floor
  'floor_roster',
  'floor_recent_events',
  // Everything else with a list in it
  'fni_peak_meter',
  'pricing_comps',
  'history_log',
  'legacy_wall',
  'settings_snapshots',
  'no_saved_games',
  'dock_lot_empty',
  'day_recap_no_traffic',
  'day_recap_clean_funnel',
  'trade_review_empty',
  'discount_review_empty',
] as const;
export type EmptyStateId = (typeof EMPTY_STATE_IDS)[number];

const EmptyStateSchema = z
  .object({
    id: z.enum(EMPTY_STATE_IDS),
    /** The room the region lives in — orientation for the copy, not a key. */
    surface: z.string().min(1),
    text: z.string().min(1),
  })
  .strict();

// Top level is deliberately NOT `.strict()` — the `_doc` annotations are the
// file's record of why these are sentences rather than labels, and Zod strips
// them. The nested object IS strict.
export const EmptyStatesConfigSchema = z
  .object({
    schemaVersion: z.literal(1),
    states: z.array(EmptyStateSchema).nonempty(),
  })
  .refine((c) => new Set(c.states.map((s) => s.id)).size === c.states.length, {
    message: 'empty-state ids must be unique',
  })
  // Completeness, the `data/hints.json` idiom: a declared id with no copy is a
  // load-time failure, not a region that quietly renders blank.
  .refine((c) => EMPTY_STATE_IDS.every((id) => c.states.some((s) => s.id === id)), {
    message: 'every empty-state id must be declared',
  })
  // Every entry is a SENTENCE that names a next action. A bare label ("None",
  // "No data") tells a new player nothing they could not already see.
  .refine((c) => c.states.every((s) => /[.!?]$/.test(s.text.trim())), {
    message: 'every empty-state string must be a sentence',
  });

export type EmptyStatesConfig = z.infer<typeof EmptyStatesConfigSchema>;

export function loadEmptyStates(): EmptyStatesConfig {
  const raw: unknown = require('../../../data/empty-states.json');
  return parseData(raw, EmptyStatesConfigSchema, 'data/empty-states.json');
}

/**
 * The catalog is static copy — it depends on nothing about the player, the slot
 * or the world — so it is loaded once per process rather than injected. That is
 * the difference from `useHints`, whose answer is a read of the slot's teaching
 * cell and therefore has to be a hook.
 */
let cached: EmptyStatesConfig | null = null;

/**
 * The sentence for an empty region, with any `{slot}` filled.
 *
 * An unfilled slot is left literal — the industry-wire rule — so a missing fill
 * shows up as a visibly wrong sentence rather than a silently truncated one.
 */
export function emptyState(
  id: EmptyStateId,
  slots?: Readonly<Record<string, string>>,
): string {
  cached ??= loadEmptyStates();
  const entry = cached.states.find((s) => s.id === id);
  if (!entry) throw new Error(`EmptyState: unknown id "${id}"`);
  if (!slots) return entry.text;
  return Object.entries(slots).reduce(
    (text, [slot, value]) => text.replace(new RegExp(`\\{${slot}\\}`, 'g'), value),
    entry.text,
  );
}
