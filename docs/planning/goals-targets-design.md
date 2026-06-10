# Goals / Targets Design — fork 2 resolution

**Status:** Design locked, 2026-06-10. Resolves fork 2 of the UI-mapping pipeline against the locked macro-loop spine.
**Reads from:** `macro-loop-spine.md` (the progression spine). **Feeds:** the Home goals surface in the UI rebrand, and eventual PRD/issues.
**Supersedes** the pre-spine fork-2 sketch ("period objectives + 4-band gradient + persistence escalation + retroactive bonus") — that visual language survives; its structure is re-shaped below.

The headline object is no longer a flat list of period targets. It is the **multi-dimensional tier GATE** (units + capital + CSI + financial strength + facility-performance), whose **binding constraint shifts as you climb** — that shifting bottleneck (spine §10) IS the intra-tier arc and is what the surface must dramatize.

---

## The self-similar nesting (the spine's one thesis, applied to goals)

One loop at every zoom; each level **feeds** the level above, it does not compete with it:

> the **day** feeds the **monthly gate** → the **OEM month** feeds the **tier climb** → each **store** feeds the **empire gate**.

This nesting is the backbone of all five decisions below.

---

## Decision 1 — what the 4-band gradient grades: the period, not the day

The **day is counted, not judged.** Each day ends with the satisfying money/sales recap PLUS the monthly gate bars **visibly ticking up** from today's haul (animated fill, climbing numbers — tactile, not a static refresh; this *is* the daily reward beat and must stay tangible or it collapses into flatness).

The **4-band verdict** (Exceed / Meet / Near-miss / Miss), the confetti, the bonus, and the escalation **all fire once, at month-end, on the gate.** There is exactly one graded object with teeth. No daily letter-grade competing for attention, so the player can never mistake a good day for a rank-up.

> Not "daily grade vs. monthly grade." It is "daily *visible contribution* feeding a single monthly grade."

## Decision 2 — honest dashboard; the player diagnoses the bottleneck

The surface speaks real DMS/CRM: **pace projection, on/off pace, units-to-catch-up, projected month-end landing, pipeline %.** The game computes the projections; the **player** reads which gate face is the wall. No coach pointing fingers — reading your own dealership is the sim-medium skill, and it stays the player's.

Onboarding difficulty = **less on screen early** (fewer faces/metrics lit at T1–T2, more as you climb, via the fork-1 progressive-unlock), **never** the game thinking for you. The binding constraint *emerges* from honest projections; it is not a computed-and-spotlighted "weakest link."

## Decision 3 — each gate face renders in its native idiom

The five faces are not the same metric *type*, so one uniform bar would lie. Each speaks its real reporting dialect:

| Gate face | Type | Readout |
|---|---|---|
| Units sold | flow | full pace / projection / units-to-catch-up |
| Gross profit | flow | same, in dollars |
| Cash / financial strength | stock/level | gauge with a **threshold line + trend arrow** (monthly-average level, can fall, no "catch-up") |
| CSI | slow rolling average | **multi-week trend sparkline** (climbing / flat / sliding) — not a daily pace |
| Facility / image standard | binary / stepped | **compliance tile / star rating** with a **capex-to-clear** figure |

Four honest idioms. A flow reads like a sales-pace report; a balance reads like a balance; the facility reads like an image-compliance scorecard.

## Decision 4 — the OEM stair-step (T4+): nested-and-foreground, new-car-scoped

At T4 a second goal object lands: the **OEM monthly objective** — hard month-end deadline, **stair-step bonus retroactive on every unit** (miss by one car and you lose it on all of them), miss repeatedly → allocation tightens → franchise at risk. This is the loud monthly heartbeat and the recurring drama. **It is where the persistence-escalation teeth re-home** — escalation belongs to *missing OEM months and solvency*, NOT to taking your time on the self-paced tier climb (advancement is courtship; you are never *punished* for climbing slowly).

But the dealership is **not only a franchise dealer** at T4. The sales department runs **two goal streams** (spine §3: the used operation must never become wallpaper):

- **New-car stream — the OEM stair-step.** Loud, deadline'd, externally imposed, *new units only*. Supply comes via **allocation, not shopping** (see the parked `OEMRelationship` engine below).
- **Used-car stream — your own game, unchanged from T1.** UCM sourcing, trades, the auction cherry-picking home base (spine §9). Same decision-3 flow idiom, but **no external deadline, no penalty** — the self-paced profit engine and the one surface that never locks away.

The two streams **fill different faces of the tier mountain**, which is what keeps the used side load-bearing:

- new-car volume → **OEM-standing + sales-record** (what the gate and your next franchise application read),
- used + F&I + service gross → **cash + financial-strength** (new cars are *thin*; floorplan interest on aged new metal actively *drains* cash, so the real wealth comes off the used desk and the back end).

You **structurally cannot climb on the OEM quota alone** — the binding-constraint mechanic surfaces "OEM's happy, but you're cash-thin → go work used." The tension between chasing thin-gross OEM volume and working fat-gross used metal is the spine's **gross × volume axis (§6) made tangible on your own sales floor.**

### Parked dependency: the `OEMRelationship` engine (T4, capture-not-build)
New-car supply is its own engine, separate from used sourcing — **allocation / turn-and-earn** (the factory decides; "allocation you don't fully control"), a **floorplan credit line** (per-unit-per-day interest + curtailments), and **incentives / holdback / co-op**. This is literally T4's named verb in spine §4. It earns a dedicated grill + a `data/`-driven module, T4-gated — **do not build ahead of need.** The goals surface only *reports* it.

## Decision 5 — multi-store (T6+): full board for the active store, digest for the rest

At T6 you install a GM and open a second store. The tier mountain itself **goes portfolio-scale** (net worth incl. all owned inventory, brands held, prestige) — T7 is "pure portfolio" (spine §8). Each store carries operational goals *and* the empire carries the headline gate; they nest, third zoom of the loop.

- **Active store** (the one you play hands-on) — the **full live five-face dashboard** + both sales streams + OEM stream. Everything from decisions 1–4.
- **Background (GM-run) stores** — collapse to a **mandate you set** ("push volume / balanced / protect gross / recover CSI") + a one-glance **on/off-mandate verdict** + the fork-1 **income/expense report card**, with **only a broken face escalating** to demand your attention. The full board exists only for the store you are actively playing; drop in and it expands, leave and it collapses.

This applies the spine's delegation philosophy (§2, §101) to the goals surface itself: as you climb you stop reading gauges and start reading **one verdict per store + exceptions** — how a real multi-point dealer group is actually run. The mandate is also where the background GM's archetype bites (a volume-GM on a "protect gross" mandate underperforms — operator→mandate match, §5).

---

## What carried over unchanged from the pre-spine sketch
- The **4-band gradient** (Exceed / Meet / Near-miss / Miss) — now attached to the period gate (decision 1).
- The **stair-step retroactive bonus** — now realized literally as the OEM stair-step (decision 4).
- **Persistence escalation** — survives but re-aimed onto OEM-month misses + solvency, not the tier climb (decision 4).
