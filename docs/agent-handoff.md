# Cross-Agent Handoff

This repo is designed for iterative work by Codex, Claude Code, and future AI agents. Private agent memory is not a source of truth. Anything load-bearing for future implementation must live in GitHub issue history or committed repo docs.

## Where Context Belongs

- Put task intent, dependencies, blockers, acceptance criteria, and out-of-scope notes in the GitHub issue.
- Put implementation decisions that future work depends on in repo docs: the relevant module `CLAUDE.md` / `AGENTS.md`, an ADR, `docs/spec-condensed.md`, or a short `docs/*-recipe.md`.
- Keep reusable wiring patterns in small recipe docs so later slices read one durable source instead of re-deriving prior code.
- Keep module public APIs narrow and documented through the module barrel plus the module agent doc.

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

## Agent Rules

- Treat GitHub issue bodies and committed docs as authoritative over private memory or prior chat context.
- If a useful decision exists only in chat or agent memory, copy it into the issue or repo before depending on it.
- If a module doc says a capability is "not yet" wired or persisted, update that doc in the same slice that makes it true.
- Prefer adding one precise note to the right durable place over adding broad summary docs.
- Before broad source exploration, check whether a `docs/*-recipe.md` packet exists for the epic or module.
- If no packet exists and the same wiring will be reused by future slices, create one instead of leaving the knowledge in chat.
