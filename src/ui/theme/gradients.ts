/**
 * Gradient roles — the "material" half of the neo-skeuomorphic look. Flat color
 * tokens (`tokens.ts`) give a surface its base hue; these give it depth: a fill
 * that runs lighter at the top to darker at the bottom, plus the translucent
 * top sheen that reads as a glossy bevel.
 *
 * Same doctrine as every other token file — roles are semantic (`surfaceRaised`,
 * `primary`, `reward`, `gloss`), never picked by literal stops. A surface asks
 * for a role; retuning the material is a one-file edit here. Raw color literals
 * are allowed ONLY in this file (it IS the role→value map); kit components must
 * resolve a role through `useTheme()`.
 *
 * Each role is a `[from, to, …]` stop array, vertical by default (top → bottom).
 * At least two stops, so the value is directly usable as `LinearGradient`'s
 * `colors` prop.
 */

/** A gradient stop list: at least two colors, top-to-bottom by default. */
export type GradientStops = readonly [string, string, ...string[]];

export const gradients = {
  /** Flush panels / page-level fills — a whisper of vertical depth. */
  surface: ['#202a3e', '#161e2e'],
  /**
   * Raised cards, panels, primary-button bodies. Sits only a gentle step above
   * the page `base`: the separation comes from the bevel (rim + gloss + shadow
   * in `elevation.raised`), NOT from a big fill jump — a loud lift reads as a
   * flat colored rectangle, not a glass slab. Still a perceptible vertical run
   * so the gradient registers on a phone OLED.
   */
  surfaceRaised: ['#2a3450', '#1e2738'],
  /** Primary interactive fill (cyan) — glossy call-to-action bodies. */
  primary: ['#4fc6fb', '#2ea3dd'],
  /** Secondary accent fill (indigo) — solid `IconBadge` tiles, selection pops. */
  accent: ['#97a2fb', '#6973ee'],
  /** Muted/neutral fill — solid `IconBadge` tiles with no semantic accent. */
  muted: ['#98a2b4', '#76829a'],
  /** Dim companion fill (navy-blue) — secondary buttons. */
  primaryDim: ['#27496f', '#163050'],
  /** Money & win moments (amber) — reward fills, tier-up flourishes. */
  reward: ['#fcd34d', '#f4a823'],
  /** Positive/success fill (green) — money tiles, healthy pace/target bars.
   *  Deepened off a pale mint so the candy tile reads as rich money-green, not
   *  faded, against the low-contrast card. */
  positive: ['#47dca3', '#1fa173'],
  /** Danger/negative fill (red) — behind-pace / loss bars. */
  danger: ['#f87681', '#e23a46'],
  /**
   * The top-highlight sheen layered over a raised surface — translucent white
   * fading to fully transparent. Sits above the fill, below the content. Tuned
   * to be visible on a phone OLED at real brightness (6% was sub-threshold)
   * while still reading as light catching a glass edge, not a plastic dome.
   */
  gloss: ['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.00)'],
  /**
   * Hero-header top scrim — sits between the hero art and the identity text so
   * the dealership name/tier stay readable over any photo (and behind the
   * translucent status bar). Dark at the very top, gone by mid-header.
   */
  heroScrimTop: ['rgba(8,12,20,0.92)', 'rgba(8,12,20,0.55)', 'rgba(8,12,20,0)'],
  /**
   * Hero-header side scrim — a horizontal (left → right) darkening run layered
   * under the identity text only, so the text side of the photo carries extra
   * contrast without flattening the whole image.
   */
  heroScrimSide: ['rgba(8,12,20,0.80)', 'rgba(8,12,20,0.35)', 'rgba(8,12,20,0)'],
  /**
   * Hero-header bottom fade — melts the hero art into the page `base` so the
   * first content cards float over the photo with no hard seam.
   */
  heroScrimBottom: ['rgba(18,26,43,0)', 'rgba(18,26,43,0.55)', '#121a2b'],
} as const satisfies Record<string, GradientStops>;

export type GradientToken = keyof typeof gradients;
