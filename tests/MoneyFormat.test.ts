import { money, compactMoney, grouped } from '../src/ui/kit';

/**
 * #387 — the app's one money rule: **compact when ambient, exact when the
 * player is about to act.** This file pins the two formatters themselves; the
 * surfaces that pick between them are pinned in `MoneyFormat.test.tsx`, and the
 * guard that stops a third one being born at a call site is
 * `MoneyFormat.noleak.test.ts`.
 */
describe('#387 the kit is the app\'s one currency-formatting surface', () => {
  it('the kit barrel exports both formatters', () => {
    expect(typeof money).toBe('function');
    expect(typeof compactMoney).toBe('function');
  });

  it('states exact dollars with thousands separators', () => {
    expect(money(12431)).toBe('$12,431');
    expect(money(0)).toBe('$0');
    expect(money(999)).toBe('$999');
    expect(money(1000)).toBe('$1,000');
    expect(money(1_247_503)).toBe('$1,247,503');
  });

  it('rounds to the dollar — cents are not a unit this game transacts in', () => {
    expect(money(12430.6)).toBe('$12,431');
    expect(money(-12430.6)).toBe('-$12,431');
  });

  it('compacts thousands and millions to one decimal, trailing zero trimmed', () => {
    expect(compactMoney(12431)).toBe('$12.4k');
    expect(compactMoney(60000)).toBe('$60k');
    expect(compactMoney(1_247_503)).toBe('$1.2M');
    expect(compactMoney(2_000_000)).toBe('$2M');
  });

  it('sub-$1k compacts to exact dollars', () => {
    // A fractional-k string for a two-figure number is both longer to read and
    // less precise than the thing it would replace.
    expect(compactMoney(999)).toBe('$999');
    expect(compactMoney(412)).toBe('$412');
    expect(compactMoney(0)).toBe('$0');
    expect(compactMoney(-750)).toBe('-$750');
  });

  it('keeps the sign outside the symbol, in both formatters', () => {
    // `$-1,400` reads as a positive figure with a stray dash at a glance; the
    // sign has to arrive before the eye reaches the digits.
    expect(money(-1400)).toBe('-$1,400');
    expect(compactMoney(-1400)).toBe('-$1.4k');
    expect(compactMoney(-1_500_000)).toBe('-$1.5M');
    expect(money(-1400).startsWith('-$')).toBe(true);
    expect(compactMoney(-1400).startsWith('-$')).toBe(true);
  });

  it('groups without Intl, so Hermes states the same string the web target does', () => {
    // Hermes ships without full Intl: `toLocaleString('en-US')` silently
    // degrades to an ungrouped run of digits on the platforms this game ships
    // to, while reading correctly on the web target an agent drives. Grouping
    // is done by hand here so the two cannot disagree.
    const spy = jest.spyOn(Number.prototype, 'toLocaleString');
    money(1_247_503);
    compactMoney(1_247_503);
    grouped(84_000);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('groups a bare count too, for the odometers that sit beside the money', () => {
    expect(grouped(84000)).toBe('84,000');
    expect(grouped(999)).toBe('999');
    expect(grouped(-1200)).toBe('-1,200');
  });
});
