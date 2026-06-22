# ServiceMarketing

The two **service-marketing arms** (#307, parent PRD #297), distinct from sales
advertising (which lives in DemandShaper). Holds the player's lever selections
and turns them into the influence reads the composition root wires into the
Service demand/return math, while debiting each active arm's daily cost from
Economy.

- **Retention arm** — a chosen campaign (or none). Its `returnLift` is added to
  InstalledBase's return-roll `convenience` term, so it raises the base's return
  rate and slows the sustained-non-return defection path.
- **Conquest arm** — a single **category-targeted** special the player aims at a
  job category (e.g. `tires_brakes` = a "brake special"). It raises conquest
  volume (scales ServiceDemand's `serviceMarketing` input by `volumeBoost`) and
  skews the incoming mix toward the promoted category (multiplies its weight by
  `1 + categoryBias`) — usable to manufacture demand to clear over-stocked parts.

A library/factory module — **no EventBus participation**. The composition root
constructs it (`createServiceMarketing({ economy })`), drives `advanceDay` on
`clock:day_started`, and binds the influence reads into InstalledBase
(`getRetentionLift`) and ServiceDemand (`serviceMarketing` + `conquestBias`).
Player-facing controls land on the Service page in a later slice.

## Public API (`index.ts`)
- `createServiceMarketing({ economy, config? })` → `ServiceMarketing`. `economy`
  needs only `forceDebit` — a recurring marketing spend posts even on a low
  balance (mirrors rent/payroll) rather than throwing mid-day. `config` defaults
  to `loadServiceMarketingConfig()`.
- Retention arm: `retentionCampaigns` (data-driven `{id,label,blurb}[]`),
  `getRetentionCampaign()` / `setRetentionCampaign(id)` (`'none'` clears; throws
  on an unknown id), `retentionLift()` → the active campaign's `returnLift` in
  [0,1] or 0.
- Conquest arm: `getConquestSpecial()` / `setConquestSpecial(category)`
  (a `JobCategory` or `'none'`; throws on an unknown category),
  `conquestVolumeInfluence()` → `volumeBoost` in [0,1] or 0,
  `conquestBias()` → `{ category, strength }` or null.
- `advanceDay(day)` — debit each active arm's `dailyCost` from Economy.
- `snapshot()` / `restore()` — barrel-exported `ServiceMarketingSnapshot`
  (the two selections). `restore` falls back to `'none'` for a campaign/category
  that no longer exists in data.
- `loadServiceMarketingConfig()`, `JOB_CATEGORIES`.
- Types: `ServiceMarketing`, `ServiceMarketingDeps`, `ServiceMarketingConfig`,
  `RetentionCampaign`, `RetentionCampaignOption`, `ServiceMarketingSnapshot`,
  `ConquestBias`, `ConquestSelection`, `JobCategory`.

## Events
None — driven entirely by the composition root.

## Data
- `data/service-marketing.json` (`schemaVersion: 1`) — `retentionCampaigns`
  (each `{id,label,blurb,dailyCost,returnLift}`) + a single `conquestSpecial`
  (`{dailyCost, volumeBoost, categoryBias}`). All magnitudes are placeholders
  tuned in the S14 balance pass (#286).

## Determinism & persistence
Adds **no randomness** of its own. The demand/return effects flow through
already-seeded math (InstalledBase's return roll, ServiceDemand's conquest
draws), so a fixed seed replays byte-identically (#122). Daily spend is a fixed
cost, not a draw. Only the two lever selections persist, via the world snapshot
(`serviceMarketing` key, envelope v10→v11 materializes no active arm for pre-#307
saves).

## Decoupling
Shares InstalledBase's `JobCategory` contract (the conquest arm targets a job
category) rather than declaring a parallel union. It never imports ServiceDemand
or InstalledBase internals — the composition root injects its reads as functions,
and `ConquestBias` is declared structurally on both sides.
