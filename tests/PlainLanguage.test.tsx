import { loadHints } from '../src/app/hints';

/**
 * Player-facing copy review (#388; extended to labels and empty states by #389).
 *
 * This is the ONE place copy is reviewed by rule rather than by eye, and it
 * starts where #388 put the most new copy: `data/hints.json`. Three rules, each
 * failing by the offending entry's id — a review that says "something is wrong
 * somewhere in the catalog" is not a review.
 */
const config = loadHints();

/**
 * The locked "no vague temperature labels" rule (`.claude/rules/ui.md`). Warm /
 * hot / cool are a fine internal heat model and are never acceptable in
 * something the player reads: they name a feeling, not the axis the control
 * moves along. Matched as whole words so "shortest" and "coolant" pass.
 */
const TEMPERATURE = /\b(warm|warmer|warmest|hot|hotter|hottest|cool|cooler|coolest|cold|colder|coldest|lukewarm|tepid)\b/i;

/**
 * A hint says what happens to the STORE, never what the control is. "Sets the
 * trade policy" is the control's own label spelled out; "you own that trade at
 * the number you gave" is the consequence. Copy opening on one of these verbs
 * is naming the control.
 */
const NAMES_THE_CONTROL = /^(sets?|chooses?|picks?|selects?|controls?|toggles?|switches?|changes?|adjusts?|opens?|decides?) /i;

describe('hint copy is plain language a layperson reads right', () => {
  it('the catalog is not empty (a scan of nothing passes everything)', () => {
    expect(config.hints.length).toBeGreaterThan(10);
  });

  it.each(config.hints.map((h) => [h.id, h.text] as const))(
    '%s uses no temperature word',
    (_id, text) => {
      expect(text.match(TEMPERATURE)?.[0] ?? null).toBeNull();
    },
  );

  it.each(config.hints.map((h) => [h.id, h.text] as const))(
    '%s names the consequence, not the control',
    (_id, text) => {
      expect(NAMES_THE_CONTROL.test(text.trim())).toBe(false);
    },
  );

  it.each(config.hints.map((h) => [h.id, h.text] as const))(
    '%s quotes no figure',
    (_id, text) => {
      // The money rule (#387) is "exact when the player is about to act" — and a
      // hint cannot be exact about anything. It is written once and read against
      // every store, every tier and every day, so a dollar figure in it is a
      // claim the player can check against their own screen and find wrong. A
      // compact figure would be worse: it would be an inexact claim about a
      // number they are about to commit cash against.
      expect(text).not.toMatch(/\$/);
    },
  );

  it.each(config.hints.map((h) => [h.id, h.text] as const))(
    '%s is a sentence, not a fragment',
    (_id, text) => {
      expect(text.trim()).toMatch(/[.!?]$/);
      expect(text.trim().length).toBeGreaterThan(40);
    },
  );
});
