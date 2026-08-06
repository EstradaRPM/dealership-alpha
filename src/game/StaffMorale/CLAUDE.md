# StaffMorale

Tracks morale for each active staff member. Drifts daily based on outcomes; triggers quits below threshold.

## Public API (`index.ts`)
- `createStaffMorale()` → `StaffMorale`.
- `loadStaffMoraleConfig` — reads morale tunables.
- Types: `StaffMorale`, `StaffMoraleDeps`, `StaffMoraleConfig`.

## Events
- **Emits:** `staff:quit` (when morale crosses the quit threshold).
- **Consumes:** `staff:auto_resolved` (success bump / failure ding), `staff:hired` (init morale), `staff:fired` (cleanup), `clock:day_ended` (daily drift), `clock:overnight_payroll` (pay vs market, #356), `staff:raise_answered` (#356).

## Pay vs market (#356)
- Every `clock:overnight_payroll`, each member's **paid** wage is compared against their
  **grade's asking** wage — both read off `StaffOrg.getPayBoard()`, never re-derived here.
  Below asking → `paidBelowMarketPenalty`; at or above → `paidAtMarketBonus`.
- This replaced `payVsMarketBonus`, which added a flat bonus to everyone **unconditionally**
  and so compared nothing (`staff-teeth-design.md` §3 call 7: "becomes real or dies"). It is
  the same comparison that fires StaffOrg's raise demand.
- The signs are **schema-enforced**: a positive `paidBelowMarketPenalty` would mean
  underpaying cheers people up, and would read as balance rather than a dropped minus sign.
- `staff:raise_answered` is the answer's morale consequence: `raiseAcceptedBonus` /
  `raiseRefusedPenalty`. A refusal has **no quit path of its own** — it lowers morale, and
  the standing overnight risk check takes it from there.

## Data
- `data/tunables.json` — morale section (initial value, drift, quit threshold, outcome impacts, the two pay-vs-market edges, the two raise-answer edges).

## Persistence (#190)
- `snapshot()/restore()` (barrel-exported `StaffMoraleSnapshot`) flatten the
  per-staff morale map to `[staffId, morale]` pairs for save/load. Wired into
  `snapshotWorld`/`restoreWorld` under the `staffMorale` key; restored after
  `StaffOrg`'s roster so morale lands on the same ids.

## Notes
- Morale is per-staff state; `StaffOrg` is the roster source of truth, this module owns the morale dimension.
