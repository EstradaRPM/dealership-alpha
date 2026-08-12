# Gate index — what to load for each pending director decision

`/decide` reads this instead of re-deriving which docs own a gate. One row per pending gate in
`docs/planning/build-state.md`'s phase table, in phase order.

**Load column = read these, in this order.** **Locked column = settled input; read it, never
reopen it.** **Record column = where the ruling is written.**

When a gate is ruled, move its row to the **Settled** section at the bottom with the date and
the doc that holds the ruling. When a gate's real context turns out wider than a row says, fix
the row in the same commit as the ruling.

---

## Phase 15 — E2 fixed-ops-manager fork · **ADJUDICATE**

- **Scope:** §7 E2 (`path-to-finished-product.md:339`). The CSV's combined "Bodyshop & Service
  Manager" vs the implemented service-manager + body-shop-manager split. Whichever wins, the
  loser is corrected — update the CSV or update `data/`.
- **Load:** the CSV's T5 row · `docs/planning/manager-roles-channel-desk.md` ·
  `docs/planning/shared-department-structure.md` (the two departments already share one line).
- **Locked:** the shared department backbone (#311–#318 built); the tier ladder itself.
- **Record:** `manager-roles-channel-desk.md` (manager truth) + whichever of CSV/`data/` the
  ruling corrects.

## Phase 19 — G1 audio/haptics direction · G2 motion pass · **DECIDE + ADJUDICATE** `[NEW]`

- **Scope:** §9 G1 (`:420`), §9 G2 (`:429`). G1 has no prior doc and nothing built — it needs
  the user's *direction* (the minimum finished bar is listed; music is named a taste call).
- **Load:** the two sections · `src/ui/kit/CLAUDE.md` (tokens, and where a motion/sound seam
  would live) · `docs/planning/engagement-spine.md` (the Reveal is the anchor moment to score).
- **Locked:** no new pipeline — RN Animated/Reanimated only; Lottie/sprite is outside the design.
  The a11y toggle (#268) governs haptics.
- **Record:** new `docs/planning/audio-motion-direction.md`, then the two sections point at it.

## Phase 21 — G4 performance + device pass · **ADJUDICATE** `[NEW]`

- **Scope:** §9 G4 (`path-to-finished-product.md:438`). The fork is the **bar**: what frame
  budget, what save latency, which device class counts as passing.
- **Load:** the section · `.claude/skills/verify/SKILL.md` (what can actually be measured) ·
  `docs/save-migration-recipe.md` (envelope size at v16).
- **Record:** the G4 section, `[NEW]` replaced by the numeric bar; then SLICE phase 21.

---

## Settled

(Ruled gates move here: gate · date · doc holding the ruling.)

- **Phase 12 — F2 backstory legibility · F3 notifications · D3 plain-language pass** · 2026-08-12
  · `path-to-finished-product.md` §6 D3, §8 F2, §8 F3 (each ruling written into its own section).
  Five rulings. **The gate's premise was wrong and that is the record's most load-bearing line:**
  the backstory picks do not have unexplained Day-1 effects, they have Day-1 effects that are
  never *applied* — `day1Modifier` is read by nothing in `src/`, so all three backstories are
  mechanically identical today. **F2-R1** wires all four declared levers as the real thing
  (`startingCapitalBonus` and `reconJudgmentBonus` into seams that exist; `startingCreditLine`
  becomes a borrowing facility and `grudgesFlag` a starting reputation deficit) and states each on
  the card; **F2-R2** states the tier-1 failure stakes once, the first time cash goes low.
  **F3 is NONE and CLOSED** — nothing simulates in the background, so a notification has nothing
  true to say. **D3-R1** money is compact when ambient, exact when the player is about to act;
  **D3-R2** a consequence hint shows until its control has been used once, then retires, sharing
  **one registry and one per-slot cell with F1's progressive disclosure**. Rejected options are
  recorded in each section with their reasons — do not reopen them. Next unit: SLICE phase 12.

- **Phase 11 — B4 bite-unlock schedule** · 2026-08-11 · `docs/planning/engagement-spine.md`
  (the STILL-OPEN "grain/clock unlock schedule" entry, flipped to settled). **One rule: you can
  skip ahead exactly as far as your people can cover for you.** Day always; Week when the used
  desk covers both discount desking (#290) and trade approval (#291); Month when a GM is staffed
  (#124). Ruled at the slice gate rather than during the build because the schedule had to be
  encoded into the filed issues (#381–#385) — filing it unruled would have smuggled it. Rejected:
  a bare tier number, and an earned clean-day streak.

- **Phase 9 — B2 F&I plug-in #2** · 2026-08-07 · `docs/planning/fni-mechanics-grill-state.md`
  (the grill record itself, now CLOSED). Four rulings on top of the original Q1–Q6: **Q7** the
  crowd's finance mix is read *ahead* on the wire, gated by the data subscription or the F&I
  manager on the desk; **Q8** advertising gains person-archetype weights so the player can BUY a
  different crowd credit-wise, built in B2 rather than deferred to a demand slice; **Q9** the
  posture dial is three positions — "More per deal" / "Balanced" / "More deals" — persisted as a
  slot id like every sibling lever; **Q10** no product-level control, the manager owns the menu.
  Nine internal calls are recorded alongside them, including the correction that the posture is
  slot state, so there is **no snapshot-envelope bump**. Next unit: SLICE phase 9.

- **Phase 6 — C1 staff-teeth** · 2026-08-02 · `docs/planning/staff-teeth-design.md`.
  Daily wage by grade × role (commission rejected); raises are a played moment that also
  carries poaching; CSV slot table is the scarcity cap. Its prerequisite (A2) is now ruled.

- **Phase 7 — A2 staff slots + facility scale** · 2026-08-03 · `path-to-finished-product.md`
  §3 A2 (the ruling is written into the section itself). **R1:** tier-up grants the CSV's staff
  desks outright; lot spaces and bays are *bought* with cash + construction days up to the
  tier's ceiling, and built÷ceiling lights the dormant `facility` tier-gate face. **R2:** the
  lot cap governs *buying* — every owned unit takes a space (prep included), bidding is blocked
  at capacity, and a trade always lands and may put you over, which simply freezes buying until
  you're under. Overflow lots, forced wholesale, refused trades and soft caps are all recorded
  there as rejected with reasons — do not reopen. A voluntary wholesale-out ships with A2.
  Next unit: SLICE phases 6 and 7 together.
