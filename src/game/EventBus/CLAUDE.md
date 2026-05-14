# EventBus

Central pub/sub for cross-module communication. **Every** cross-module signal goes through here — no module imports another's internals.

## Public API (`index.ts`)
- `createEventBus()` → `EventBus` instance with `publish`, `subscribe`, `unsubscribe`.
- Types: `EventBus`, `EventMap`, `EventName`, `EventPayload<K>`, `EventListener<K>`.

## Canonical event catalog
`events.ts` is the **source of truth** for every event name, payload shape, and ordering note. Adding a new event = adding one line to `EventMap`. Subscribers and publishers are statically type-checked against it.

Read `events.ts` before writing any new publisher/subscriber — it documents inter-module sequencing (e.g. the overnight clock sequence, customer lifecycle order).

## Conventions
- Event names use `domain:verb` (snake_case verb).
- Payloads are plain data — no class instances, no functions.
- `bus:ready` is the boot signal published once after wiring.

## No-no
- Do not import non-`index.ts` files. `EventBus.ts` is private.
- Do not add events that bypass the typed `EventMap` (no `any`, no string keys).
