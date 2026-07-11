# F&I Mechanics Grill — PARKED (resumable)

**Status:** PAUSED mid-grill on 2026-07-08 (originally opened 2026-06-28, interrupted by a
forced reboot; recovered from session transcript `9ac8b168`). Resumable — the decision tree is
recorded below with every locked branch and every still-open branch.

**Why paused:** The grill surfaced a bigger, game-wide problem (engagement / "does any of this
feel fun") that is larger than F&I and must be resolved first, in its own session. See the
companion engagement-spine design pass. F&I is intended to be the *tracer plug-in* that proves
that spine.

**Original grill args:** F&I mechanics — tier progression, F&I manager, user inputs,
user-impact profit variable. Include issues #152 / #153.

---

## Verified current-state (as of the grill; F&I code unchanged since — `fni-products.json`
last touched 2026-05-14, `DealEngine` 2026-06-20)

- `DealEngine.computeAutoFni(skill, unlockedRoles, rng)` — per-product attach prob =
  `baseAttachRate × skillMultiplier`, where `skill = salesperson effectiveness × 100`
  (range mult ~0.4–1.1). Back-gross = Σ(price − cost) of whatever attached.
- 6 products in `data/fni-products.json`. VSC + GAP always available;
  **tireWheel / etch / PPM / keyReplacement gated behind `requiredRole: "f&i-manager"`**.
- `f&i-manager`: manager-tier, dept sales, **hireTier 3**, grants `finance_structuring` +
  `product_presentation`, promotes salesperson → gm.
- Back-gross is **product profit ONLY**. There is **no finance reserve / rate markup** modeled
  at all — despite the spec's realism note naming "reserve." This is the central gap.
- Tier canon: T3 unlocks F&I dept + F&I manager + UCM. Channel-desk manager model is
  UCM / NCM / GM — the F&I manager sat *outside* that triad and was unreconciled.
- Customer already carries a **credit tier** (feeds #282 loan-payoff generation via
  `config.financing`), so a buy-rate model can key off it.
- #152 (attach scales with loan size) and #153 (cash-buyer / must-finance traits) are both
  reopened, unbuilt.

---

## LOCKED decisions

**Q1 — Profit model.** **B: product-attach + finance reserve.** Reserve modeled honestly
(buy-rate from credit tier, capped dealer markup, only on `finance` deals, zero on cash). The
**reserve markup posture is THE user-impact profit variable.** Product attach stays as the
second lever (the menu). #152 falls out of the reserve math for free (reserve only exists on
financed deals).

**Q2 — Tier progression.** T1–T2 (no F&I position): backend is **ambient and minimal** — VSC +
GAP auto-attach off salesperson skill (today's code), reserve ~zero or a tiny fixed baseline,
**no player lever**. Early game stays about the sales floor. **T3 (F&I position hired): the F&I
office "turns on"** — premium products unlock (tireWheel/etch/PPM/key), reserve becomes a real,
larger, **player-influenceable** number.

**Q3 — The teeth (what stops maxing markup).** **Deal-kill / fall-through = primary tension**
(the lender won't buy an over-marked deal / customer rate-shops and walks → aggressive markup =
fewer financed deals actually close; same volume×margin shape as pricing lean). **CSI /
reputation drag = secondary** (gouged customers score lower, softening future demand).
Chargebacks = a **later refinement layer on the same variable**, not a headline mechanic.

**Q4 — Control/feedback surface.** **Twin opposed bars + peak meter.** "Reserve per deal"
filling up ↑ vs "deals that stick" draining ↓, with a resulting **expected total back-gross**
meter that crests (there's an optimum that is NOT the max — an arrow would lie). NOTE: Q5
revised this from an *input the player drags* into a **feedback surface** that shows the
consequence of the player's chosen preference. The safe-markup peak **moves** with F&I-manager
skill, credit mix, and CSI standing (never a memorizable number).

**Q5 — Interaction model (load-bearing).** The **F&I manager FULLY resolves every deal** — no
per-deal touch, no slider-hunting, F&I stays auto-resolved by design. The player's ONLY F&I
input is a **strategic store preference: volume ↔ gross** (a standing dial set occasionally,
never per-deal). The manager executes *optimally within that stated preference* — told "gross"
it structures toward aggressive markup and accepts some deal-kill; told "volume" it pulls markup
back to protect close-rate + CSI. `finance_structuring` → how well it executes / how far the
safe gross frontier extends (better structurer = peak slides toward aggressive). `product_
presentation` → premium-menu attach rate. M-series advise-on-hire / act-on-skill, where "act" =
auto-optimize *within* the player's stated preference; the "override" is only ever re-setting
the standing preference dial. **Reconciliation:** the F&I manager is a **4th desk operator**,
parallel to the UCM/NCM/GM sales/inventory triad, not inside it (it runs the finance desk).

**Q6 — Scope of the volume↔gross dial.** **A: F&I-desk dial**, parallel to the existing desk
levers (pricing lean / sourcing lean / trade policy). NOT a store-wide doctrine dial that the
sales desks also obey (that was floated as option B — a coherent bigger vision, explicitly
declined for this build).

**Internal (decided, not grilled):** buy-rate keyed off the customer's existing credit tier +
a capped dealer markup; honest amortization/lender math under the hood.

---

## STILL-OPEN branches (finish these when the grill re-engages)

- **Buy-rate / rate model specifics:** lender rate table by credit tier, markup cap (e.g. ~2
  pts), flats? Magnitudes → #286 calibration, but the *shape* is ungrilled.
- **#152 attach-scales-with-loan-size:** exact mechanic — attach probability and/or product
  pricing scaling with amount financed.
- **#153 cash-buyer / must-finance traits:** how customers carry these; effect on
  financeability → reserve eligibility; the **demand-mix → F&I ceiling** coupling (cash lot =
  dead finance office; must-finance lot = finance goldmine) — this is the emergence hook.
- **Product menu at T3:** which of the 6 products, pricing, attach model, how
  `product_presentation` scales attach.
- **Deal-kill curve:** how markup → fall-through probability, and how `finance_structuring`
  bends that curve.
- **CSI coupling:** how aggressive markup feeds CSI/reputation, and magnitude.
- **F&I manager act-threshold** value (deferred to #286 calibration anyway).
- **Refactor shape:** split `computeAutoFni` back-gross into a product component + a reserve
  component; where reserve lives (DealEngine vs a new seam).
- **Persistence:** the volume/gross standing posture is new state → world snapshot envelope bump
  + migration (pre-feature saves default to a neutral/volume-leaning posture).
- **Engagement surfacing** (the "in the box" spike feed, monthly bet-verdict, PVR record chase,
  mix-ceiling reveal) — ELEVATED out of this grill into the engagement-spine pass; F&I is its
  tracer.

---

## How to re-engage

Re-read this file, then resume the grill at the **STILL-OPEN branches** above (start with #153 /
the demand-mix→F&I-ceiling coupling, since it's both an open mechanic and the emergence hook the
engagement spine will lean on). Do NOT re-grill the LOCKED section. The engagement-spine pass
should land first — its conclusions will shape how the open branches get surfaced.
