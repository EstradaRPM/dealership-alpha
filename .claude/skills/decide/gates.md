# Gate index — what to load for each pending director decision

`/decide` reads this instead of re-deriving which docs own a gate. One row per pending gate in
`docs/planning/build-state.md`'s phase table, in phase order.

**Load column = read these, in this order.** **Locked column = settled input; read it, never
reopen it.** **Record column = where the ruling is written.**

When a gate is ruled, move its row to the **Settled** section at the bottom with the date and
the doc that holds the ruling. When a gate's real context turns out wider than a row says, fix
the row in the same commit as the ruling.

---

## Phase 11 — B4 bite-unlock schedule · **decide while building**

- **Scope:** §4 B4 (`path-to-finished-product.md:139`). Which tier/delegation state unlocks
  which bite (day / week / month), absorbing #124 as the top rung.
- **Load:** `docs/planning/engagement-spine.md` (its STILL-OPEN section, `:150`) ·
  `docs/planning/macro-loop-spine.md` §2 (delegation = permission) + §10 (intra-tier pacing).
- **Locked:** the spine itself; delegation gates the bite — the fork is only the schedule.
- **Record:** `engagement-spine.md`'s STILL-OPEN entry, flipped to the settled schedule.
- **Note:** this one is explicitly ruled *during* phase 11's build; `/decide` may run it early
  if the user asks, but `/next` does not owe it a separate gate session.

## Phase 12 — F2 backstory legibility · F3 notifications · D3 plain-language pass · **ADJUDICATE** `[NEW]`

- **Scope:** §8 F2 (`:257`), §8 F3 (`:262`), §6 D3 (`:194`). Three small independent rulings —
  present them as three forks in one session, not three sessions.
- **Load:** the three sections · `src/ui/CharacterCreation/` for what the backstory picks
  actually do today · `docs/planning/second-level-ia.md` for surface inventory.
- **Locked:** the no-temperature-words rule applies everywhere D3 touches
  (`feedback-no-vague-temperature-labels`).
- **F3 is a yes/no:** if no OS notification is ever used, the ruling is "none" and the item
  closes — the doc says so in as many words.
- **Record:** each section, `[NEW]` replaced by its ruling.

## Phase 15 — E2 fixed-ops-manager fork · **ADJUDICATE**

- **Scope:** §7 E2 (`path-to-finished-product.md:223`). The CSV's combined "Bodyshop & Service
  Manager" vs the implemented service-manager + body-shop-manager split. Whichever wins, the
  loser is corrected — update the CSV or update `data/`.
- **Load:** the CSV's T5 row · `docs/planning/manager-roles-channel-desk.md` ·
  `docs/planning/shared-department-structure.md` (the two departments already share one line).
- **Locked:** the shared department backbone (#311–#318 built); the tier ladder itself.
- **Record:** `manager-roles-channel-desk.md` (manager truth) + whichever of CSV/`data/` the
  ruling corrects.

## Phase 19 — G1 audio/haptics direction · G2 motion pass · **DECIDE + ADJUDICATE** `[NEW]`

- **Scope:** §9 G1 (`:270`), §9 G2 (`:279`). G1 has no prior doc and nothing built — it needs
  the user's *direction* (the minimum finished bar is listed; music is named a taste call).
- **Load:** the two sections · `src/ui/kit/CLAUDE.md` (tokens, and where a motion/sound seam
  would live) · `docs/planning/engagement-spine.md` (the Reveal is the anchor moment to score).
- **Locked:** no new pipeline — RN Animated/Reanimated only; Lottie/sprite is outside the design.
  The a11y toggle (#268) governs haptics.
- **Record:** new `docs/planning/audio-motion-direction.md`, then the two sections point at it.

## Phase 21 — G4 performance + device pass · **ADJUDICATE** `[NEW]`

- **Scope:** §9 G4 (`path-to-finished-product.md:288`). The fork is the **bar**: what frame
  budget, what save latency, which device class counts as passing.
- **Load:** the section · `.claude/skills/verify/SKILL.md` (what can actually be measured) ·
  `docs/save-migration-recipe.md` (envelope size at v16).
- **Record:** the G4 section, `[NEW]` replaced by the numeric bar; then SLICE phase 21.

---

## Settled

(Ruled gates move here: gate · date · doc holding the ruling.)

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
