# Gate index — what to load for each pending director decision

`/decide` reads this instead of re-deriving which docs own a gate. One row per pending gate in
`docs/planning/build-state.md`'s phase table, in phase order.

**Load column = read these, in this order.** **Locked column = settled input; read it, never
reopen it.** **Record column = where the ruling is written.**

When a gate is ruled, move its row to the **Settled** section at the bottom with the date and
the doc that holds the ruling. When a gate's real context turns out wider than a row says, fix
the row in the same commit as the ruling.

---

## Phase 6 — C1 staff-teeth · **GRILL** (the one ungrilled core mechanic)

- **Scope:** `path-to-finished-product.md` §5 C1 (`docs/planning/path-to-finished-product.md:154`).
  Salary drain (a star is a liability you feed with volume), talent-scaled hire cost, scarcity,
  poaching/retention.
- **Load:** `docs/planning/macro-loop-spine.md` §5 (staff = the engine of the whole arc) ·
  `docs/planning/staff-performance-ladder.md` (the real-industry 5-grade ladder, #249 — the
  calibration anchor) · `docs/planning/poaching-cut.md` (what was cut and why) ·
  `src/game/StaffOrg/CLAUDE.md` + `src/game/StaffMorale/CLAUDE.md` for the current surface.
- **Locked:** macro-spine §5 intent; the 5-grade ladder; the engagement spine's rule that every
  starred reaction stars an entity with a fate (staff are those protagonists).
- **Grill?** **Yes** — this is the only gate that earns `/grill-me`. Everything else here is a
  short fork set.
- **Record:** new `docs/planning/staff-teeth-design.md` (the design record), plus the C1 section
  tag flipped to `[LOCKED <date> — staff-teeth-design.md]`. Next unit after: SLICE phase 6.

## Phase 7 — A2 per-tier staff slots + facility scale · **ADJUDICATE** `[NEW]`

- **Scope:** §3 A2 (`path-to-finished-product.md:90`). Per-tier slot/lot caps in `data/` +
  a roster surface showing filled/empty slots; service bays as facility slots.
- **Load:** `docs/planning/Gameplay Loops and Dealership progression tiers.csv` (the counts:
  T3 = 3 sales / 1 UCM / 1 F&I / 1 SA / 1 BSA; T4 = 6 sales / 2 SA / 2 BSA; lot sizes
  6/12/35/75/120) · `docs/planning/manager-roles-channel-desk.md` · existing tier data under
  `data/`.
- **Locked:** the CSV is tier + profit-center truth; the channel-desk doc is manager truth
  (`tier-progression-canon` memory). The counts are not the fork — the *shape* is.
- **Record:** the A2 section, `[NEW]` replaced by the ruling; then SLICE phase 7.

## Phase 9 — B2 F&I plug-in #2 · **RESUME a parked grill**

- **Scope:** §4 B2 (`path-to-finished-product.md:126`). Absorbs #151–#153.
- **Load:** `docs/planning/fni-mechanics-grill-state.md` — resume at its **STILL-OPEN branches**
  (`:87`), following its own re-entry instruction (`:114`), starting with #153.
- **Locked:** `docs/planning/engagement-spine.md` (F&I is plug-in #2, not the tracer); F&I
  auto-resolves — there is no manual deal screen (`felt-loop-dope-wars-lemonade` memory).
- **Record:** `fni-mechanics-grill-state.md` itself (it *is* the grill record) — mark resolved
  branches, keep the STILL-OPEN list honest.

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
