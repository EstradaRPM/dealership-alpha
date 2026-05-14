# CareerProgression

Player tier (1 → 3 in v1) + backstory-driven Day 1 modifiers + branding rebrand flow on tier-up.

## Public API (`index.ts`)
- `createTierManager()` → `TierManager`.
- `createBankruptcyMonitor`, `createIndictmentMonitor` — tier-aware failure monitors.
- `createCareerEndingsMonitor` → `CareerEndingsMonitor` (retire / sellout / family handoff — issue #35).
- `loadBackstories`, `getDay1Modifier`, `buildCharacterModifier` — character-creation hooks.
- `loadTierConfig`, `loadFailureTunables`, `loadIndictmentTunables`, `loadEndingsTunables` — data loaders.
- Types: `TierManager`, `TierManagerState`, `TierConfig`, `TierEntry`, `TierThreshold`, `AccentOption`, `FontOption`, `BackstoryId`, `Day1Modifier`, `BackstoryEntry`, `CharacterProfile`, `BankruptcyMonitor*`, `IndictmentMonitor*`, `CareerEndingsMonitor*`, `PESelloutOffer`, `EndingsTunables`.

## Events
- **Emits:** `career:tier_up`, `career:bankruptcy_*`, `career:debt_payment_made`, `career:indictment_*`, `career:retired`, `career:pe_offer_made`, `career:pe_sellout`, `career:family_handoff`.
- **Consumes:** `clock:overnight_payroll`, `customer:resolved`, `regulatory:lemon_law_incident`, `regulatory:audit_failure`, `deal:fraud_flag`; reads `Economy` / `Reputation` for threshold evaluation.

## Data
- `data/tier-progression.json` — thresholds + tier metadata.
- `data/backstories.json` — character backstories and Day 1 modifiers.
- `data/failure-tunables.json` — bankruptcy + indictment + regulatory tunables.
- `data/career-endings.json` — retire / sellout / family-handoff thresholds.

## v1 scope
Tiers 1–3 only (gravel yard → paved lot → small showroom). Anything beyond tier 3 is out of scope for v1 — see issue #1.
