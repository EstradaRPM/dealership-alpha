# Shared department structure (Service / Body Shop)

**Status:** LOCKED 2026-06-23 (issue #311, parent PRD #297). HITL architectural
review. Gates all Body Shop slices (#312–#317) — build against this contract.

## The decision

Service and Body Shop run the **same operational assembly line** but feed it from
**different, self-contained recipe packages**. Build the line once; each
department supplies a complete package and plugs in at one narrow seam.

The PRD's one-liner — *"only the demand spine differs"* — is refined here by what
the Service code actually shows: the demand spine **drags three satellites with
it** (pricing model, marketing levers, feedback loop), and those genuinely differ
between the two businesses. We do **not** force those satellites into a shared
shape. They live inside each department's own package.

Rejected alternative: a "fat backbone" defining shared `PricingModel` /
`Marketing` / `Feedback` strategy slots both departments implement. Service's
retention/conquest mailer arms and Body Shop's insurance↔retail channel posture
are not the same machine; a common slot shape would be a leaky abstraction the
S14 calibration pass (#286) would fight. (See [[pricing-demand-spine]],
[[no-half-assed-solutions]].)

## What is genuinely shared (the assembly line)

Build once, department-agnostic. The backbone never knows which department it
serves.

1. **Tier-gated queue** — intake → tier gate → re-publish enriched intake.
   (Service = Tier 2; Body Shop = Tier 3.)
2. **Parts gate + `PartsInventory`** — `PartsInventory` already keys all 8
   categories; Body Shop only activates its 4 (windows/glass, doors/panels,
   interior trim, paint). No refactor of PartsInventory itself.
3. **Advisor auto-resolution** — the resolver: consume the matching part →
   revenue × pricing read → emit closed / miss / rush. Same for both.
4. **Capacity model** — `min(bays, advisors on duty)` concurrent slots, per-tick
   drain, live read-model (waiting / in-progress / avg-wait / utilization).
5. **Page + floor-card shell** — same layout shell; the demand readout content
   differs per department.
6. **Manager-automation *pattern*** — the skill-threshold ladder that hands a
   function over to a later-tier manager, wired at the **composition boundary**
   (keeps modules decoupled from StaffOrg, exactly as #310 does). The *pattern*
   is shared; the *specific functions* automated belong to the department.

## What each department owns (the recipe package)

A self-contained bundle. The backbone only ever asks it two things:
**"what jobs today?"** and **"what's the price for this job?"**

| Satellite | Service | Body Shop |
|---|---|---|
| Demand spine | `ServiceDemand` — installed-base annuity + reputation×marketing conquest floor | `CollisionStream` (#313) — weather-spiked stochastic, conquest-dominant |
| Pricing | competitive↔premium dial → return-roll price sensitivity | insurance-DRP ↔ retail channel posture |
| Marketing | `ServiceMarketing` retention + conquest arms | channel choice (no separate mailer arms) |
| Feedback | `InstalledBase` loyalty / CSI / defection | weak/no base tie (conquest-dominant) |

## The narrow seam

The backbone's entire inbound interface from a department:

- **`enrichedIntake`** — the day's jobs, each carrying customer + vehicle identity,
  parts/job category, and base revenue (the shape `serviceDemand:intake_ready`
  already uses, `events.ts`).
- **`pricingRead(ticket) → multiplier`** — read per-resolve so a live dial change
  applies to the next ticket (the `getPricingPosture` idiom ServiceDispatch
  already uses).

Everything else (where demand comes from, how marketing drums it up, what good/bad
service does to the future) stays inside the department package and never crosses
the seam.

### Event-name generalization (implementation note for #312–#314)

Today the intake/resolution events are `service:*` and `jobCategory` is a closed
union of the 4 Service categories. To share the resolver, either (a) generalize to
a department-tagged `dept:*` family with a wider category union, or (b) mirror the
`service:*` set with a parallel `bodyshop:*` set bound to the same resolver. Pick
during #312/#314; whichever is chosen, the **resolver code is the same** and the
category union widens. Keep `service:*` payloads byte-stable so Service tests and
persistence envelopes don't churn.

## Refactor strategy (behavior-neutral, mandated by acceptance)

Conservative extraction — **not** a `Service*`→`Dept*` rename in place.

- Every Service module keeps its public surface and tests intact; the shared
  backbone is re-expressed *underneath* them. The five `Service*` modules
  (Demand / Queue / Dispatch / Insights / Marketing) + `InstalledBase` get
  bundled into one labeled "Service package" that plugs into the shared line.
- Acceptance: all existing Service tests stay green; a fixed seed replays
  byte-identically (#122). The refactor is invisible to the player.
- Manager automation stays at the composition root, parameterized per department.

## Sign-off

HITL-approved 2026-06-23. Body Shop slices (#312–#317) build against this
contract. Update the affected per-module `CLAUDE.md`s as the backbone is
extracted.
