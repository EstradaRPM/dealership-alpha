# EventBus

Central pub/sub for cross-module communication. **Every** cross-module signal goes through here — no module imports another's internals.

## Public API (`index.ts`)
- `createEventBus()` → `EventBus` instance with `publish`, `subscribe`, `unsubscribe`.
- Types: `EventBus`, `EventMap`, `EventName`, `EventPayload<K>`, `EventListener<K>`.
- `EVENT_NAMES` — the catalog as a **runtime** value (#395), for the data files that name an event and have to check themselves against something.

## Canonical event catalog
`events.ts` is the **source of truth** for every event name, payload shape, and ordering note. Adding a new event = adding one line to `EventMap` **and** one line to `EVENT_NAMES`. Subscribers and publishers are statically type-checked against it.

`EventMap` is an interface, so `EventName` is erased at build time and a JSON catalog that declares an event (`data/teaching-beats.json` is the first) has nothing to validate against. `EVENT_NAMES` is that value. The two cannot drift: `EVENT_NAMES_ARE_EXHAUSTIVE` at the foot of `events.ts` resolves to `never` — and so fails `tsc` — the moment the list and the map disagree in either direction.

Read `events.ts` before writing any new publisher/subscriber — it documents inter-module sequencing (e.g. the overnight clock sequence, customer lifecycle order).

## Conventions
- Event names use `domain:verb` (snake_case verb).
- Payloads are plain data — no class instances, no functions.
- `bus:ready` is the boot signal published once after wiring.

## No-no
- Do not import non-`index.ts` files. `EventBus.ts` is private.
- Do not add events that bypass the typed `EventMap` (no `any`, no string keys).
