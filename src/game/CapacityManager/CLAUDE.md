# CapacityManager

Daily admittance gate. Computes how many customers the dealership can handle today (driven by tier + staff contribution) and admits/turns-away arrivals accordingly.

## Public API (`index.ts`)
- `createCapacityManager()` → `CapacityManager`.
- `loadCapacityConfig` — reads capacity tunables.
- `getStaffContribution(staff)` — pure helper computing capacity boost from a staff member.
- Types: `CapacityManager`, `CapacityManagerDeps`, `CapacityConfig`.

## Events
- **Emits:** `capacity:customer_admitted`, `capacity:missed_opportunity` (turn-away).
- **Consumes:** customer-arrival flow (called by `CustomerPool` before admit).

## Data
- `data/tunables.json` — capacity section (tier base + per-role contribution).

## Notes
- Missed opportunities are surfaced in the KPI dashboard — they are a signal the player should hire more staff or upgrade tier.
