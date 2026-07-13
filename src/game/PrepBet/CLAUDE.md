# PrepBet

The captured **morning wager** (engagement spine tracer S4, #322; design record
`docs/planning/engagement-spine.md` §5). For the day-close Reveal to score "your
bet," the bet has to be captured. At T1 the bet is the morning prep posture:
**the category the lot leans heaviest into (your stocking bet), read against the
demand-heat read** the player saw at prep. Pure capture only — the verdict copy
lives with the Reveal renderer (`src/ui/Reveal/buildReveal.ts`).

## Public API (`index.ts`)
- `computePrepBet({ day, lot, demandMix, weatherAttrLean, config }) → PrepBet` —
  pure + deterministic. The lot mix decides the stocking bet (heaviest category,
  stable-order strict argmax; empty lot or a tie ⇒ `null`). The demand read is
  `DemandShaper.getMix()` heat **plus** the Weather attribute lean folded to
  categories via `config` — `readWeight = mix[c] + weatherWeight · Σ lean·(profile[c][axis] − 0.5)`,
  mirroring the matcher's own per-unit weather score so the read agrees with how
  weather actually biases the floor.
- `createPrepBetHolder(initial?) → PrepBetHolder` — a tiny mutable `get/set`
  slot, the World-level home for the current day's bet (mirrors the
  service-pricing / body-shop-channel posture holders).
- Types: `PrepBet`, `PrepCategory` (`'sedan' | 'truck' | 'suv'`),
  `PrepBetConfig`, `PrepBetHolder`.

## Capture point (composition root)
`createWorld` owns the holder and exposes `getPrepBet()` / `setPrepBet()` +
`captureDayStartPrepBet()`. The composition root calls
`captureDayStartPrepBet()` at the day-open verb (right after
`dayLoop.nextDay()`, in `useDayLoop.handleNextDay`) so the bet is the **committed
post-prep posture** for the day now opening — captured once, for every day
including cold-start Day 1, with no dependence on `clock:day_started` (skipped on
Day 1) and no clobber race with the next day's `clock:managerial_prep` (which
fires at the prior day's close). On a mid-day reload the capture does **not**
re-run; the frozen morning bet is restored from the snapshot instead.

## Persistence (#122-safe)
`PrepBet | null` rides `worldSnapshot` as the World-level `prepBet` key
(`WORLD_SNAPSHOT_VERSION` bump + a migration materializing `null` ⇒ old saves
fall back to the pre-S4 scoreline). Persisted so a mid-day checkpoint/resume
scores the day-close Reveal against the same morning bet byte-for-byte.

## Events
None — a pure library/factory module (mirrors DemandShaper / Weather). The
composition root drives capture and reads `getPrepBet()` at day close to feed
`buildReveal`.

## Data
`data/tunables.json` → `reveal.prepBet`: `{ weatherWeight,
categoryAttributeProfiles }`. `categoryAttributeProfiles` is the per-category
representative attribute vector over the Weather axes (`winterCapability` /
`openAir` / `fuelEfficiency`). First-pass calibration magnitudes — tuned last
(#286).

## Scope notes
- Category-level only. Price posture is **not** part of the T1 bet (the design
  record's price flavor is surfaced by the walk-off reasons, not modeled here).
- `readCategory` is the demand-read favorite; at day close it stands in for "the
  crowd" only when the day produced no expressed want (a dead day). A day that
  spoke (any close or wanted-category walk-off) is scored against reality.
