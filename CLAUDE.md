# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

A premium, single-player, mobile dealership-business simulation. Day-cycle, decision-driven, sim-medium realism (real F&I products, real loan mechanics, real industry KPIs). Solo dev, time-constrained. Niche audience over big revenue.

**Authoritative spec:** GitHub issue #1 (`gh issue view 1`). Read it before any non-trivial work — it captures every macro design decision and is the source of truth.

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

Game logic: `GameClock`, `CustomerPool`, `DepartmentQueue`, `StaffOrg`, `Inventory`, `DealEngine`, `Economy`, `Reputation`, `CompetitorMarket`, `CareerProgression`, `SaveStore`, `EventBus`.

UI: `HomeView`, `DepartmentScreens`, `SalesWorkspace`, `FollowupView`, `KPIDashboard`, `NarrativeBeat`, `CharacterCreation`, `EndCard`.

See issue #1 for module responsibilities.

## Testing

- All 12 game-logic modules get isolation tests on their public interface. Test external behavior, never implementation details.
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
