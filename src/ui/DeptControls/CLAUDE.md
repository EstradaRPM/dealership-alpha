# DeptControls

Shared **department POLICY-control primitives** (#318) — the steppers,
supplier-tier / option chip rows, par-control row, and the continuous posture
dial. Extracted from the Service page's #309 control block so the Body Shop page
(#318) reuses the **exact same** widgets against its own four collision
categories: one implementation, two profit centers (the shared department-line
idiom). Pure presentational widgets — they render the live values + option lists
the composition root reads off the World and dispatch the setters back. No
game-logic reach-in; no module imports a game type (ids are bare strings).

## Public API (`index.ts`)
- `Stepper` — `−`/`+` integer stepper `{ label, value, onChange, min?,
  accessibilityName }` (a11y: `Increase/Decrease ${accessibilityName}`).
- `ChipRow` — single-select chip row `{ options, selectedId, onSelect }` over
  `DeptChipOption[]` | `DeptTierOption[]`.
- `ParControlRow` — one parts category's procurement row `{ row, tierOptions,
  testIDPrefix, onSetReorderPoint, onSetTarget, onSetSupplierTier }`. `testIDPrefix`
  keys the row testID per department (`service-par-` / `body-shop-par-`).
- `PostureDial` — a continuous `[0,1]` policy dial stepped ±`POSTURE_STEP` (0.1).
  The caller supplies the endpoint labels + word/accessibility phrasing so the
  same dial drives Service's competitive↔premium posture **and** the Body Shop's
  insurance↔retail channel mix: `{ value, onChange, word, leftLabel, rightLabel,
  readoutA11y, decreaseA11y, increaseA11y, testID }`.
- `makeControlStyles(theme)` — the shared control StyleSheet (steppers, chips,
  par rows, posture dial).
- Types: `DeptSupplierTierId` (bare string), `DeptParControl`, `DeptTierOption`,
  `DeptChipOption`; const `POSTURE_STEP`.

## Notes
- **Labels name the axis, never a temperature** (the locked rule). `PostureDial`
  surfaces the caller's plain-language `word(value)` + a `leftLabel ◄ N% ►
  rightLabel` scale; the dial itself never picks a temperature word.
- **Policy-style, not morning clicks.** Par + posture are set once and applied
  automatically — the consuming page dispatches straight into the game logic and
  re-snapshots/re-renders.
- **Visual treatment is deliberately plain** — a real slider etc. is the later
  `/map-mockup` pass.
- Consumers: `ServicePage` (#309) and `BodyShopPage` (#318). Their page-specific
  public types (`ServiceParControl`, `BodyShopControlsModel`, …) are structurally
  compatible with the `Dept*` shapes here.

## Tests
Exercised through the consuming pages' smoke tests (`ServicePage.smoke`,
`BodyShopPage.smoke`) — they assert the steppers/chips/dial render and dispatch.
No dedicated test file.
