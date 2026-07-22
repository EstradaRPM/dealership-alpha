import {
  loadNewsGatingConfig,
  type NewsGatingConfig,
  type NewsLane,
  type NewsUnlock,
} from './marketIntelConfig';
import type {
  GateableHeadline,
  GatedHeadline,
  NewsAccess,
  NewsAccessRead,
  NewsLock,
} from './types';

const WILDCARD = '*';

/**
 * How specifically a lane names a (source, reliability) pair. An exact source
 * outranks an exact reliability, so `auction_report`/`*` beats `*`/`direct` and
 * the paid block report stays paid even though some other rule speaks for its
 * whole trust tier. `-1` = no match.
 */
function specificity(lane: NewsLane, source: string, reliability: string): number {
  const sourceMatch = lane.source === source ? 2 : lane.source === WILDCARD ? 0 : -1;
  const reliabilityMatch =
    lane.reliability === reliability ? 1 : lane.reliability === WILDCARD ? 0 : -1;
  if (sourceMatch < 0 || reliabilityMatch < 0) return -1;
  return sourceMatch + reliabilityMatch;
}

/** The winning lane for a pair: most specific, ties broken by declaration order. */
function resolveLane(
  config: NewsGatingConfig,
  source: string,
  reliability: string,
): NewsLane | null {
  let best: { lane: NewsLane; score: number } | null = null;
  for (const lane of config.lanes) {
    const score = specificity(lane, source, reliability);
    if (score < 0) continue;
    if (!best || score > best.score) best = { lane, score };
  }
  return best?.lane ?? null;
}

/** `${cost}`-style slot fill, shared by the hint and the standing-cost note. */
export function fillHint(
  text: string,
  slots: Readonly<Record<string, string | number>>,
): string {
  return text.replace(/\{(\w+)\}/g, (whole, key: string) =>
    Object.prototype.hasOwnProperty.call(slots, key) ? String(slots[key]) : whole,
  );
}

function isSatisfied(unlock: NewsUnlock, read: NewsAccessRead): boolean {
  if (read.tier < unlock.minTier) return false;
  return unlock.kind === 'subscription'
    ? read.activeSubscriptions.includes(unlock.id)
    : read.hasDeskManager;
}

function toLock(unlock: NewsUnlock, read: NewsAccessRead): NewsLock {
  const available = read.tier >= unlock.minTier;
  return {
    id: unlock.id,
    kind: unlock.kind,
    label: unlock.label,
    blurb: unlock.blurb,
    hint: fillHint(available ? unlock.lockedHint : unlock.tierLockedHint, {
      cost: unlock.dailyCost ?? 0,
      tier: unlock.minTier,
    }),
    dailyCost: unlock.dailyCost ?? null,
    available,
    satisfied: isSatisfied(unlock, read),
  };
}

/**
 * Resolve what the player is allowed to read (#178).
 *
 * Pure — no state, no randomness, no engine reach. Access is a READ-SIDE lens:
 * the market engine publishes every headline regardless, so the seed stream and
 * therefore replay (#122) are identical whether or not anything is unlocked.
 * Gating decides only whose eyes it reaches.
 */
export function resolveNewsAccess(
  read: NewsAccessRead,
  config: NewsGatingConfig = loadNewsGatingConfig(),
): NewsAccess {
  const unlockById = new Map(config.unlocks.map((u) => [u.id, u]));
  const satisfied = new Map<string, boolean>(
    config.unlocks.map((u) => [u.id, isSatisfied(u, read)]),
  );
  // Locks are built once per resolution: the same door referenced by two lanes
  // is the same object, so grouping locked rows by `lock.id` downstream is
  // grouping by identity rather than by a re-derived label.
  const lockById = new Map<string, NewsLock>(
    config.unlocks.map((u) => [u.id, toLock(u, read)]),
  );

  function requirementFor(source: string, reliability: string): string | null {
    return resolveLane(config, source, reliability)?.requires ?? null;
  }

  return {
    canRead(source, reliability) {
      const required = requirementFor(source, reliability);
      if (required == null) return true;
      // A lane naming an unlock that no longer exists in data fails OPEN: a
      // config gap must never hide news about something that really happened.
      if (!unlockById.has(required)) return true;
      return satisfied.get(required) === true;
    },
    lockFor(source, reliability) {
      const required = requirementFor(source, reliability);
      if (required == null) return null;
      const lock = lockById.get(required);
      if (!lock || satisfied.get(required) === true) return null;
      return lock;
    },
    locks: config.unlocks.map((u) => lockById.get(u.id) as NewsLock),
  };
}

/**
 * Split a published run of headlines into what the player can read and what
 * they can only see the shape of. Order is preserved — a locked row keeps its
 * place in the chronology, because *when* something you can't read was filed is
 * itself information (and the tease is the point).
 */
export function gateHeadlines<H extends GateableHeadline>(
  headlines: readonly H[],
  access: NewsAccess,
): readonly GatedHeadline<H>[] {
  return headlines.map((headline) => {
    const lock = access.lockFor(headline.source, headline.reliability);
    return lock
      ? ({ readable: false, headline, lock } as const)
      : ({ readable: true, headline } as const);
  });
}
