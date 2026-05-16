# FollowUpPool

Walked-customer heat tracker. Customers who didn't close sit in this pool with a decaying `heat` value; the hottest ones are surfaced as BDC callback tasks each morning.

## Public API (`index.ts`)
- `createFollowUpPool()` → `FollowUpPool`.
- Types: `FollowUpPool`, `FollowUpEntry`, `ArchivedEntry`, `CallbackOutcome`, `FollowUpTunables`.

## Events
- **Emits:** `followup:bdc_tasks_ready` (top-N hottest each morning), `followup:customer_archived` (heat decayed to zero), `bdc:callback_succeeded` (customer returns to Sales).
- **Consumes:** `customer:resolved` with `outcome=walk` (add to pool), `clock:overnight_followup_decay` (decay heat), `clock:day_started` (publish today's BDC tasks).

## Data
- `data/customer-tunables.json` — `followUp` section (`decayPerNight`). Initial heat is the computed `heat` scalar from the extended `customer:resolved` payload (#85/#93), not a flat base.

## Notes
- Archived entries (heat=0) stay readable for KPI/historical purposes but are no longer actionable.
