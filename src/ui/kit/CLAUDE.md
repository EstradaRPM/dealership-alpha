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
`Icon` (kit glyph by name, themed `size`/`tone`) · `IconBadge` (colored
tile holding an `Icon`; `solid`·`soft`, rounded·circle) · `ProgressBar` ·
`Meter` (labeled gauge, optional `caption` under the bar) · `StatCard` (value·label·trend delta, optional leading
`icon`) · `SectionHeader` · `Collapsible` (headed panel that opens and shuts) ·
the chart primitives below.

`ProgressBar` carries three optional readings beyond the fill, and they are not
interchangeable. `tick` is a **second segment** appended after the fill (a
daily contribution riding a pace bar). `mark` is a **hairline reference point**
— where the value started, so the fill beyond it is distance travelled. `reach`
is the **point past which the track cannot be filled**; everything beyond it is
scrimmed. `mark`/`reach` are ignored in `tick` mode. The reason `reach` dims a
shared axis rather than rescaling the bar to each subject's own limit: two bars
rescaled to different limits are not comparable, and a column of them (a
roster's skills, #377) exists to be compared down the page.

`Collapsible` is the grouping primitive for a surface with more content than one
screen of attention (People's per-department panels, its folded person cards).
Three rules it is built on, and they are the reason it exists rather than a
per-surface `useState`:

- **The header is the whole affordance.** `title` + `summary` + `accessory` mean
  a *shut* panel still says what is inside it and whether it needs attention.
- **A shut body unmounts.** A collapsed group costs nothing to render; a
  hidden-but-mounted subtree keeps doing work nobody asked for.
- **`pinned` is the exception, and it is narrow.** Content that renders whether
  the panel is open or shut — a prompt waiting on an answer, the price a card is
  compared on. Everything else goes in `children`.

Uncontrolled by default (`defaultExpanded`); pass `expanded` + `onToggle` when
the parent must drive it. `variant` + `bodyPadded` let a panel host a card
instead of raw content without nesting two raised slabs.

## Charts (#350, #376)

`Sparkline` (inline trend, no axes) · `LineChart` (multi-series trend on a
signed value axis) · `BarChart` (categorical comparison,
`vertical`|`horizontal`) · `DonutChart` (composition/share) · shared sub-parts
`ChartGrid`, `ChartLegend`, `ChartEmpty`, `useChartWidth`. Built on
`react-native-svg`; `GaugeArc` predates it and stays a pure-`View` build.

- **`LineChart` vs `Sparkline` is the axis, and the axis is the point** (#376).
  A sparkline takes samples the *caller* normalized and has no baseline, so it
  cannot say whether a dip crossed zero. `LineChart` takes raw values and places
  them in a `signedDomain` — which **always contains zero** — so a loss renders
  below a drawn zero rule instead of at the plot floor. A chart of a number that
  can go negative (a P&L) must be this one. `BarChart` clamps negatives to zero
  by design and is the wrong primitive for signed data.
- **Series identity defaults to the categorical palette; `tone` is the
  exception.** Pass a semantic role only when the category genuinely carries the
  role's meaning (money out really is `danger`) — the same exception `BarChart`
  makes per datum.

- **Geometry is a separate pure module.** Every number lives in `chartScale.ts`
  — scales, tick ladders, bar bands, ring segments, and the SVG `d` strings
  themselves — with no React and no theme. A wrong chart is an assertion on a
  path string, not a screenshot, and an animated or canvas-backed rewrite reuses
  the same math behind the same props.
- **A chart must be told its width or measure it.** `useChartWidth(explicit?)`
  measures the container via `onLayout` and re-renders once; **tests get no
  layout pass, so they must pass `width`**.
- **Identity color comes from `theme.series`**, not the semantic `colors` roles.
  The roles carry meaning (`danger` is a loss) and a category means nothing but
  "not the one beside me". Slots are assigned in fixed order and **never
  cycled** — past the last slot categories fold into one muted "Other". The
  order is a colorblind-safety result, not taste: `series.ts` records the checks
  it passes and the surface it was validated against. Re-run the validator
  before changing a hue.
- **Bars carry one hue by default.** The category axis already states identity;
  per-datum `tone` is for the one bar a surface is making a point about.
- **A donut always ships its legend** — a slice has no axis to name it, so
  identity would otherwise be color alone. Legend text stays in the ink roles;
  the swatch carries the color.
- **Every primitive has an empty state.** A blank plot is indistinguishable from
  a broken one, so `emptyLabel` renders instead of the marks.

Icons (#236) come from `@expo/vector-icons`, rendered as **MaterialIcons**
glyphs: Android silently rejects SDK 54's vendored Ionicons.ttf (loads +
registers fine, paints tofu — see `icons.ts`), so call sites keep their
Ionicons-style names and `ICON_MAP` in `icons.ts` resolves each to a Material
glyph. New icon = add one mapping entry there; the `satisfies` clause makes a
missing/typo'd Material glyph a compile error. The glyph name is a prop;
size/color are theme roles (`theme.icon.size`/`.tone`), never literals.
Soft fills (soft `Pill`, soft `IconBadge`, `StatCard` icon) use the `*Tint`
translucent color roles — single-sourced in `tokens.ts`, never an inline alpha.

A `raised` `Surface` is a real slab: a `surfaceRaised` gradient fill under a
`gloss` top sheen, wrapped by the `raised` bevel (top catch-light + outer
shadow). Gradients never hand-painted per surface — always a `gradients` role.

## Tokens

`colors` (semantic roles, #133) · `series` (the ordered categorical chart
palette, #350) · `gradients` (role→`[from,to,…]` stop arrays,
the depth "material", #235) · `spacing` (4-based rhythm) · `radius` ·
`typography` (named text roles off a size/weight/line-height ramp) ·
`elevation` (raised·floating·inset depth — the neo-skeuo bevels).

Proven on `DayRecap` (the first migrated surface). Per-surface rebrand slices
adopt this kit one screen at a time, newest-mechanic-first.
