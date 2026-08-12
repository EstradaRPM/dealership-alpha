/**
 * The app's one currency-formatting surface (issue 387).
 *
 * Two functions, and which one a surface reaches for is a rule about the
 * player rather than about the number:
 *
 * - **`money` — exact, whenever the player is committing against the figure.**
 *   An asking price, a trade allowance, a monthly payment, a wage, an auction
 *   bid, a build cost, a credit draw. The lesson these surfaces inherit is that
 *   a number the player can check and find wrong is the one thing they cannot
 *   ship, and every one of these is checked the moment it is acted on.
 * - **`compactMoney` — short, whenever the figure is ambient.** A HUD headline,
 *   the store's worth, a month's gross, a chart's axis tick, a Reveal
 *   scoreline. Nothing is being committed against it, and the reading is the
 *   magnitude.
 *
 * Both keep the sign **outside** the symbol (`-$1,400`, never `$-1,400`) so a
 * negative position cannot be misread as a positive one at a glance.
 *
 * Neither touches `Intl`. Hermes ships without full `Intl` support, so
 * `toLocaleString('en-US')` is not a grouping guarantee on the platforms this
 * game actually ships to — it silently degrades to an ungrouped run of digits.
 * Grouping is done by hand here, once, and every surface inherits it.
 *
 * Pure and presentation-only, like `chartScale`: no React, no theme, no game
 * imports.
 */

/** Insert thousands separators into a run of digits, without `Intl`. */
function group(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * A grouped whole number with no currency symbol — `84,000` — for the counts
 * that sit beside money on the same card (a car's mileage, most of them).
 *
 * It is here rather than at those call sites for the same reason the guard
 * forbids `toLocaleString` under `src/ui/**` outright: the Hermes gap is a
 * property of the *grouping*, not of the dollar sign, so an allowlist for "the
 * non-currency ones" would have left six odometers rendering ungrouped on the
 * shipping platforms while reading correctly on the web target an agent drives.
 * One rule, one place, and the scan can be absolute.
 */
export function grouped(n: number): string {
  const rounded = Math.round(n);
  const sign = rounded < 0 ? '-' : '';
  return `${sign}${group(String(Math.abs(rounded)))}`;
}

/**
 * Exact dollars — `$12,431`, `-$1,400`. Rounded to the dollar; cents are not a
 * unit this game transacts in.
 */
export function money(n: number): string {
  const rounded = Math.round(n);
  const sign = rounded < 0 ? '-' : '';
  return `${sign}$${group(String(Math.abs(rounded)))}`;
}

/**
 * Ambient dollars — `$12.4k`, `$1.2M`, `-$1.4k`.
 *
 * Below $1,000 it renders **exact dollars**: a fractional-k string for a
 * two-figure number ("$0.4k") is longer to read and less precise than the
 * thing it replaced. That threshold is also what keeps a chart's axis ladder
 * legible at small scales.
 */
export function compactMoney(n: number): string {
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${sign}$${trimTenth(abs / 1_000_000)}M`;
  if (abs >= 1_000) return `${sign}$${trimTenth(abs / 1_000)}k`;
  return `${sign}$${Math.round(abs)}`;
}

/** One decimal, and none at all when it would be a trailing zero. */
function trimTenth(v: number): string {
  const rounded = Math.round(v * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
