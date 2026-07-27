import type { StorageDriver } from '../SaveStore';
import type {
  PlaytestContext,
  PlaytestDealEntry,
  PlaytestEntry,
  PlaytestEntryCounts,
  PlaytestFlagEntry,
  PlaytestLog,
  PlaytestWalkEntry,
} from './types';

const SCHEMA_VERSION = 1;

/** Hard cap so a long career can't grow the blob without bound. Oldest entries
 *  drop first — a playtest round is days, and the recent end is the useful end. */
const MAX_ENTRIES = 2000;

interface PersistedBlob {
  v: number;
  seq: number;
  entries: PlaytestEntry[];
}

export interface PlaytestLogOptions {
  /** Injected so tests can freeze the wall clock. */
  now?: () => Date;
  maxEntries?: number;
}

/**
 * The #74 playtest recorder (#332).
 *
 * Owns its own `StorageDriver` cell — deliberately *outside* the world save
 * envelope. Three consequences that are the point rather than a side effect:
 * no save-version bump and no migration for a dev tool; the log survives the
 * admin console's `Reset Save`; and a note taken on day 1 is still there on
 * day 5 even across a fresh career.
 *
 * Writes are write-behind and serialized through one promise chain, so appends
 * stay synchronous for the caller (a flag must never make the UI wait) while
 * still landing in driver order. `flush()` is the test/export seam.
 */
export function createPlaytestLog(
  driver: StorageDriver,
  options: PlaytestLogOptions = {},
): PlaytestLog {
  const now = options.now ?? (() => new Date());
  const maxEntries = options.maxEntries ?? MAX_ENTRIES;

  let entries: PlaytestEntry[] = [];
  let seq = 0;
  let writeChain: Promise<void> = Promise.resolve();

  function persist(): void {
    const blob: PersistedBlob = { v: SCHEMA_VERSION, seq, entries };
    const payload = JSON.stringify(blob);
    // A failed write is swallowed, never retried and never allowed to reject
    // the chain: this is best-effort instrumentation, not a save file, and a
    // rejected chain would silently stop every *later* append from persisting.
    // Dropping one write is self-healing anyway — each append rewrites the
    // whole blob, so the next successful write carries the missed entry too.
    writeChain = writeChain.then(() => driver.write(payload)).catch(() => {});
  }

  function append<E extends PlaytestEntry>(entry: E): E {
    entries.push(entry);
    if (entries.length > maxEntries) {
      entries = entries.slice(entries.length - maxEntries);
    }
    persist();
    return entry;
  }

  function stamp(): { seq: number; at: string } {
    return { seq: seq++, at: now().toISOString() };
  }

  return {
    async hydrate() {
      let raw: string | null = null;
      try {
        raw = await driver.read();
      } catch {
        return;
      }
      if (raw === null) return;
      try {
        const blob = JSON.parse(raw) as PersistedBlob;
        if (!Array.isArray(blob?.entries)) return;
        entries = blob.entries;
        // Never trust a persisted seq below what the entries already use, or a
        // hand-edited blob would hand out duplicate sequence numbers.
        const highest = entries.reduce((max, e) => Math.max(max, e.seq), -1);
        seq = Math.max(blob.seq ?? 0, highest + 1);
      } catch {
        // Corrupt blob → empty log. Losing dev notes beats refusing to boot.
      }
    },

    flag(note: string, ctx: PlaytestContext): PlaytestFlagEntry {
      return append<PlaytestFlagEntry>({
        kind: 'flag',
        ...stamp(),
        ctx,
        note: note.trim(),
      });
    },

    recordDeal(deal) {
      append<PlaytestDealEntry>({ kind: 'deal', ...stamp(), ...deal });
    },

    recordWalk(walk) {
      append<PlaytestWalkEntry>({ kind: 'walk', ...stamp(), ...walk });
    },

    entries() {
      return entries;
    },

    count() {
      return entries.length;
    },

    counts(): PlaytestEntryCounts {
      const c: PlaytestEntryCounts = { flag: 0, deal: 0, walk: 0 };
      for (const e of entries) c[e.kind] += 1;
      return c;
    },

    flush() {
      return writeChain;
    },

    async clear() {
      entries = [];
      seq = 0;
      writeChain = writeChain.then(() => driver.clear()).catch(() => {});
      await writeChain;
    },
  };
}
