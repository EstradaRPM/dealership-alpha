# CareerProgression

Player tier (currently 1 → 3) + backstory-driven Day 1 modifiers + branding rebrand flow on tier-up.

## Public API (`index.ts`)
- `createTierManager()` → `TierManager`.
- `createBankruptcyMonitor`, `createIndictmentMonitor` — tier-aware failure monitors.
- `createCareerEndingsMonitor` → `CareerEndingsMonitor` (retire / sellout / family handoff — issue #35).
- `loadBackstories`, `getDay1Modifier`, `buildCharacterModifier` — character-creation hooks.
- `loadTierConfig`, `loadFailureTunables`, `loadIndictmentTunables`, `loadEndingsTunables` — data loaders.
- Types: `TierManager`, `TierManagerState`, `TierManagerSnapshot`, `TierConfig`, `TierEntry`, `TierThreshold`, `AccentOption`, `FontOption`, `BackstoryId`, `Day1Modifier`, `BackstoryEntry`, `CharacterProfile`, `BankruptcyMonitor*`, `IndictmentMonitor*`, `CareerEndingsMonitor*`, `PESelloutOffer`, `EndingsTunables`.

## Tier advancement (#250 — streak-based, locked macro-loop-spine §12)
- Advancement is driven by the monthly tier-gate verdict streak, NOT an
  instantaneous threshold. `TierManager` consumes `tierGate:month_verdict`
  (fired on `clock:month_ended`) and counts consecutive **meet-or-better**
  months at the current tier. To leave tier N, post N consecutive qualifying
  months (T1→T2: 1, T2→T3: 2, T3→T4: 3 — `data/tier-gate.json` `streak`,
  injected by the composition root as `streaksByTier`; identity fallback when
  omitted). Any below-meet month resets the streak strictly to 0.
- Reaching the **T3** streak does NOT auto-advance (T4 not built yet): it sets the
  persisted `dossierReady` flag and surfaces it on the Home gate strip. Act 2
  entry is player-initiated franchise courtship (parked #223).
- Exposes `monthStreak`, `requiredStreak`, `dossierReady` getters for the gate
  strip's track-record line. The old `triggerThreshold` (cash/customers/CSI
  snapshot, read on `clock:overnight_payroll`) is retired; `tier-progression.json`
  keeps only cosmetic label/illustration/caption data.

## Persistence (#192, parent #186)
- `TierManager.snapshot()/restore()` — module-owned `schemaVersion` (v2 since
  #250) wrapping the full tier state: tier + business identity
  (`currentTier`/`businessName`/branding), career progress (`customersServed`),
  AND the #250 advancement `monthStreak` + `dossierReady`. This single blob is
  the world seam's `tierManager` key. The streak/dossier fields were added
  *inside* the blob (schemaVersion 1→2, defaulted in `restore`), so no envelope
  migration was needed (see docs/save-migration-recipe.md).
  (`getSerializableState()/restoreState()` remain the module-internal raw form.)
- `BankruptcyMonitor.getSerializableState()/restoreState()` — the debt-overhang
  state (insolvency streak, outstanding T2 contraction debt, terminal flag) is
  the world seam's `bankruptcyMonitor` key (#270, envelope v6). It is wired into
  `createWorld` alongside `TierManager`/`RegulatoryMeter`.
- `IndictmentMonitor.getSerializableState()/restoreState()` — the severe-event
  pressure + terminal flag is the world seam's `indictmentMonitor` key (#271,
  envelope v7). Wired into `createWorld` alongside the other failure monitors.
  Of its three pressure inputs only `regulatory:lemon_law_incident` has a live
  producer (DealEngine emits it when an un-reconditioned hidden lemon —
  `reconStatus !== 'complete'` with a `major`/`catastrophic` recon bucket — is
  retailed); `regulatory:audit_failure` and `deal:fraud_flag` remain unwired
  follow-ons (#271).
- `CareerEndingsMonitor.getSerializableState()/restoreState()` — the pending PE
  offer + last-offer day + ended flag is the world seam's `careerEndingsMonitor`
  key (#272, envelope v8). Wired into `createWorld` alongside the failure
  monitors; it is the sole publisher of every SUCCESS ending EndCardManager
  consumes (`career:retired`, `career:pe_sellout`, `career:family_handoff`) plus
  the periodic `career:pe_offer_made`. Until #272 it was a composition orphan, so
  no win condition could fire — a run could only end via a terminal failure.

## Events
- **Emits:** `career:tier_up`, `career:bankruptcy_*`, `career:debt_payment_made`, `career:indictment_*`, `career:retired`, `career:pe_offer_made`, `career:pe_sellout`, `career:family_handoff`.
- **Consumes:** `tierGate:month_verdict` (TierManager advancement streak, #250), `clock:overnight_payroll` (failure monitors), `customer:resolved`, `regulatory:lemon_law_incident`, `regulatory:audit_failure`, `deal:fraud_flag`. The failure monitors read `Economy` for their thresholds; TierManager no longer reads `Economy`/`Reputation`.

## Data
- `data/tier-progression.json` — tier metadata (label/illustration/caption) +
  accent/font options. Advancement streak lengths live in `data/tier-gate.json`
  (`streak` per tier), not here (#250).
- `data/backstories.json` — character backstories and Day 1 modifiers.
- `data/failure-tunables.json` — bankruptcy + indictment + regulatory tunables.
- `data/career-endings.json` — retire / sellout / family-handoff thresholds.

## Current tier frontier
Tiers 1–3 are built (gravel yard → paved lot → small showroom). Higher tiers are not-yet-built — see issue #1.
