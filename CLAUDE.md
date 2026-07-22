# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

A premium, single-player, mobile dealership-business simulation. Day-cycle, decision-driven, sim-medium realism (real F&I products, real loan mechanics, real industry KPIs). Solo dev, time-constrained. Niche audience over big revenue.

**Authoritative spec:** GitHub issue #1 (`gh issue view 1`) is the source of truth. For day-to-day work, prefer `docs/spec-condensed.md` — it distills the load-bearing facts. Re-read issue #1 only when a question isn't answered by the condensed doc or when #1 has just changed.

**Execution order:** chronological by issue number with dependencies respected. Run `gh issue list --state open` and pick the lowest-numbered open issue whose deps are met. No tracker issues, no design-record meta-issues — work directly off the issue queue.

**Issue lookups:** use `gh issue view <N>` for a single issue and `gh issue list --state open` for the queue. The gitignored `ISSUES.md` dump is ~1.3k lines and should NOT be Read whole.

**Cross-agent handoff:** follow `docs/agent-handoff.md`. Do not rely on private agent memory for load-bearing context; put task intent, acceptance criteria, implementation decisions, and closeout notes in GitHub issues and repo docs.

**Context discipline:** Read a module's `CLAUDE.md` before its code; prefer `Grep` + ranged `Read` over whole-file reads. Treat design-record issues (#95/#99/#107) as locked — don't re-grill or re-derive them.

**Before implementing a slice, do NOT cold-read 10+ files into this context to relearn where things live.** That exploration is repeated, stable knowledge and burns the main context (a recent slice spent ~90k tokens this way before writing any code). Instead:
- **Generation seams** (a value generated per customer/visit from `data/`, injected through a factory, composed in `createWorld`) follow a fixed recipe — read `docs/generation-seam-recipe.md`, not the prior slices' source. Most remaining MarketEconomy slices (#155–#181) are generation seams.
- **For anything else** that needs broad multi-file orientation, delegate it to an `Explore` subagent ("where does X live, how was Y wired, what's the shape of Z"). The fan-out reads stay in the subagent's context; you get back only the conclusions + `file:line` pointers. This is the default, not a fallback.
- When you learn a reusable wiring pattern that isn't yet written down, capture it as a short `docs/*-recipe.md` so the next slice reads one doc instead of re-deriving it.

## Non-negotiable engineering principle

**All code must be built for long-term modular flexibility.** This is a multi-year project; architectural shortcuts will be rejected at review.

- Deep modules, narrow interfaces.
- Game logic is fully separable from UI. UI renders state and dispatches actions — it never reaches into game-logic internals.
- Cross-module communication goes through the `EventBus`. No module calls another's internals.
- **Module boundary convention:** every module lives in its own directory under `src/game/<ModuleName>/` and exposes its public surface only through `index.ts` (a barrel). Consumers import from `'@/game/<ModuleName>'` (or the relative path to the directory), never from a file inside it. Anything not re-exported from `index.ts` is private. No lint rule enforces this — it is a review-time convention.
- All tunables (OEM tables, customer archetypes, F&I products, tier definitions, balance numbers) live in versioned data files under `data/`. No magic numbers in code.
- Subsystems whose current implementation is intentionally simple (static OEMs, static competitors, regulatory meter) are exposed via interfaces so richer replacements drop in later without changing consumers.
- Small commits, each verifiable. No multi-day branches without intermediate landings.

## Stack

- React Native + Expo, TypeScript
- Local SQLite via `expo-sqlite` (accessed only through the `SaveStore` module)
- No backend currently; save layer designed for future cloud-sync bolt-on
- GitHub Actions for CI (typecheck + tests on push)
- EAS Build for iOS/Android binaries

## Module map (deep modules, communicating via EventBus)

Game logic lives under `src/game/<Module>/`. Each module directory contains a `CLAUDE.md` describing its public surface, events emitted/consumed, and tunable data files — **read the per-module doc before touching that module** rather than re-deriving from `index.ts`.

Original 12 (issue #1): `GameClock`, `CustomerPool`, `DepartmentQueue`, `StaffOrg`, `Inventory`, `DealEngine`, `Economy`, `Reputation`, `CompetitorMarket`, `CareerProgression`, `SaveStore`, `EventBus`.

Added during implementation: `CapacityManager`, `FollowUpPool`, `NPC`, `ServiceQueue`, `ServiceDispatch`, `StaffDispatch`, `StaffMorale`, `DepartmentLine` (the shared department assembly-line backbone — Service and Body Shop plug their recipe packages into it; #311, see `docs/planning/shared-department-structure.md`), `BodyShopQueue` (the Tier-3 mirror of `ServiceQueue` — the Body Shop's gate on the shared line; #312), `Records` (the career's high-water marks + the `records:broken` announcement the Reveal feed crowns; #329), `MarketIntel` (what the player is allowed to *know* — the wire's access lanes, opened by a paid data subscription or a manager on the desk; #178). Plus `data/` (JSON loader + tunables schema; not an EventBus participant).

The Service department is composed as a labeled package in `src/serviceDepartment.ts` (`createServiceDepartment`) — the bundle of the five Service modules + `InstalledBase` + `PartsInventory` that plugs into `DepartmentLine` through the narrow seam (enriched intake + pricing read). The Body Shop is its Tier-3 mirror in `src/bodyShopDepartment.ts` (`createBodyShopDepartment`, #314): `CollisionStream` → `BodyShopQueue` → the **shared department-dispatch engine** (now hosted in `ServiceDispatch` as `createDeptFloorDrain` driven by a `DeptDispatchProfile`), with insurance/retail channel-posture pricing and the shared `PartsInventory` (its four collision categories). Both departments emit parallel `service:*`/`bodyshop:*` event families bound to that one engine.

UI (planned, not yet implemented): `HomeView`, `DepartmentScreens`, `SalesWorkspace`, `FollowupView`, `KPIDashboard`, `NarrativeBeat`, `CharacterCreation`, `EndCard`.

The canonical event catalog is `src/game/EventBus/events.ts` — every event name, payload, and ordering note lives there. See issue #1 for the macro-design rationale.

## Testing

- Every game-logic module gets isolation tests on its public interface. Test external behavior, never implementation details.
- UI gets smoke tests only (renders without crashing).
- No snapshot tests.

## Common commands

- `npm run dev` — start Expo dev server (alias for `expo start`)
- `npm run ios` / `npm run android` / `npm run web` — launch on a specific target
- `npm test` — Jest (jest-expo preset). Test files live in `tests/` or co-located as `*.test.ts(x)` under `src/`
- `npm run typecheck` — `tsc --noEmit`, strict mode
- `npm run build -- --profile <development|preview|production> --platform <ios|android>` — EAS Build. First run requires `npx eas-cli login` and `npx eas-cli init` to bind a project ID.

CI runs `typecheck` + `test` on every push (`.github/workflows/ci.yml`).

## Tier build frontier

The full tier ladder is the product (gravel yard → paved lot → showroom → franchise → group). The current implementation frontier is Tiers 1-3; higher tiers are **not-yet-built, not cut**. Items genuinely outside the design (multiplayer, cloud save, RPG skill layer, etc.) are listed in issue #1 — consult before adding one of those.
