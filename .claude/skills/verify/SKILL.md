---
name: verify
description: How to runtime-verify this app. Read before attempting to "run" it — the autonomous surface is limited by a native dependency.
---

# Verifying dealership-alpha

**There is no autonomous headless runtime surface for the app UI.** Two hard blocks:

1. **`expo-sqlite` is a native module** (SaveStore → `src/game/SaveStore/sqliteDriver.ts`).
   The app boots through SaveStore, so it will not run on web without a SQLite shim.
2. **`react-native-web` + `@expo/metro-runtime` are NOT installed**, so `expo start --web`
   fails immediately regardless.

The project's real runtime-verification path is **Expo Go on a device via tunnel mode**
(`npm run dev`, scan QR) — this is inherently **HITL**, driven by the user, not by an agent
in this environment. See the `device-testing-default` memory.

## So what counts as verification here

For a **game-logic or composition-root change** (most work): the runtime surface you CAN
reach is the composition seam under test. Drive it with a **reachability test** that builds a
real world via `createWorld({ bus, masterSeed, characterProfile })`, exercises the change
(hire staff, cross a gate, advance days via `bus.publish('clock:day_started', …)`, buy/sell),
and asserts the observable output of the builder/seam. Templates:
`tests/*.reachability.test.ts(x)`. These are the closest thing to "running the app" available
autonomously — they execute the real wiring, not a mock.

For a **UI-only presentation change**: a `*.smoke.test.tsx` renders the real component tree
(RN Testing Library) — mounts without crashing, asserts surfaced text/testIDs. Plus an
app-composition wiring guard (`tests/helpers/appComposition.ts readAppCompositionSource()`)
proves the prop is actually wired into `src/app/**`, not just defined.

Baseline gates: `npm run typecheck` and `npm test` (jest-expo).

## Verdict guidance for /verify on this repo

A pure UI/composition change whose live surface is the RN GUI → the honest verdict is
**BLOCKED** for the live-GUI drive (native dep + no web + HITL device path), with the
reachability + smoke + wiring-guard tests cited as the reachable evidence. Do **not** install
`react-native-web` to force a web boot — `expo-sqlite` will still block it, and web is not a
supported target for this app.
