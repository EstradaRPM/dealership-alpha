# Staff performance ladder — real-industry calibration anchor

> **Status: design input, capture-not-build.** Source = issue #249 (user-supplied 2026-06-11, domain expert).
> This is the calibration anchor for the macro-loop spine [§5 staff risk/reward pass](./macro-loop-spine.md#5-staff--operators--the-engine-of-the-whole-arc)
> (talent ceilings, hire-cost curves, salary drain). The staff-teeth pass has its own design session;
> this doc only stores the data + integration notes. Data-file authoring happens during that build.

## The ladder (verbatim)

Real-industry per-salesperson performance bands for individual salespeople.

| Grade | Profile | Units/mo | Qualified close | Raw internet close | Front PVR | Back PVR | Total PVR |
|---|---|---|---|---|---|---|---|
| 1 | Raw greenpea — nervous, weak product/process, needs manager saves; wastes leads, high drop-off | 2–6 | 8–15% | 3–7% | $300–900 | $800–1,400 | $1,100–2,300 |
| 2 | Trained rookie — follows process/CRM, demos properly, weak at objections | 7–10 | 15–22% | 6–10% | $800–1,400 | $1,200–1,800 | $2,000–3,200 |
| 3 | Average — productive floor salesperson, not a dominant closer (the baseline) | 10–15 | 22–30% | 8–12% | $1,300–2,100 | $1,700–2,400 | $3,000–4,500 |
| 4 | Above-average — strong follow-up, holds gross, lifts CSI/show rate | 15–20 | 30–38% | 11–16% | $1,800–2,800 | $2,100–2,700 | $3,900–5,500 |
| 5 | Elite veteran closer — repeat/referral book, payment control; expensive but powerful | 20–30+ | 38–50% | 15–22%+ | $2,500–4,000 | $2,300–3,200 | $4,800–7,200 |

*PVR = per-vehicle retail (gross). Front = vehicle gross; Back = F&I gross.*

## Integration notes (from the 2026-06-11 tier-gate grill)

- **Naming collision — resolve at build time:** staff "Grades 1–5" vs dealership "Tiers 1–7".
  The staff ladder must ship under a different word (**grade / rank / archetype level**), **never "tier"** —
  the dealership tiers own that word.
- **Maps onto the EXISTING staff profile system:** green profile (0.35/0.4) ≈ grade 1–2;
  mature reference (0.75/0.75, the #94 calibration anchor) ≈ grade 3–4. This table gives those abstract
  skill scalars real-world output meaning (units + PVR + close-rate bands) for calibration tests.
- **Cross-validates the locked tier-gate units targets:**
  - T1 8/mo = solo owner at grade-3/4 output.
  - T2 15/mo = owner + grade-2 rookie.
  - T3 28/mo = 2–3 grade-3 staff with the owner off the floor.
- **PVR / back-end columns are also calibration anchors** for the F&I attach follow-ons (#151–#153).
- **Sequencing (locked in grill):** gate-threshold tuning (#247 sweeps, now folded into the #286 / S14
  calibration campaign) runs **after** the staff-teeth pass lands — salary drain + talent-scaled hire cost
  move the cash/gross faces directly. The harness build itself is not blocked.

## Build pointers

- Spine §5 (staff/operators engine) is the design home for the teeth: talent-scaled hire cost,
  recurring salary drain, scarcity, poaching/retention.
- The staff-teeth pass is the remaining Fable/Opus design session; data-file authoring afterward = Sonnet.
- The channel-desk manager model (`manager-roles-channel-desk.md`) M7 skill-growth engine already lit up the
  derived-skill-toward-cap mechanic — grade bands here calibrate the per-hire cap / growth-rate placeholders.
