// ── PlaytestLog types (#332) ─────────────────────────────────────────────────
// Dev instrumentation for the #74 playtest gate. Nothing in the sim reads or
// branches on any of this — it is a recorder, in the Telemetry mold.

/**
 * World context stamped onto a manual flag. Captured at the *instant the FAB is
 * tapped*, not when the note is saved, so the stamp is the moment the player
 * reacted rather than the moment they finished typing.
 */
export interface PlaytestContext {
  day: number;
  /** `'MANAGERIAL' | 'FLOOR_OPEN'` in practice; kept open so a new lifecycle
   *  phase never needs a type change in a dev recorder. */
  phase: string;
  cash: number;
  tier: number;
}

interface EntryBase {
  /** Monotonic within a log; the export orders by it. */
  seq: number;
  /** Wall-clock ISO stamp — the axis "how long did a day *feel*" is measured on. */
  at: string;
}

export interface PlaytestFlagEntry extends EntryBase {
  kind: 'flag';
  ctx: PlaytestContext;
  /** May be empty — a bare flag is a valid "something happened here". */
  note: string;
}

/** Auto-captured off `deal:closed`, which carries the whole finance structure
 *  the playtest script's §5 currently asks the player to transcribe by hand. */
export interface PlaytestDealEntry extends EntryBase {
  kind: 'deal';
  day: number;
  customerId: string;
  vehicleId: string;
  agreedPrice: number;
  frontGross: number;
  backGross: number;
  daysInInventory: number;
  paymentMethod: 'cash' | 'finance';
  downPayment: number;
  loanAmount: number;
  /** Months; 0 for cash. */
  term: number;
  /** Annualized decimal rate; 0 for cash. */
  apr: number;
}

/** Auto-captured off `staff:auto_resolved` with `outcome: 'no_sale'` — the
 *  named walk reason the on-screen line generalizes away. */
export interface PlaytestWalkEntry extends EntryBase {
  kind: 'walk';
  day: number;
  customerId: string;
  reason: string;
  archetypeLabel?: string;
  wantedCategory?: string;
}

export type PlaytestEntry =
  | PlaytestFlagEntry
  | PlaytestDealEntry
  | PlaytestWalkEntry;

export interface PlaytestEntryCounts {
  flag: number;
  deal: number;
  walk: number;
}

export interface PlaytestLog {
  /** Load persisted entries from the driver. Safe to call more than once;
   *  a corrupt or absent blob restores as an empty log rather than throwing. */
  hydrate(): Promise<void>;
  /** Append a manual flag. Returns the stored entry (the UI echoes it back). */
  flag(note: string, ctx: PlaytestContext): PlaytestFlagEntry;
  recordDeal(deal: Omit<PlaytestDealEntry, 'kind' | 'seq' | 'at'>): void;
  recordWalk(walk: Omit<PlaytestWalkEntry, 'kind' | 'seq' | 'at'>): void;
  entries(): readonly PlaytestEntry[];
  count(): number;
  counts(): PlaytestEntryCounts;
  /** Resolves once every append issued so far has reached the driver. */
  flush(): Promise<void>;
  clear(): Promise<void>;
}
