---
name: decide
description: Prepare ONE pending director decision (a GRILL or ADJUDICATE gate in docs/planning/build-state.md's phase table) so the user only has to rule, not re-derive. Loads the gate's context, decides every internal fork itself, presents each player-facing fork with options + evidence + a recommendation, and records the ruling so the gate never reopens. Use when the user types /decide, or when /next selects a DECIDE unit.
---

# /decide — one gate, prepared to the point of a ruling

## What this is

A **preparation** unit, never a deciding one. The thinking is the user's job; the reloading
and the re-deriving are not. `/decide` pays the context cost so the user pays only the
judgment cost.

Six of the remaining phases are blocked on a human ruling. That is the same pathology
#332/#333 fixed for the playtest: the gate is not hard, it is *expensive to start*. This
removes the activation cost.

## Contract

Every invocation ends with **exactly one gate recorded** — a ruling written into the owning
planning doc (or a design-record issue), the phase table flipped, committed and pushed.
Never analysis alone, never a summary of the options left in chat.

If the user defers a fork, that is a recorded outcome too: written down as an **open fork**
with the exact input that would resolve it. Deferral is a state in the doc, not a state in
the conversation.

One gate per invocation. Never chain a second "while you're here."

## Procedure

1. **Select the gate.** If the user named one (`/decide C1`, `/decide staff-teeth`), that is
   it. Otherwise take the lowest pending phase in `docs/planning/build-state.md`'s table
   marked GRILL / ADJUDICATE / DECIDE / RESUME. Do not duplicate `/next`'s unit-selection
   logic beyond this — when `/next` routes here it has already named the phase.
2. **Load, don't re-derive.** `gates.md` (next to this file) maps every pending gate to its
   section of `docs/planning/path-to-finished-product.md`, the planning docs that own it, and
   the locked inputs it sits on. Read those. Anything tagged **LOCKED** or **FILED** is
   settled input — read it, never reopen it (root CLAUDE.md; `tier-progression-canon`).
   If the gate's real context turns out to be wider than `gates.md` says, fix `gates.md` in
   the same commit.
3. **Triage every open question into two piles.**
   - **Internal** — which module owns it, where logic parks, data shape, event naming, file
     layout, test seams. **You decide these and state the call in one line.** They never
     reach the user (`feedback-hitl-single-decision`).
   - **Player-facing** — what the player sees, chooses, or feels; anything that changes the
     shape of a decision the player makes. These are the user's, and only these.
   Report the internal pile as a short list of calls made, so the user can veto any of them
   in passing without being asked to adjudicate them.
4. **Present ONE player-facing fork at a time.** For each:
   - the question in plain language (no jargon, no temperature words —
     `feedback-no-vague-temperature-labels`);
   - the real options, each with what it costs to build and what it implies for the player —
     never a "simple version" and a "real version"; every option must be a complete mechanic
     (`feedback-no-half-assed-solutions`, `feedback-build-complete-product`);
   - the repo evidence bearing on it with `file:line`;
   - **a recommendation with its reasoning.** The user rules; they do not derive.
   Wait for the ruling before moving to the next fork.
5. **Label agent-proposed options.** Any option you introduced that the user has not
   previously agreed to is marked `[agent-proposed]` in both the presentation and the record.
   It is never written into a record as though it were already settled
   (`feedback-no-smuggled-mechanics`).
6. **Record the outcome** in the gate's owning doc per `gates.md` — the ruling, its reasoning
   in the user's terms, the date, and any fork left open with what would unblock it. Replace
   the section's `[NEW]` / ungrilled marker with the ruling's status. Then flip the
   build-state.md phase-table cell (`GRILL` → `LOCKED <date>` or → the follow-up unit) and
   append a log entry per `/next` step 5, including the log-roll rule.
7. **Commit to main and push.** Report what was ruled, ending with one state line:
   `Gate: phase N (<name>) — recorded in <doc>; next /next will <SLICE phase N | BUILD #X>.`

## Hard rules

- **Never decide a player-facing fork for the user**, and never treat silence or a shrug as
  a ruling.
- **Never re-grill a LOCKED or FILED design.** If a gate seems to require reopening one, that
  is a finding to raise in one sentence, not a licence to reopen.
- Use `/grill-me` only for gates `gates.md` marks **ungrilled** (today: C1 staff-teeth). An
  ADJUDICATE gate is a short set of forks, not a grill — do not run a grill on one.
- A ruling that unblocks a phase does **not** entitle this session to start building it. The
  artifact is the recorded decision; the build is the next `/next`.
- Token-light: `gates.md` + the named docs + targeted `Grep`/ranged `Read` for evidence.
  Delegate broad orientation to an `Explore` subagent.
