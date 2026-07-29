---
name: verify
description: How to runtime-verify this app. Read before attempting to "run" it — there is a drivable web target, and knowing what it does and does not prove is the whole point.
---

# Verifying dealership-alpha

**There is a runtime surface an agent can drive: the web target** (#338). It boots the real
app — real `createWorld`, real SaveStore, real screens — in a browser the browser tools
control. Before #338 this did not exist and every UI slice's verdict was BLOCKED; that
ceiling is gone. What web cannot answer is the *felt* half (see "What web does not prove").

The shipping platforms are still iOS/Android via EAS, and the HITL path is still **Expo Go on
a device via tunnel mode** (`npm run dev`, scan QR) — see the `device-testing-default` memory.
Web exists to give an agent something to drive, not to become a release target.

## Driving the web target

1. `preview_start` with `{ name: "web" }` — the config is in `.claude/launch.json`
   (`npx expo start --web --port 8082`; 8081 is usually taken by the user's own Metro).
   The first bundle takes ~15s; `preview_logs` shows `Web Bundled … index.ts` when it's up.
2. `resize_window` with `{ preset: "mobile" }` — the app is a portrait phone game and the
   layout assumes it.
3. **`read_page` is the primary instrument, not `screenshot`.** Screenshots fail whenever the
   Browser pane isn't displayed ("not compositing frames"), and coordinate clicks are refused
   without one. `read_page` + `get_page_text` need neither.
4. Click by `ref`, never by coordinate.

**The one trap that will cost you an hour:** the ref→screen coordinate mapping goes stale
after a navigation or reload, and clicks then land somewhere else on the page — silently, with
no error, looking exactly like a broken button. **Call `resize_window` again after every
`navigate`/reload, before the first click.** To confirm a click actually landed where you
think, install a capture-phase listener and read it back:

```js
document.addEventListener('click', e => console.log(e.clientX, e.clientY, e.target.textContent), true)
```

RN `Pressable`/`TouchableOpacity` render as plain `div`s, so the accessibility tree labels
most controls `generic` — match on the text content in the `read_page` output.

### Reaching a mid-game state fast

The `__DEV__` **START AT TIER · T2** button on the start menu creates a slot, seeds it from
`data/fixtures/tier-2.json`, and routes in through the *normal* load path. That is Day 31 /
Tier 2 with inventory and staff in about two clicks, and it exercises save → load on the way.

### Inspecting persisted state

On web the save lives in IndexedDB (`dealership` → `cells`), one record per logical key
(`index`, `slot:<id>`, `snapshot:<id>`, `checkpoint:<id>`, `legacy-wall`, `playtest-log`).
`javascript_tool` can read it — useful to prove a write actually landed rather than trusting
the screen. Use it for **inspection only**; never drive the UI by dispatching synthetic events.

## What web does and does not prove

**Does:** the screen renders; the tap lands; the modal queues; a number on screen matches the
world behind it; the live clock and FloorSim actually run; a reload resumes the same career.

**Does not:** whether any of it *lands* — pacing, tension, whether a decision feels like a
decision. That is the #74 playtest and it stays a human gate. Nor does it prove device-only
behavior: haptics, real gesture timing, on-device performance, safe-area on real hardware,
native fonts/icons.

## The other reachable evidence

For a **game-logic or composition-root change**: a **reachability test** that builds a real
world via `createWorld({ bus, masterSeed, characterProfile })`, exercises the change (hire
staff, cross a gate, advance days via `bus.publish('clock:day_started', …)`, buy/sell), and
asserts the observable output of the builder/seam. Templates:
`tests/*.reachability.test.ts(x)`. These execute the real wiring, not a mock, and they run in
CI — the web drive does not. **A web drive does not replace a reachability test; it confirms
the same wiring from the outside.**

For a **UI-only presentation change**: a `*.smoke.test.tsx` renders the real component tree
(RN Testing Library), plus the app-composition wiring guard
(`tests/helpers/appComposition.ts readAppCompositionSource()`) proving the prop is actually
wired into `src/app/**`.

Baseline gates: `npm run typecheck` and `npm test` (jest-expo).

## Verdict guidance for /verify on this repo

- A UI/composition change whose live surface is the GUI → **drive it on web.** Report what you
  clicked and what the screen showed. This is no longer an automatic BLOCKED, and citing the
  old native-SQLite/no-web excuse is now wrong: `src/game/SaveStore/webDriver.ts` is the web
  StorageDriver and `src/app/storage.ts` picks it by platform.
- **BLOCKED is reserved for what genuinely needs a device** — haptics, gesture timing,
  on-device perf, real safe-area — and the verdict must name which device capability is
  required, not just say "device".
- A felt/pacing question → not a verify verdict at all; it belongs to the #74 playtest.
