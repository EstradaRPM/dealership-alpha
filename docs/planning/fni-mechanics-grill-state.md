# F&I Mechanics Grill — COMPLETE (design locked)

**Status:** **RESUMED AND CLOSED 2026-08-07** via `/decide` (phase 9). Opened 2026-06-28,
paused 2026-07-08, resumed at the STILL-OPEN branches per the re-entry instruction. Every
branch is now either locked below or is a magnitude owed to the calibration campaign.
**Do not re-grill any of it** — the next unit on phase 9 is a SLICE.

**Why it was paused:** The grill surfaced a bigger, game-wide problem (engagement / "does any
of this feel fun") that is larger than F&I and had to be resolved first, in its own session.
That pass landed as `docs/planning/engagement-spine.md`, which REPOSITIONED F&I from the
spine's *tracer* to its **second plug-in** — the one that proves the Reveal grammar spans from
a daily beat up to a monthly strategic verdict.

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

## LOCKED — the resumed branches (`/decide` phase 9, 2026-08-07)

**Q7 — The finance mix is READ AHEAD, on the wire.** The crowd's finance/credit mix becomes a
**MarketIntel lane**, gated by the same door model as every other lane — opened by the paid data
subscription **or** by having the F&I manager on the desk (`src/game/MarketIntel/types.ts:43-57`
already carries both, `subscription` and `a used car manager sits on the desk`; the F&I manager
becomes a third opener). The player sets next month's posture *knowing* the crowd leans cash.
**Reasoning:** a posture set blind is a coin flip, not a bet, and the engagement spine's whole
grammar is "a bet you place, the Reveal resolves." It also gives the T3 F&I hire a second reason
to exist beyond attach rates. Rejected: rear-view-only (the dial degrades to a guess you correct)
and always-visible-free (spends #178's access-lane mechanic for nothing and makes the other
doors look arbitrary).

**Q8 — The player can BUY a different crowd, credit-wise.** Advertising campaigns gain
**person-archetype weights** beside the vehicle-type weights they already carry
(`data/tunables.json` `demandShaper.advertisingInfluence`, today only
`suv/sedan/truck`). A "we finance anyone" push pulls a lower-credit, must-finance crowd (busy
finance office, thin front gross); a certified-preowned push pulls high-credit cash buyers (fat
front, dead office). **This lands IN B2**, not in a later demand slice. **Reasoning:** a ceiling
you can read but cannot move is half a mechanic, and the F&I coupling is precisely what gives
the long-standing demographic-mix requirement its teeth — the two are the same feature seen from
two ends. Rejected: leaving credit mix to drift only as a side effect of advertised vehicle taste
(weak and indirect — the month's biggest F&I variable would sit outside the player's hands), and
making *location* the credit axis instead of advertising (ties the ceiling to the ladder rather
than to a monthly decision, and makes location a modeled property it currently is not).

**Q9 — The posture dial is THREE POSITIONS: "More per deal" / "Balanced" / "More deals".**
Plain words naming the actual axis — no jargon, no temperature language. Persists as one id on
the save slot, exactly like `tradePolicy` / `pricingStrategy` / `sourcingLean`
(`src/app/useLevers.ts:105`; the trade-policy catalog at `data/tunables.json:774` is the shape to
copy). **Reasoning:** Q5 explicitly killed slider-hunting, and with three stops the Q4 peak meter
reads as "the peak is at Balanced this month" — a legible bet. A continuous number invites
optimizing instead of betting. Rejected: a 0–100 slider (re-creates per-deal slider-hunting one
level up) and five positions (the middle three would carry all the early traffic).

**Q10 — There is NO product-level control.** All six products unlock at T3; the manager attaches
optimally within the stated posture, and `product_presentation` sets how well. **Reasoning:** Q5
locked that the manager fully resolves every deal — a per-product switch is a second F&I control
surface with no real trade-off in it. Turning off `etch` is strictly worse unless CSI drag is
priced *per product*, which is a fourth rule on a mechanic whose whole point is one dial.
Rejected: per-product on/off, and a coarser core-vs-add-ons pair.

---

## Internal decisions (made by `/decide`, not grilled — these are engineering calls)

- **I1 — Reserve lives inside `DealEngine`.** `computeAutoFni` splits into the product component
  plus a new `computeReserve(...)`. `ClosedDealResult.backGross` stays the **total**, with
  `productGross` / `reserveGross` broken out so a Reveal reaction can name which half moved. A
  separate module would need every input DealEngine already holds
  (`src/game/DealEngine/DealEngine.ts:130`).
- **I2 — `data/credit-tiers.json`'s `apr` becomes `buyRate`** — the lender's cost of money — and
  the customer's rate is `buyRate + markup`. Today's field is the customer rate masquerading as
  the lender's. Adds `markupCapPts` per tier (subprime lenders cap tighter). **No flats:** a flat
  is a second pricing rule the player can neither see nor move, and the markup model already does
  the job flats exist to do.
- **I3 — Structural deal-kill needs no new machinery.** Markup raises the payment, which runs
  straight into the `ptiCap` / `maxTerm` / `ltvCeiling` already in the tier table. That is one of
  Q3's two kill causes, for free.
- **I4 — #152 is one per-product `loanSensitivity` multiplier**, not a new event. GAP is
  hard-gated to financed deals (that is literally what GAP covers); VSC/PPM scale with amount
  financed; etch / key / T&W stay flat.
- **I5 — #153 traits resolve through the existing `resolveEffects` machinery**, applied after the
  archetype base roll at `src/game/NPC/factories/CustomerFactory.ts:251`. `must-finance` overrides
  the affordability gate.
- **I6 — #151 per-brand reputation is ambient depth, not a dashboard.** `Reputation.repFor(make)`
  replaces the `reputationBonus` stub in `pickVehicle.ts`; it is surfaced only as Reveal reaction
  text, never as a brand-reputation screen (`sim-depth-not-surface-complexity`).
- **I7 — CORRECTION to this doc's own earlier note:** the posture is a **slot field, not world
  state**. There is **no `WORLD_SNAPSHOT_VERSION` bump and no migration** — every sibling lever
  persists on the slot (`src/app/useLevers.ts:105`). The old "envelope bump + migration" line was
  wrong; do not go looking for a migration to write.
- **I8 — One deal-kill curve in `data/`.** Fall-through probability rises with markup points past
  a safe frontier that `finance_structuring` extends (Q5's "peak slides toward aggressive"). No
  per-lender branching.
- **I9 — All magnitudes belong to the calibration campaign**, not to this design: markup caps,
  the kill-curve slope, CSI drag size, the F&I-manager act-threshold.

---

## What genuinely remains

Nothing in the design. The open items are **numbers**, owed to a calibration pass in the same
shape as #286 (see I9), plus the engagement surfacing — the monthly bet-verdict, the PVR record
chase and the mix-ceiling reveal — which was ELEVATED out of this grill into
`docs/planning/engagement-spine.md` and is built as plug-in #2's Reveal reactions.

**Next unit for phase 9: SLICE.** Scope comes from the LOCKED sections above plus
`path-to-finished-product.md` §4 B2; #151, #152 and #153 are absorbed as filed.
