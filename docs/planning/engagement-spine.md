# Engagement Spine — DESIGN RECORD (locked 2026-07-12)

**Status:** Locked concept, ready to decompose into build slices. Output of the engagement
design-reflection session requested in `engagement-spine-brief.md`. Do NOT re-grill the LOCKED
section; the STILL-OPEN section lists what's a build-detail vs. a tuning call.

Companion inputs: `engagement-spine-brief.md` (the prompt), `docs/audits/game-coverage-matrix.md`
(build state), memories `felt-loop-dope-wars-lemonade`, `sim-depth-not-surface-complexity`,
`managerial-default-felt-loop`, `market-economy-design-lock`, `fni-grill-parked`.

---

## The diagnosis (why the game risks feeling like a spreadsheet)

A felt beat needs five things: **a bet under uncertainty → a stochastic resolution → a verdict
legible AS the consequence of that bet → landing as a discrete moment → laddering into something
bigger.** Graded honestly, the game is **almost all bet, almost no verdict-moment**:

- Bets: abundant (inventory recipe, pricing/sourcing/trade/discount/F&I posture, hiring, hours, ads).
- Stochastic resolution: enormous and honest (emergent heat, hidden lemons, haggle rolls, weather).
- **Verdict legible as consequence: mostly NO** — the day resolves into aggregate gross/units + a
  monthly gate strip. The causal thread from a morning call to an evening outcome is severed.
- **Discrete moment: almost entirely ABSENT.** Everything is a number that silently updates a
  ledger. The ONE exception is the #199 match-payoff toast — the only real felt beat shipped.
- Laddering: thin (tier streak + chapter card; a passive history log; no records).

**Root cause — the managerial-watch loop has a structural dopamine bug: the payoff is diffuse,
never punctuated.** Dope Wars' magic is the *reveal* ("you arrive → busted / price spiked 300%").
This game spread its reveal thin across a real-time dashboard you watch tick, then compressed the
meaning into an aggregate recap. Both halves kill the moment.

**The depth is not the problem — the depth is dark.** The sim emits a rich resolution event stream
and lets nearly all of it resolve silently. The fix is **surfacing existing depth, not modeling
more.** (Proof: the cheapest thing built — one toast, #199 — is the only thing that feels like a
game.)

---

## LOCKED design — "The Reveal"

**One report the player watches at the close of whatever bite of time they chose to run.** Same
grammar forever: a few **starred reactions** + a **plain-language scoreline.**

### 1. The atom of fun is a *reaction to your bet*, not a number

A "customer reaction" is only the T1 version of "the world reacted to my bet — was I right?"
Every felt beat in the game is one shape:

> 🟢 *"Family wanted a 3-row SUV. You had one, priced sharp. **Sold — $2,400 front.**"*
> 🔴 *"He wanted a cheap commuter. Your lot was all trucks. **Walked.**"*

Records, F&I, and shocks are all just *kinds of reaction* on the same feed — nothing separate to
build:
- A **record** is a reaction with a crown: *"Best day yet."*
- **F&I** is a reaction: *"Cash-heavy crowd — the finance office sat empty."*
- A **shock** (news engine) is the loudest reaction: *"Snowstorm — AWD flew off the lot."*

### 2. Self-similar / fractal — the grain and the clock zoom WITH the business

The grammar never changes; only the entity reacting (and the clock) gets bigger as the player
climbs T1→T7. This is what makes ONE system stay familiar across every version of the game the
player "opens up," and it's why dopamine doesn't drown in volume at scale — it **rolls up.**

```
T1  (one lot, one day)     ⭐ "Family wanted an SUV, you had one — SOLD"
                             "6 of 8 stuck today."
T4  (a store, one month)   ⭐ "Truck crowd came all month, you were stocked — best used month yet"
                           ⭐ "New-car allocation choked you — 12 deals you couldn't feed"
                             "Used desk carried the store."
T7  (a group, one quarter) ⭐ "Queens store is your engine — record quarter"
                           ⭐ "The Bronx store is bleeding — third bad month"
                             "The group grew, but on one store's back."
```

Grain ladder: **customer → segment/salesperson → department → store → group.**
Clock ladder (moves in lockstep): **day → week → month → quarter.**
The Reveal always summarizes to the current altitude and shows only the top few dramatic reactions.

### 3. THE load-bearing rule — every reaction stars an entity with a fate

At T1 the reaction is a face lighting up (felt). At T7, "truck segment +3%" is a number (dead). If
the zoomed-out Reveal degrades into bare metrics, the spreadsheet is rebuilt at altitude. **Rule:
at every zoom level, each starred reaction stars someone/something with a fate — a customer, a
salesperson, a department, a store manager, the group — winning or losing. Never a bare metric.**
"Queens is your engine, the Bronx is bleeding" has a protagonist and stakes; "store-2 margin 14.2%"
does not. This is also *why* staff-teeth and the multi-store macro matter: they supply the
protagonists to star at the higher zooms.

### 4. Cadence — the player drives the clock

The player chooses how big a bite to simulate ("run a day" / "run a week" / "run the month") and
gets the Reveal for exactly that bite. **The bite-size choice is itself a bet** — fast-forward a
calm month = confidence; step day-by-day = nerves. The zoom is a verb the player uses, not a
settings toggle.

**Resolves cleanly against the locked real-time floor (#99/#107):** the real-time floor is simply
the *finest* zoom. The existing pause/speed control already throttles a day; driving-the-clock
extends that same control *upward* into weeks/months. The floor is the bottom rung of one ladder —
not replaced.

### 5. The morning must be framed AS a bet

For the Reveal to score "your bet," the bet has to be captured. At T1 the bet is the morning prep
(recipe + price + staff); at higher tiers it's the period's strategic posture. Capture the
expectation at the start of the bite so the Reveal can resolve it. This is framing + one
expectation-capture, not new mechanics.

---

## Architecture (internal — not player-facing)

The sim already emits the resolution event stream (`staff:auto_resolved` w/ matchQuality,
`deal:closed`, walk-offs + reasons via CapacityManager/SalesProcess, `tierGate:month_verdict`,
service/body-shop tickets, F&I posture). The Reveal is **one presentation module that subscribes to
that stream, aggregates to the current altitude, ranks reactions by drama, and renders the
top few + a scoreline.** Build the renderer once; systems light up as they emit into it. It is NOT
three layers (feed / verdict / records) — in player terms it's one highlight-reel-with-a-scoreline;
records are just crowned reactions, F&I/shocks just more reactions.

"Emergence" is NOT a separate layer — it's a QUALITY of the Reveal's copy: when two couplings bite
together, the Reveal names it ("snow day: AWD flew off the lot AND collision work spiked"). No new
engine; the renderer is coupling-aware.

Honors all locks: managerial-watch (you watch the Reveal, never click a sale), F&I/deals
auto-resolved, ambient-by-design depth stays hidden (holdback never surfaces), plain-language
labels (no temperature words). Small: reuses the event stream already emitted.

---

## Build order (commit-sequence only — NOT scope buckets)

1. **TRACER — the T1 daily Reveal.** Reuse #199's match toast as the seed; grow it into starred
   customer-reactions (matches + walk-offs-with-reasons) + a plain scoreline; capture the morning
   prep as a bet. T1 = live from minute one, daily = fast tuning loop, the core skill, cheapest.
   Proves the grammar with a single customer/day. **FILED 2026-07-12 as 4 slices:**
   **#319** Reveal renderer + plain-language scoreline (AFK, no deps — build first) →
   **#320** starred individual sale reactions/wins (AFK, deps #319) →
   **#321** walk-off reactions/losses (AFK, deps #319) →
   **#322** morning prep captured as a bet + scoreline resolves it (HITL, deps #319).
2. **F&I as plug-in #2.** REPOSITIONED from the parked F&I grill's assumed *tracer* to the *second*
   plug-in — it proves the grammar spans up from a daily beat to a monthly strategic verdict
   ("cash-heavy crowd → finance office empty" as a coupling-aware Reveal). Better role than tracer:
   it's T3/monthly/abstract, wrong for a fast tuning loop, right for proving span. See
   `fni-mechanics-grill-state.md`.
3. **News / adverse-events engine (#176–#179) feeds the same Reveal** — the loudest reactions on
   the feed. It is ENGINE/content work (model more), plugged into the spine once the spine exists.

---

## STILL-OPEN (build-details + tuning, not fresh design forks)

- **Reveal ranking function** — how "drama" is scored to pick the top few reactions per bite
  (match strength, gross surprise, walk-off pain, record broken, coupling fired). Tuning.
- **Bet-capture shape at T1** — what exactly is snapshotted at prep to score against the day.
- ~~**Star budget per altitude**~~ — **CLOSED 2026-08-11 by #382 (phase 11 / B4 S2), at the grain
  that forced it.** The budget rides the **bite** in `data/clock-bites.json` (`starBudget`, beside
  `days`), not the ranking — `tunables.reveal.drama.starBudget` was deleted rather than left beside
  it, so there is one budget per grain and not two places to disagree about the same day. Shipped:
  **5 / 9 / 14** against 1 / 7 / 30 days, i.e. it grows **sub-linearly** — seven days of reactions at
  seven times the stars is a scroll, not a beat — and the schema refuses a longer bite carrying a
  smaller budget. The day's 5 is the pre-#382 number unmoved, so a day's Reveal is identical to
  before the slice. Two rules go with it: **what the budget cut is stated, not dropped** (one
  plain-language line at the foot of a bite's feed, never an expandable list — a surface that can
  show everything is a report, not a Reveal), and **a crowned record is admitted before the budget
  is spent** (weighting a crown above the win/loss axes, #330, is not a guarantee; a high-water mark
  is the one reaction the player provably cannot see anywhere else on that screen). Re-tuning the
  drama *weights* remains C2-class calibration and is untouched.
- ~~**Grain/clock unlock schedule**~~ — **SETTLED 2026-08-11 (phase 11 / B4). One rule: you can
  skip ahead exactly as far as your people can cover for you.** *Run the Day* is always open;
  *Run the Week* opens when the used desk covers **both** discount desking (#290) and trade
  approval (#291); *Run the Month* opens when a **general manager** is staffed (#124's filed
  rule). The door and the capability are the same fact — a multi-day run can only go headless when
  nothing escalates to the player, and what stops escalations is a staffed desk at threshold — so
  the player never learns a second rule, and the schedule lands at ~T3 and ~T6 without naming a
  tier. **Rejected:** a bare tier number (opens the door while the desks are empty, so the bite
  promises a week and halts on day 1) and an earned clean-day streak (a new persisted counter, and
  the player has to infer why the button came and went). Filed as **#381–#385**; do not re-open.
- **Records catalog** — which high-water marks are worth crowning (best day, PVR record, streak…).
- Magnitudes throughout → the #286 calibration campaign.
