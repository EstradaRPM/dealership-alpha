# InstalledBase

The living per-owner registry — the foundation of the Service annuity (#298,
parent PRD #297). Every car the player sells enters here as one owner record.
**This slice is the registry + persistence only — no return cadence, no service
demand, no defection yet.**

## Public API (`index.ts`)
- `createInstalledBase({ bus, config })` → `InstalledBase`.
- `getOwners()` / `getOwner(ownerId)` / `size` — read the registry.
- `snapshot()` / `restore()` — barrel-exported `InstalledBaseSnapshot`.
- `loadInstalledBaseConfig()` — reads `data/tunables.json#installedBase`.
- Types: `InstalledBase`, `InstalledBaseSnapshot`, `OwnerRecord`,
  `OwnerPowertrain`, `InstalledBaseConfig`.

## Accrual — the three-signal join
One sale fans out three signals, all synchronous within one
`DealEngine.closeDeal`:
1. `inventory:vehicle_sold` — the sold-vehicle snapshot (category, **powertrain**
   (#298 added the field), sale `day` → age), keyed by `vehicleId`.
2. `deal:closed` — `customerId` ↔ `vehicleId` (the join key).
3. `customer:resolved` (`outcome:'closed'`) — `retentionSeed`, the
   satisfaction-at-sale loyalty seed, keyed by `customerId`.

Vehicle attributes are taken **straight from the sold-vehicle snapshot, never
re-derived**. `loyalty = clamp01(retentionSeed × loyaltySeedScale)`.

### Order-independence
`customer:resolved` is published from *inside* CustomerPool's `deal:closed`
handler, so the relative firing order of this module's own handlers vs.
CustomerPool's is not guaranteed. We stash each signal in a transient pending
buffer and attempt to finalize from **both** the `deal:closed` and
`customer:resolved` handlers — whichever completes the trio last creates the
record. A walk (`outcome !== 'closed'`) never enters the base. `ownerId` is
`${customerId}::${vehicleId}`, so a repeat buyer gets one record per vehicle.

## Events
- **Consumes:** `inventory:vehicle_sold`, `deal:closed`, `customer:resolved`.
- **Emits:** none this slice.

## Data
- `data/tunables.json#installedBase` — `loyaltySeedScale` (1.0 = identity;
  tuned in the S14 balance pass #286).

## Persistence (#298)
- `snapshot()/restore()` round-trips owner records + loyalty under the
  `installedBase` world-snapshot key (envelope v9; the v8→v9 migration
  materializes an empty base for pre-existing saves). The pending join buffers
  are transient (always empty at rest between closes) and are **not** persisted —
  a restore starts them empty.

## Determinism
Loyalty is a pure function of the upstream `retentionSeed` (itself deterministic
from `masterSeed`); no new RNG is drawn here, so accrual replays identically
(#122).
