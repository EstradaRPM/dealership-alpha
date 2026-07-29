# Cross-Agent Handoff

This repo is designed for iterative work by Codex, Claude Code, and future AI agents. Private agent memory is not a source of truth. Anything load-bearing for future implementation must live in GitHub issue history or committed repo docs.

## Where Context Belongs

- Put task intent, dependencies, blockers, acceptance criteria, and out-of-scope notes in the GitHub issue.
- Put implementation decisions that future work depends on in repo docs: the relevant module `CLAUDE.md` / `AGENTS.md`, an ADR, `docs/spec-condensed.md`, or a short `docs/*-recipe.md`.
- Keep reusable wiring patterns in small recipe docs so later slices read one durable source instead of re-deriving prior code. Existing recipes include `docs/generation-seam-recipe.md` (per-customer generate+wire) and `docs/save-migration-recipe.md` (worldSnapshot versioning — read before changing any persisted state).
- Keep module public APIs narrow and documented through the module barrel plus the module agent doc.

## Acceptance criteria (EARS)

Every filed slice carries an `## Acceptance criteria (EARS)` section, and every criterion in
it is one of five sentence patterns. On an AFK slice the issue body is the *entire* brief —
the implementing session reads the issue, the recipes, and the touched module's `CLAUDE.md`,
and nothing else. Prose criteria leave the trigger and the required response implicit, which
is where a slice quietly builds the adjacent thing instead of the asked one.

| Pattern | Shape |
| --- | --- |
| Ubiquitous | *The system shall \<response\>.* |
| Event-driven | *When \<trigger\>, the system shall \<response\>.* |
| State-driven | *While \<state\>, the system shall \<response\>.* |
| Unwanted behavior | *If \<condition\>, then the system shall \<response\>.* |
| Optional feature | *Where \<feature is present\>, the system shall \<response\>.* |

Two rules go with the patterns:

- **Each criterion maps to at least one named test** that fails when the criterion is unmet.
  Name it in an indented sub-bullet. A criterion with no test is a wish.
- **The section holds criteria only.** Context, rationale and open questions go in `## Scope`
  or `## Notes`. Indented sub-bullets are free — they carry the test mapping and any detail.

### Worked example — a game-side slice (#329, Records)

```markdown
## Acceptance criteria (EARS)

- When `floor:day_complete` fires with a day gross above the standing mark, the system shall
  update `bestDayGross` and emit `records:broken`.
  - test: tests/Records.test.ts — "settles the day total on floor:day_complete using front + back"
- While a mark has never been set, `getMark(kind)` shall return null rather than zero.
  - test: tests/Records.test.ts — "starts with no marks set"
- If a day closes with no units, then the system shall crown nothing.
  - test: tests/Records.test.ts — "does not crown an empty day"
- Where a save predates the Records key, the system shall materialize
  `createDefaultRecordsSnapshot()` through the world-snapshot migration.
  - test: tests/worldSnapshot.test.ts — "migrates pre-#329 snapshots to an empty scoreboard"
```

Note what the patterns buy: the event name *is* the trigger, the null-vs-zero decision is
stated rather than left to the implementer, and the zero-unit divide-by-zero case is a
criterion instead of a bug someone finds later.

### Worked example — a harness slice (#335, the module-boundary hook)

```markdown
## Acceptance criteria (EARS)

- The hook shall read its payload from stdin and answer with an exit code — 0 proceed,
  2 block with the reason on stderr.
  - test: `npm run hooks:test` — every case asserts the exit code, negative cases included
- When a write introduces an import that reaches past another module's `index.ts`, the hook
  shall block the call and name the barrel to import from instead.
  - test: `npm run hooks:test` — "boundary: blocks a reach-in past another module barrel"
- While a reach-in is listed in `module-boundary-allow.json`, the hook shall allow it.
  - test: `npm run hooks:test` — "boundary: grandfathered reach-in is not blocked"
- If the edited file already carries older debt, then the hook shall judge only the text
  being introduced.
  - test: `npm run hooks:test` — "boundary: an Edit is judged on new_string only"
- Where the edited file lives under `.claude/`, the hook shall not judge it by the rule it
  implements.
  - test: `npm run hooks:test` — "boundary: the hooks tree is not judged by the rule it enforces"
```

### Enforcement

`.claude/hooks/pre-issue-criteria.mjs` blocks a `gh issue create` whose body has no
acceptance-criteria section, or whose criteria are prose. It judges **new** issues only:
issues filed before this convention keep their text, because rewriting them would change
agreed scope silently.

## Context Packets

For multi-issue epics, create or update a `docs/*-recipe.md` context packet.
The packet is the first read for future agents and should carry:

- parent issue / source-of-truth links
- startup protocol and expected read budget
- current module/interface shape
- composition-root, UI, persistence, and test seams
- known guardrails and traps
- files usually needed and files not to cold-read
- closeout fields the next agent needs

Prefer one precise packet over many scattered notes. If a future slice changes a
seam described by the packet, update the packet in that same slice.

## Issue Closeout

When closing an implementation issue, leave a short GitHub comment with:

- commit SHA
- what changed
- tests run
- follow-up issue(s), if any
- context packet updated: yes/no, with reason if no

If a slice changes a future dependency or invalidates issue text, update the affected issue or doc in the same closeout pass.

## Session Handoff

When handing work to another agent or future session, leave a compact handoff in
the issue or repo docs:

```text
Status:
Current branch/commit:
Dirty files:
Relevant context packet:
Seams touched:
Tests run:
Known blockers:
Next action:
```

Do not rely on private chat memory for any of these fields.

## Commit Known Setup Work

When an agent creates a coherent setup, documentation, recipe, template, or
handoff change intended to help future sessions, commit that known-intent work
as its own narrow commit before ending the session unless the user explicitly
says not to commit. Leave unrelated pre-existing implementation edits unstaged
and identify them separately. Do not leave known setup work mixed with unrelated
local changes.

## Agent Rules

- Treat GitHub issue bodies and committed docs as authoritative over private memory or prior chat context.
- If a useful decision exists only in chat or agent memory, copy it into the issue or repo before depending on it.
- If a module doc says a capability is "not yet" wired or persisted, update that doc in the same slice that makes it true.
- Prefer adding one precise note to the right durable place over adding broad summary docs.
- Before broad source exploration, check whether a `docs/*-recipe.md` packet exists for the epic or module.
- If no packet exists and the same wiring will be reused by future slices, create one instead of leaving the knowledge in chat.
