# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## What this project is

A premium, single-player, mobile dealership-business simulation. Day-cycle, decision-driven, sim-medium realism (real F&I products, real loan mechanics, real industry KPIs). Solo dev, time-constrained. Niche audience over big revenue.

**Authoritative spec:** GitHub issue #1 (`gh issue view 1`) is the source of truth. For day-to-day work, prefer `docs/spec-condensed.md` — it distills the load-bearing facts. Re-read issue #1 only when a question isn't answered by the condensed doc or when #1 has just changed.

**Execution order:** chronological by issue number with dependencies respected. Run `gh issue list --state open` and pick the lowest-numbered open issue whose deps are met. No tracker issues, no design-record meta-issues — work directly off the issue queue.

**Issue lookups:** use `gh issue view <N>` for a single issue and `gh issue list --state open` for the queue. The gitignored `ISSUES.md` dump is ~1.3k lines and should NOT be Read whole.

**Cross-agent handoff:** follow `docs/agent-handoff.md`. Do not rely on private agent memory for load-bearing context; put task intent, acceptance criteria, implementation decisions, and closeout notes in GitHub issues and repo docs.

**Known setup/doc work:** if you create a coherent setup, documentation, recipe, template, or handoff change for future agents, commit that known-intent work as its own narrow commit before ending unless the user explicitly says not to commit. Leave unrelated pre-existing implementation edits unstaged and call them out separately.

**Context discipline:** Read a module's `AGENTS.md` before its code; prefer `Grep` + ranged `Read` over whole-file reads. Treat design-record issues (#95/#99/#107) as locked — don't re-grill or re-derive them.

**Before implementing a slice, do NOT cold-read 10+ files into this context to relearn where things live.** That exploration is repeated, stable knowledge and burns the main context (a recent slice spent ~90k tokens this way before writing any code). Instead:
- **Generation seams** (a value generated per customer/visit from `data/`, injected through a factory, composed in `createWorld`) follow a fixed recipe — read `docs/generation-seam-recipe.md`, not the prior slices' source. Most remaining MarketEconomy slices (#155–#181) are generation seams.
- **Demand-shaping slices** (parent #197, including #211/#212 and descendants) follow `docs/demand-shaping-recipe.md`. Read the issue body, that recipe, `src/game/DemandShaper/CLAUDE.md`, and the one target test/component before source exploration.
- **For anything else** that needs broad multi-file orientation, delegate it to an `Explore` subagent ("where does X live, how was Y wired, what's the shape of Z"). The fan-out reads stay in the subagent's context; you get back only the conclusions + `file:line` pointers. This is the default, not a fallback.
- When you learn a reusable wiring pattern that isn't yet written down, capture it as a short `docs/*-recipe.md` so the next slice reads one doc instead of re-deriving it.

## Non-negotiable engineering principle

**All code must be built for long-term modular flexibility.** This is a multi-year project; architectural shortcuts will be rejected at review.

- Deep modules, narrow interfaces.
- Game logic is fully separable from UI. UI renders state and dispatches actions — it never reaches into game-logic internals.
- Cross-module communication goes through the `EventBus`. No module calls another's internals.
- **Module boundary convention:** every module lives in its own directory under `src/game/<ModuleName>/` and exposes its public surface only through `index.ts` (a barrel). Consumers import from `'@/game/<ModuleName>'` (or the relative path to the directory), never from a file inside it. Anything not re-exported from `index.ts` is private. No lint rule enforces this in v1 — it is a review-time convention.
- All tunables (OEM tables, customer archetypes, F&I products, tier definitions, balance numbers) live in versioned data files under `data/`. No magic numbers in code.
- Subsystems whose v1 implementation is intentionally simple (static OEMs, static competitors, regulatory meter) are exposed via interfaces so v2 replacements drop in without changing consumers.
- Small commits, each verifiable. No multi-day branches without intermediate landings.

## Stack

- React Native + Expo, TypeScript
- Local SQLite via `expo-sqlite` (accessed only through the `SaveStore` module)
- No backend in v1; save layer designed for future cloud-sync bolt-on
- GitHub Actions for CI (typecheck + tests on push)
- EAS Build for iOS/Android binaries

## Module map (deep modules, communicating via EventBus)

Game logic lives under `src/game/<Module>/`. Each module directory contains a `AGENTS.md` describing its public surface, events emitted/consumed, and tunable data files — **read the per-module doc before touching that module** rather than re-deriving from `index.ts`.

Original 12 (issue #1): `GameClock`, `CustomerPool`, `DepartmentQueue`, `StaffOrg`, `Inventory`, `DealEngine`, `Economy`, `Reputation`, `CompetitorMarket`, `CareerProgression`, `SaveStore`, `EventBus`.

Added during v1 slice: `CapacityManager`, `FollowUpPool`, `NPC`, `ServiceQueue`, `ServiceDispatch`, `StaffDispatch`, `StaffMorale`. Plus `data/` (JSON loader + tunables schema; not an EventBus participant).

UI (planned, not yet implemented): `HomeView`, `DepartmentScreens`, `SalesWorkspace`, `FollowupView`, `KPIDashboard`, `NarrativeBeat`, `CharacterCreation`, `EndCard`.

The canonical event catalog is `src/game/EventBus/events.ts` — every event name, payload, and ordering note lives there. See issue #1 for the macro-design rationale.

## Testing

- Every game-logic module gets isolation tests on its public interface. Test external behavior, never implementation details.
- UI gets smoke tests only (renders without crashing).
- No snapshot tests in v1.

## Common commands

- `npm run dev` — start Expo dev server (alias for `expo start`)
- `npm run ios` / `npm run android` / `npm run web` — launch on a specific target
- `npm test` — Jest (jest-expo preset). Test files live in `tests/` or co-located as `*.test.ts(x)` under `src/`
- `npm run typecheck` — `tsc --noEmit`, strict mode
- `npm run build -- --profile <development|preview|production> --platform <ios|android>` — EAS Build. First run requires `npx eas-cli login` and `npx eas-cli init` to bind a project ID.

CI runs `typecheck` + `test` on every push (`.github/workflows/ci.yml`).

## v1 scope reminder

Tier 1-3 vertical slice (gravel yard → paved lot → small showroom). Out-of-scope items are listed explicitly in issue #1 — consult before adding anything that isn't already in scope.
