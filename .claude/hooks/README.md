# Agent hooks (#335)

Rules this repo calls non-negotiable used to be prose an agent had to remember. Prose in
`CLAUDE.md` costs context every session and is only as good as the agent's attention. These
hooks fire every time, cost zero context, and run outside the model's control.

Registered in `.claude/settings.json` (committed, so every session gets the same ones).

| Hook | Event | What it does |
|---|---|---|
| `pre-module-boundary.mjs` | `PreToolUse` Edit/Write | **Blocks** a write importing past another module's `index.ts` barrel. |
| `pre-save-envelope.mjs` | `PreToolUse` Edit/Write | **Interrupts once per session** when the world-snapshot envelope or a fixture is touched, with the full re-stamp ritual. |
| `pre-issue-criteria.mjs` | `PreToolUse` Bash/PowerShell | **Blocks** a `gh issue create` whose body has no `## Acceptance criteria (EARS)` section, or whose criteria are prose (#337). |
| `post-typecheck.mjs` | `PostToolUse` Edit/Write | Typechecks after any `src/**` edit, and records the touched path. |
| `post-record-command.mjs` | `PostToolUse` Bash/PowerShell | Records that `npm test` / `npm run typecheck` ran. |
| `stop-session-hygiene.mjs` | `Stop` | If `src/` or `data/` changed but the suite never ran or `build-state.md` was never updated, says so. Once. |

Every hook is a Node script (`.mjs`) rather than a shell script: the repo is driven from Git
Bash, cmd.exe and PowerShell, and one language that works in all three beats three copies.
They read the hook payload on stdin and answer with an exit code — `0` proceed, `2` block with
the reason on stderr.

## Running them yourself

```bash
npm run hooks:test
```

Drives each hook with a synthetic payload and asserts the exit code, **including the negative
cases** — a legal barrel import must not be blocked, a broken file must actually be reported.
That last one caught a real silent no-op while this was being built: `npx.cmd` cannot be
spawned without `shell: true` on Node 24 for Windows, so the typecheck hook was exiting 0 on
every file, broken or not. CI runs this after the suite for exactly that reason.

```bash
npm run hooks:scan
```

Sweeps the repo with the boundary rule and reports every reach-in not in the allow-list.

## The EARS check

`pre-issue-criteria.mjs` reads the body out of `--body`, `--body-file` or a heredoc, finds the
acceptance-criteria section, and requires every **top-level** bullet in it to be one of the
five EARS patterns (indented sub-bullets are free — they carry the test mapping). The
convention and its worked examples live in `docs/agent-handoff.md`; the hook points at that
doc rather than restating it.

Two scoping decisions worth knowing:

- **New issues only.** `gh issue edit` is never judged. Issues filed before the convention
  keep their text — rewriting them would change agreed scope silently.
- **Only a create the shell will actually run.** The words appear in plenty of commands that
  file nothing (a grep, a script body, a commit message describing this hook), so the match
  must sit at the start of a command or right after a separator — and a backtick is not a
  separator, because markdown inline code is far commoner than legacy `` `cmd` ``
  substitution. Every one of those cases is in the selftest; the commit-message one is there
  because it blocked this hook's own commit.

## The module-boundary allow-list

`module-boundary-allow.json` enumerates the reach-ins that already exist. Without it the first
rewrite of `src/createWorld.ts` would be blocked by debt it didn't create, with no way forward
that isn't a worse decision made under pressure. With it, **new** debt is blocked and the old
debt is a countable list instead of an unknown.

Today that list is **22 reach-ins across 13 files**. Both of the classes that used to dominate
it are gone:

- **`../data/loadJson` → `parseData`** (25 files) — cleared by #341. The clerical half:
  `src/game/data/index.ts` already exported `parseData`, so every one was a one-line import
  rewrite with no design question attached.
- **`../NPC/Rng` → `createRng` / `deriveSeed`** (~34 files) — cleared by #342, which carried a
  real public-surface call. The answer was **neither module's private surface**: seeded RNG got
  its own module at `src/game/Rng/`, because re-exporting it from NPC would have made
  determinism part of NPC's public promise. See `src/game/Rng/CLAUDE.md`.

What remains is the genuinely heterogeneous residue — one-off reach-ins into `NPC/schemas/*`,
`NPC/factories/*`, `NPC/Staff`, `NPC/StaffTaxonomy`, `NPC/StaffArchetypes`, `StaffOrg/types`,
`Inventory/auctionGenerator`, `CompetitorMarket/*` and `EndCard/types`. There is no third bulk
class left; each of these is its own public-surface question, and most sit in test files that
assert against a module's internal schema. So the allow-list file **survives** — it is now a
short list of individual decisions rather than a backlog.

Regenerate after a deliberate cleanup:

```bash
node .claude/hooks/scan-module-boundary.mjs --write
```

Shrinking the file is always an improvement. Growing it should be a decision someone made on
purpose.

## Per-session scratch

`.claude/.session-state/` (gitignored) holds one small JSON per session — which files were
touched, whether the suite ran, whether the envelope reminder already fired — plus the
incremental `tsbuildinfo` the typecheck hook reuses (~6.5s cold, ~3.4s warm). Nothing there is
load-bearing; losing it only makes the `Stop` hook less informed.
