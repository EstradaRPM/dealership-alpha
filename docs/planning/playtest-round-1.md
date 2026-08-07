# Playtest round 1 — the felt-loop gate (#74)

**What this decides:** with A1 (advisor hiring), A4 (silent-system surfacing), B1 (Reveal
ranking + records), B3 (the news wire), the UI layout rebuild, C1 (staff teeth — wages,
raises, rival offers) and A2 (slots, facility build-out, the lot cap, the wholesale valve)
landed, the T1–T3 loop is finally whole enough to answer the only question that matters —
*is playing this actually engaging?* Round 1 runs now; round 2 runs after the C2 calibration
campaign (#286).

**Refreshed 2026-08-06.** Every navigation path below was re-walked against the shipped app
after phases 5c/6/7; the script the phone presents (`data/playtest-script.json`) was rewritten
to match. If a step names a screen you can't find, that's a finding — say so.

**Running it on a phone:** this doc is the source of truth, but **you don't read it while you
play and you don't take notes in it.** The script is in the game (#333). The day's card presents
itself when you enter the managerial window and again after the day closes — brief, tickable
steps, and the day's watch-questions with one-tap answers. Everything you tick and answer lands
in the same export as your flags and the auto-captured deals.

The only thing left for a keyboard is §6, the observation sheet, answered after the round.
Fourteen paragraphs typed on a phone is its own friction; the in-game probes are the
in-the-moment half, and they'll make §6 recall rather than reconstruction.

**Your job:** play it and report what you felt. **Not** your job: diagnosing, deciding
whether something is a bug or a bad number, or proposing fixes. Report raw observations —
"I sold nothing for two days and didn't know why", "the day is too long", "I didn't
understand what the wire was telling me". Triage is mine (see §7).

---

## 1. How to run it

```
npm run dev
```

Scan the QR in **Expo Go** (tunnel mode — the project default; never LAN/adb). This is the
path that answers the felt questions — real device, real gesture timing, real day length.

(A drivable **web** target landed in #338 — `npm run web`, and `src/game/SaveStore/webDriver.ts`
backs it. It exists so an agent can verify a surface renders and responds; it does not answer
§6, and it is not how you run this round. See `.claude/skills/verify`.)

### Two buttons, and only one you have to remember

**The blue ▤ card — the script.** It presents itself at each day boundary, so mostly you just
respond to it. It reads `▤ 3/9 · 2/4` — day 3 of 9, two of four steps ticked. Tap it any time
to reopen the current day's card. Tick a step as you do it; answer the day's watch-questions
with a chip or in your own words; tap **Day done →** when you're finished with that day, which
is what moves the card on to the next one. If a recap, month close or chapter beat is on
screen, the card waits its turn rather than covering it.

The card also carries the known-dark list (§4) inline, so you never have to wonder whether a
placeholder tab is worth reporting.

**The amber ⚑ — everything the script didn't ask about.** On screen at all times. **Tap it the
instant anything makes you react** — bored, confused, delighted, surprised, annoyed. It stamps
the day, phase, cash and tier for you; the note is optional, and there are four one-tap canned
notes if typing is too much friction in the moment.

That is the whole discipline. Don't try to hold observations in your head until the end of
a session — tap and keep playing. The count on the button is your running total.

Deals and walk-offs record themselves; you never have to write those down (see §5).

When you're done: **DEV → PLAYTEST LOG → Export** hands you a markdown file — the script trace,
your probe answers, your flags, and the deal/walk tables. Send me that, then answer §6 at a
keyboard.

**The DEV FAB** (floating "DEV" button, dev builds only) gives you:

| Lever | Use it for |
|---|---|
| **Playtest Log → Export** | The whole round's flags + deals + walk-offs. This is what you send me. |
| **Event Log** | Live EventBus tap. Optional now — the playtest log captures §5 for you. |
| **Cash → Inject / Set To** | Only if you want to isolate a question from a cash constraint. |
| **Customer Spawn** | Force a specific archetype onto the floor. |
| **Danger Zone → Reset Save** | Start session B clean. |
| ~~**Time Skip → Advance Days**~~ | **Do not use during the playtest.** It advances `GameClock` directly, not the day loop — no floor sim, no sales, no gate progress. It is not "playing days fast." |

To go faster inside a day, use the **floor speed control** (up to 4×) or **skip to close** —
those run the real sim.

---

## 2. Session A — a fresh Tier 1 career, 5 days

This is the main event. Everything else is secondary.

**Starting conditions (so you know what's intentional):** $50,000 cash, **three seed cars**
(1 SUV, 1 truck, 1 sedan — recon-complete, priced at market retail, sellable day one),
**an empty roster**, Tier 1. A Tier 1 lot holds **six cars**, so the seed already occupies
half of it.

### Day 0 — the managerial window, before you open the floor

1. Main Menu → **New Game** → name the slot → name your character, pick a backstory → Begin.
2. Sit on **Home** for a minute before doing anything. *Do you know what you're supposed to
   do next?* Answer honestly — this is the onboarding probe (F1), and "obviously, open the
   floor" is a fine answer if that's what you felt.
3. **People → Hiring** → hire **exactly one salesperson**. Nothing else. (You will hire a
   second on Day 3; the contrast is the measurement.) Read the **signing fee** and the
   **daily wage** on each applicant before you pick — hiring costs money twice now.
4. **People**, top of the tab: note your **daily payroll** now that somebody is on it.
5. **Operations → Lot.** Look at the stock and the spaces line. **Don't reprice anything
   yet** — the seed asks are the baseline.
6. **Operations → Prep:** leave **Hours of Operation** at 8 hrs (9–5). That's the baseline
   the Day 1 length question is measured against.
7. Tap **Open Floor →**.

Watch: whether the two prices on an applicant (fee today, wage every day) gave you anything
to weigh, or whether you just took the highest grade.

### Day 1 — watch it

Run the first day at **1× the whole way** even though it's slow. You're calibrating your
sense of the day's length and density before you start skipping.

Watch: how often a customer arrives, how often anything *happens*, how many toasts you get,
whether the floor ever feels dead. When it closes, read the **Reveal** feed all the way
through before dismissing it.

### Day 2 — buy something

**Operations → Lot → Go to the Auction.** Buy one or two cars (try the pre-purchase
inspection on one, skip it on the other). Back on the Lot, read the spaces line at the top —
*"N of 6 spaces taken"*. Then play the day at 2×.

Watch: whether the auction feels like a real decision or a menu, whether you had any basis
for choosing what to buy, and whether the number of spaces left changed what you bought.

### Day 3 — the second hire

Before opening: **People → Hiring** → hire a **second salesperson**, then read the daily
payroll line at the top of the tab. Play the day at 2×.

Watch: **did the day visibly change?** More customers worked, fewer walks, more gross? This
is acceptance criterion "capacity bottleneck felt; first hire obviously worth it" — if you
can't tell the difference, say so plainly, that's the finding. Second watch: with a signing
fee and a second wage in front of you, was the hire a real decision or an obvious yes?

### Day 4 — the unit that won't move

**Operations → Lot.** Pick your oldest unsold unit, tap **Tune ›** and **cut its ask**; pick
another and **raise it**. On the oldest unit's card, read the **Wholesale $** figure — that's
what a wholesale buyer would pay for it today. **Don't take it yet.** Note all three numbers
in a flag before you open.

Then open **People** and check whether anyone is asking for a raise or has an offer from a
rival. Answer it if so — neither one comes looking for you; both wait on the person's card.

Play at 2×. Watch: did either price move do anything you could see, that day or the next? And
was it clear what the wholesale figure was offering you?

### Day 5 — read the room

Play straight through. Then, before quitting: Home's **Market** panel is a *glance* that
routes — tap it and read the **Growth** tab top-to-bottom:

- **Demand Console** (demand by vehicle type, who's been walking in, your coverage gap, and
  the campaign lever)
- **Market Report** (the weekly column — only appears if a Monday boundary has passed)
- **Industry Wire** (the headline ticker, with its Confirmed/Rumor badges and the "What
  you're not reading" footer)
- **Build Out** and **This Month** (what's standing, and how far you are from the next tier)

Watch: does any of it change what you'd do tomorrow? A readout you enjoy but never act on is
a different verdict than one you skip.

Last thing: if the unit you cut on Day 4 still hasn't sold, **Operations → Lot → Wholesale**
it, and read the confirmation sheet before you commit. Watch: was taking the loss a decision
you thought about, or just a button?

---

## 3. Session B — Tier 2, 3 days

Main Menu → **Start at Tier 2** (dev fixture). Play 3 days. There is **no Tier 3 fixture** —
T3 is unreachable under the current un-tuned gate thresholds, which is a known C2 item, not
a bug to report.

Probes, one per day:

1. **People → Your Team**, then **People → Delegation** ("What your managers run"). Read the
   roster's department panels, the desks-filled counts and the **daily payroll at Tier 2
   scale**; hire a used car manager if you don't have one. Does it make clear what the
   manager is now doing *for* you (advising vs acting)? And does payroll at this size read as
   a cost you're managing, or just a number on a card?
2. **Growth → Industry Wire → "What you're not reading" → Subscribe** to the **auction data
   feed** ($45/day) and/or **competitor price tracking** ($30/day). Play a day, then read the
   wire again. Did you get anything worth $45? (Known: the paid lanes are quiet unless you're
   actively trading — see §8.)
3. **Service, and who's asking.** Hire a service advisor (People → Hiring → the Service
   panel), open **Operations → Service**, set a pricing posture. Does the department read as
   a second business or as a settings page? Before you open, do a full round of the roster —
   a raise ask and a rival's offer both sit on a person's card and neither interrupts you.
   Did you find one by looking, or only when somebody left? Afterwards, read **Growth → Build
   Out** and **This Month**: do you know what you'd have to do to reach Tier 3?

If a **month close** lands during either session, read the interstitial and the gate strip:
do you know how far you are from the next tier, and what to do about it?

---

## 4. What's already known-dark — don't bother reporting these

- **Tier 3 dev fixture** doesn't exist; hero art exists only for Tier 1 (#251).
- **Every Build Out row reads "Built out to the tier limit"** until you tier up. A store
  starts at its tier's ceilings, so room to build only opens after a promotion — the surface
  isn't broken and the buttons aren't dead.
- **The Tier 2 fixture holds a Used Car Manager in a desk that tier doesn't open**, so its
  slot board reads *"1 of 0"*. Stale fixture state, displayed honestly; unreachable in real
  play.
- Every number in the game is a **first-pass placeholder** — the C2 calibration campaign
  (#286) is a whole phase of its own. Report *felt* wrongness ("nothing ever sells"), not
  suspected bad constants.

---

## 5. The finance mix — captured for you

Two of #74's acceptance criteria are about the **finance mix**, and the UI now shows only the
coarse half of it: Finance splits the period's gross into **Cash** and **Financed**, and Deal
History records each sale as *"Sold a unit (cash/financed)"*. **No screen shows a deal's down
payment or the customer's credit tier**; and when a subprime buyer is blocked by the LTV
ceiling on an overpriced unit, the vehicle is simply filtered out at pick time — so it
surfaces as a generic *"wanted something you didn't have. Walked."*, indistinguishable from
an empty-shelf walk.

**That gap is itself a round-1 finding** and still becomes a follow-on issue — a finance-mix
surface plus a distinct credit-blocked walk reason. What #332 changed is that you no longer
have to hand-transcribe around it: the playtest log auto-captures every `deal:closed` with
its full structure (method, down, loan, term, APR, front/back gross, days in inventory) and
every walk-off with its **named** reason, and the export computes the cash-vs-finance split
and the average down for you.

So there is nothing to jot down here. Just play; the export answers "does the split look
like a real used-car lot" and "do heavy-down deals show up at a believable rate" with the
real numbers rather than a ten-deal memory sample.

---

## 6. Observation sheet

Answer in a sentence each. Paste them back to me, or just talk through them.

**The day itself**
1. How long did a day *feel* at 1×? Too long, too short, right?
2. Was there ever a stretch where nothing happened and you wanted to skip? When?
3. Did you look forward to the Reveal at day-end, or dismiss it?
4. Were the walk-off lines informative — did you learn *why* you lost a sale?

**Decisions**
5. Which decision in the whole loop felt like it mattered most?
6. Which one felt like busywork?
7. Did you ever want to do something the game wouldn't let you do?
8. Between Day 2 and Day 3 (one salesperson → two), was the difference obvious?
9. Did payroll ever change a decision — a hire you didn't make, someone you thought about
   letting go, a raise you refused?
10. Did the lot's six spaces ever bind? Did that read as a constraint you planned around, or
    as a wall you hit?

**Information**
11. On Day 5, did the Growth tab change what you'd do next — the demand console, the market
    report, the wire, the gate board? Which of them earned its space?
12. At any point, did you not understand a number or a label on screen? Which?

**The verdict**
13. After 8 days total: would you play a 9th? Why or why not?
14. **Proceed / adjust the loop / rethink the loop** — pick one.

---

## 7. What happens next (the triage protocol)

I take your raw observations and sort them — you don't:

- **Class A — broken or logically conflicting** ("every customer walked", "cash never went
  down"). Fixed *first*; you can't judge feel on a degenerate loop. If the root cause is a
  miscalibrated number → data fix, stays in #74. If it's a genuine code/logic defect → out of
  #74, filed as its own issue.
- **Class B — works but flat** ("fine, but I didn't care"). That's real calibration: iterative
  tunable nudges, one batched change set per cycle, you replay, we repeat.

Never scattershot; one batch, one replay, one report. **All tuned values land in a single
calibration commit** and #74 closes with your recorded verdict.

**The knobs I can turn without touching code** (#74's stated tunable surface, all present):
- `data/tunables.json` — ticks per day, `renderLoop.baseTickIntervalMs`, arrival-rate curves,
  per-gate tick cost, exception rates, `reveal.drama.*` weights
- `data/visit-archetypes.json` — `payment.cashProbability`, `payment.cashSpendFraction`,
  `payment.downPaymentBehavior` per archetype
- `data/credit-tiers.json` — `ptiCap`, `ltvCeiling`, `minDownPct` per tier
- `data/staff-pay.json` — the wage book per role/grade, `hireFeeMultiple`, the raise and
  rival-offer rates (new in C1, never yet tuned against a played career)
- `data/facility.json` — per-tier ceilings, block size, unit cost and build days
- adjacent, in practice: `data/sales-process.json`, `data/customer-tunables.json`,
  `data/tier-gate.json`, `data/staff-slots.json`

---

## 8. Standing notes carried into this round

- The balance harness bankrupts a competent bot before T2. That is **modeled and expected**
  pre-#286, not a regression — don't be alarmed if a career gets tight.
- The paid intel lanes (`auction_data`, `competitor_tracking`) only have much to say when
  you're actively trading — block reports need your own transactions and competitor tracking
  needs rivals repricing. Their felt value scales with how busy you are (flagged for #286).
