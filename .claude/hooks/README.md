# Agent hooks (#335)

Rules this repo calls non-negotiable used to be prose an agent had to remember. Prose in
`CLAUDE.md` costs context every session and is only as good as the agent's attention. These
hooks fire every time, cost zero context, and run outside the model's control.

Registered in `.claude/settings.json` (committed, so every session gets the same ones).

| Hook | Event | What it does |
|---|---|---|
| `pre-module-boundary.mjs` | `PreToolUse` Edit/Write | **Blocks** a write importing past another module's `index.ts` barrel. |
| `pre-save-envelope.mjs` | `PreToolUse` Edit/Write | **Interrupts once per session** when the world-snapshot envelope or a fixture is touched, with the full re-stamp ritual. |
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

## The module-boundary allow-list

`module-boundary-allow.json` enumerates the reach-ins that already exist. Without it the first
rewrite of `src/createWorld.ts` would be blocked by debt it didn't create, with no way forward
that isn't a worse decision made under pressure. With it, **new** debt is blocked and the old
debt is a countable list instead of an unknown.

Today that list is 81 reach-ins across 71 files, and it is almost entirely two classes:

- **`../data/loadJson` → `parseData`** (~35 files). `src/game/data/index.ts` *already exports
  `parseData`*, so every one of these is a one-line fix with no design question attached.
- **`../NPC/Rng` → `createRng` / `deriveSeed`** (~40 files). `src/game/NPC/index.ts` does **not**
  export the RNG. Fixing these means deciding whether seeded RNG is part of NPC's public surface
  or belongs somewhere else — a real public-surface call, not a rename.

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
