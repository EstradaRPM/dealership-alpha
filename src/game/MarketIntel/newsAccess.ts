import {
  laneRequirements,
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

// Both currencies read the same way — is this door's key in the player's hand?
// The subscription's key is its own id; a staff door's key is the role that
// opens it, so a second desk can never inherit the first desk's read (#371).
function isSatisfied(unlock: NewsUnlock, read: NewsAccessRead): boolean {
  if (read.tier < unlock.minTier) return false;
  return unlock.kind === 'subscription'
    ? read.activeSubscriptions.includes(unlock.id)
    : unlock.role != null && read.staffedDesks.includes(unlock.role);
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

  function requirementsFor(source: string, reliability: string): readonly string[] {
    const lane = resolveLane(config, source, reliability);
    return lane ? laneRequirements(lane) : [];
  }

  /** The doors on this lane that are still shut, in declaration order. */
  function closedDoors(source: string, reliability: string): readonly NewsLock[] {
    return requirementsFor(source, reliability)
      .filter((id) => unlockById.has(id) && satisfied.get(id) !== true)
      .map((id) => lockById.get(id) as NewsLock);
  }

  return {
    canRead(source, reliability) {
      const required = requirementsFor(source, reliability);
      if (required.length === 0) return true;
      // A lane naming only unlocks that no longer exist in data fails OPEN: a
      // config gap must never hide news about something that really happened.
      const known = required.filter((id) => unlockById.has(id));
      if (known.length === 0) return true;
      // ANY door opens the lane — the paid feed and the hire are alternatives,
      // not a checklist.
      return known.some((id) => satisfied.get(id) === true);
    },
    lockFor(source, reliability) {
      if (this.canRead(source, reliability)) return null;
      return closedDoors(source, reliability)[0] ?? null;
    },
    locksFor(source, reliability) {
      if (this.canRead(source, reliability)) return [];
      return closedDoors(source, reliability);
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
