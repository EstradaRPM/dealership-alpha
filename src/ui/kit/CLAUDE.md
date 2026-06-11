# UI design-system kit (#225)

The neo-skeuomorphic foundation every rebranded surface renders against. Two
parts: the **theme** (`src/ui/theme/`) and the **base-component kit** (this dir).
Read this before restyling any surface — don't re-derive the pattern from a
prior slice's source.

## How a surface consumes it

```tsx
import { useTheme } from '../theme';
import { Surface, SectionHeader, StatCard, Button } from '../kit';

function MyScreen() {
  const t = useTheme();               // tokens, never raw hex/px
  return (
    <Surface>                         // raised card by default
      <SectionHeader title="Today" />
      <View style={{ marginTop: t.spacing.lg }}>
        <StatCard label="Units" value={3} />
      </View>
    </Surface>
  );
}
```

## The contract (do not break)

- **Single injectable theme.** Tokens come from `useTheme()`, never piecemeal
  `import { colors }`. The root `<ThemeProvider>` (mounted in `App.tsx`) supplies
  it; swapping that one object re-skins every kit surface with zero component
  edits. Context default is `defaultTheme`, so components render fine in isolated
  tests with no provider.
- **Semantic roles only, no literals in components.** Reference `colors.surface`,
  `spacing.md`, `radius.card`-style roles, `elevation.raised`, `typography.body`
  — never a raw `#hex`, `rgb()`, or magic px. A new visual language is a new
  `Theme` object, not edits across surfaces. Raw values live ONLY in
  `src/ui/theme/*` (the role→value map). Enforced by `tests/kit.noleak.test.ts`.
- **Interface-stable components.** Variants are props (`<Button variant="ghost">`,
  `<Badge tone="danger">`), not forked components, and are consumed via the
  barrel `src/ui/kit/index.ts`. An alternate implementation can satisfy the same
  props behind the barrel without touching call sites.
- **Presentation only.** No game-logic imports; the caller formats values and
  owns handlers.

## Kit surface

`Surface`/`Card` (raised·inset·flat) · `Gradient`/`GradientSurface` (themed
`LinearGradient` by role) · `Button` (primary·secondary·ghost) ·
`Badge`/`Pill` (neutral·info·positive·reward·danger; `outline`·`soft` fill) ·
`Icon` (Ionicons glyph by name, themed `size`/`tone`) · `IconBadge` (colored
tile holding an `Icon`; `solid`·`soft`, rounded·circle) · `ProgressBar` ·
`Meter` (labeled gauge) · `StatCard` (value·label·trend delta, optional leading
`icon`) · `SectionHeader`.

Icons (#236) come from `@expo/vector-icons` (Ionicons). The glyph name is a
prop; size/color are theme roles (`theme.icon.size`/`.tone`), never literals.
Soft fills (soft `Pill`, soft `IconBadge`, `StatCard` icon) use the `*Tint`
translucent color roles — single-sourced in `tokens.ts`, never an inline alpha.

A `raised` `Surface` is a real slab: a `surfaceRaised` gradient fill under a
`gloss` top sheen, wrapped by the `raised` bevel (top catch-light + outer
shadow). Gradients never hand-painted per surface — always a `gradients` role.

## Tokens

`colors` (semantic roles, #133) · `gradients` (role→`[from,to,…]` stop arrays,
the depth "material", #235) · `spacing` (4-based rhythm) · `radius` ·
`typography` (named text roles off a size/weight/line-height ramp) ·
`elevation` (raised·floating·inset depth — the neo-skeuo bevels).

Proven on `DayRecap` (the first migrated surface). Per-surface rebrand slices
adopt this kit one screen at a time, newest-mechanic-first.
