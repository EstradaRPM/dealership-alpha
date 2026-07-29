---
name: next
description: One-command session driver for the path-to-finished-product build order. Reads docs/planning/build-state.md, performs exactly ONE unit of work (implement the next issue, slice the current phase into issues, or resolve a pending decision/grill), lands a concrete result, updates state, and stops. Use when the user types /next, asks "what's next", or wants to continue the build.
---

# /next — one session, one unit, one concrete result

## Contract

Every invocation MUST end in exactly one of these artifacts:

1. **BUILD** — one issue implemented completely (the full mechanic, never a stub), verified
   (`npm run typecheck` + `npm test`, plus /verify when the change has a runtime surface),
   committed to main, pushed, issue closed.
2. **SLICE** — the current phase broken into filed GitHub issues via /to-issues, filed in
   build order so "lowest open issue" stays correct.
3. **DECIDE** — a pending adjudication or grill resolved with the user and recorded in a
   repo doc (planning doc or design-record issue), so it never needs re-deciding. Run via
   the /decide skill, which prepares the gate so the user only rules.

Never end with only analysis, a plan, or an open question. If genuinely blocked mid-unit,
land the largest verifiable sub-result, record the blocker in build-state.md, and say
exactly what input unblocks it.

## Procedure

1. Read `docs/planning/build-state.md` — current phase pointer, phase table, blockers, and
   the newest 3 log entries. That file is the whole session-start read; it stays short by
   design. Do NOT read `docs/planning/build-state-archive.md` here — open it only when a
   past slice's rationale actually needs recovering.
2. If the current phase's work is complete (its issues all closed, decisions resolved),
   advance the pointer in build-state.md. Advancing is bookkeeping, not the unit — continue.
3. Pick the unit for the current phase, first match wins:
   - Phase table marks a **decision or grill pending** → DECIDE. **Invoke /decide with the
     phase named** — it owns the gate's context index (`.claude/skills/decide/gates.md`), the
     internal-vs-player-facing fork triage, and where the ruling gets recorded. Do not
     re-derive any of that here. NEVER re-grill anything tagged LOCKED or FILED in
     path-to-finished-product.md.
   - **No open issue covers the phase's remaining work** → SLICE. Run /to-issues scoped to
     this phase only, pulling scope from the phase's section of
     `docs/planning/path-to-finished-product.md`.
   - Otherwise → BUILD the lowest-numbered open, deps-met issue belonging to the phase.
4. Execute the unit.
   - BUILD sessions do NOT read path-to-finished-product.md. Context = the issue itself,
     `docs/*-recipe.md`, and the touched module's `CLAUDE.md`. Delegate broad orientation
     to an Explore subagent per the root CLAUDE.md context-discipline rules.
   - A phase whose unit is HITL (e.g. the #74 playtest) → the unit is preparing and handing
     the user the playtest script; the artifact is the filed calibration notes/issue.
5. Update build-state.md: progress note, any new blocker, pointer if the phase closed.
   **Roll the log:** after appending the new entry at the top of `## Log`, move every entry
   beyond the newest 3 to the top of the `## Log` in `docs/planning/build-state-archive.md`
   — **text unchanged, never summarized**, newest first. The rationale in an old entry is
   the record of why a decision was made; it gets relocated, not compressed.
6. Report what landed, ending with exactly one state line:
   `State: phase N (<name>) — next /next will <BUILD #X | SLICE phase N | DECIDE Y>.`

## Hard rules

- **One unit per invocation.** Never chain a second issue "while you're here."
- Commit directly to main and push; close the finished issue in the same session
  (standing authorization — no branches, no PRs).
- Build the complete mechanic every time; build order is the only sequencing question.
- Keep the session token-light: targeted reads, recipes over source archaeology.
