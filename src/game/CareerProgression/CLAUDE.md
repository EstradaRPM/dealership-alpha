# CareerProgression

Player tier (1 → 3 in v1) + backstory-driven Day 1 modifiers + branding rebrand flow on tier-up.

## Public API (`index.ts`)
- `createTierManager()` → `TierManager`.
- `loadBackstories`, `getDay1Modifier`, `buildCharacterModifier` — character-creation hooks.
- `loadTierConfig` — reads `data/tier-progression.json`.
- Types: `TierManager`, `TierManagerState`, `TierConfig`, `TierEntry`, `TierThreshold`, `AccentOption`, `FontOption`, `BackstoryId`, `Day1Modifier`, `BackstoryEntry`, `CharacterProfile`.

## Events
- **Emits:** `career:tier_up` when thresholds cross.
- **Consumes:** state reads from `Economy` / `Reputation` to evaluate thresholds (called on `clock:day_ended`).

## Data
- `data/tier-progression.json` — thresholds + tier metadata.
- `data/backstories.json` — character backstories and Day 1 modifiers.

## v1 scope
Tiers 1–3 only (gravel yard → paved lot → small showroom). Anything beyond tier 3 is out of scope for v1 — see issue #1.
