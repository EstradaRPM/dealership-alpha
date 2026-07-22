# MarketIntel

What the player is allowed to **know**, and what that access costs (#178, parent
#150). MarketEconomy's `news` sub-system publishes everything the market engine
does; MarketIntel owns the other half of that loop — which lanes of the wire
reach the player's eyes, and the two currencies that open them.

- **Money** — a standing data subscription (`data/news-progression-gating.json`),
  its `dailyCost` debited from Economy every day it stays on.
- **People** — a used car manager on the desk. Forward calls are the
  channel-desk **advise** surface, and advise is *free on hire*
  (`docs/planning/manager-roles-channel-desk.md` §3) — never behind a skill
  threshold. #178's original "Market Analyst" hire was adjudicated onto the UCM:
  the locked roster is UCM/NCM/GM, and `pricing` already owns intel (#284).
- **Career tier** decides which doors are on the market at all (`minTier`), so a
  Tier-1 lot reads the public voices and sees the rest as locked rows.

A library/factory module in the ServiceMarketing mold — **no EventBus
participation**. The composition root constructs it, drives `advanceDay` on
`clock:day_started`, and resolves access against the live tier + roster.

## Public API (`index.ts`)

- `createMarketIntel({ economy, config? })` → `MarketIntel`. `economy` needs only
  `forceDebit` — a standing subscription posts even on a low balance (mirrors
  rent/payroll) rather than throwing mid-day.
- `subscriptions` (the subscription-kind unlocks as `{id,label,blurb,dailyCost,
  minTier}`), `isSubscribed(id)`, `activeSubscriptions()` (catalog order),
  `setSubscribed(id, on)` (**throws** on an id it doesn't sell — including a
  staff unlock, whose price is a hire), `dailySpend()`.
- `accessFor({ tier, hasDeskManager })` → `NewsAccess` resolved against the live
  subscriptions.
- `advanceDay(day)` — debit each active subscription.
- `snapshot()` / `restore()` → `MarketIntelSnapshot` (the active ids). `restore`
  drops a product the catalog no longer sells rather than billing for it.
- `resolveNewsAccess(read, config?)` → `NewsAccess` — the pure resolution.
  `canRead(source, reliability)` / `lockFor(...)` / `locks` (every declared door
  with live `available` + `satisfied` state, for the wire's footer).
- `gateHeadlines(headlines, access)` → `GatedHeadline[]`, order preserved. A
  locked row keeps its place in the chronology: *when* something you can't read
  was filed is itself information, and the tease is the mechanic.
- `fillHint(text, slots)` — the `{cost}`/`{tier}` slot fill.
- `loadNewsGatingConfig()`.

## Lane matching

A lane is `{ source, reliability, requires }` with `'*'` wildcards on either
axis. Matching is by **specificity** — an exact source (2) outranks an exact
reliability (1), ties fall back to declaration order — never by array order, so
a voice can be slotted in anywhere. The first lane in data is a free catch-all,
so a voice added to the news catalog without a lane of its own **fails OPEN**
(readable), the same philosophy as #177's source fallback: a config gap must
never swallow news about something that really happened. `tests/MarketIntel.test.ts`
cross-checks every `(source, reliability)` pair the catalog can publish against
its intended lane, so an unintended free lane is caught at review.

## Events

None — driven entirely by the composition root.

## Data

- `data/news-progression-gating.json` (`schemaVersion: 1`) — `unlocks` (each
  `{id,kind,label,blurb,dailyCost?,minTier,lockedHint,tierLockedHint}`), `lanes`,
  and the wire's gating `copy`. Costs are first-pass placeholders tuned in the
  S14 balance pass (#286).

## Determinism & persistence

Adds **no randomness**, and gating is **read-side only**: the engine publishes
the same headline stream whether or not anything is unlocked, so a fixed seed
replays byte-identically (#122) regardless of what the player bought — asserted
in `tests/NewsGating.reachability.test.tsx`. Only the active subscription ids
persist, via the world snapshot (`marketIntel` key, envelope v19→v20
materializes an unsubscribed default for older saves).

## Decoupling

Never imports MarketEconomy, StaffOrg or CareerProgression. It sees only a
`(source, reliability)` pair and a narrow `{ tier, hasDeskManager }` read the
composition root distills — `resolveWireAccess(world)` in `src/app/config.ts`.
