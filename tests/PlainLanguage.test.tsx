import fs from 'fs';
import path from 'path';
import { loadHints } from '../src/app/hints';
import { loadEmptyStates } from '../src/ui/copy';

/**
 * Player-facing copy review (#388 the hint catalog; #389 the labels, the empty
 * states and the source scan).
 *
 * This is the ONE place copy is reviewed by rule rather than by eye. Three
 * layers, each failing by the offending entry's id or by the offending file's
 * name — a review that says "something is wrong somewhere" is not a review.
 */
const hints = loadHints();
const emptyStates = loadEmptyStates();

/**
 * The locked "no vague temperature labels" rule (`.claude/rules/ui.md`). Warm /
 * hot / cool are a fine internal heat model and are never acceptable in
 * something the player reads: they name a feeling, not the axis the control
 * moves along. Matched as whole words so "shortest" and "coolant" pass.
 */
const TEMPERATURE = /\b(warm|warmer|warmest|hot|hotter|hottest|cool|cooler|coolest|cold|colder|coldest|lukewarm|tepid|chilly|frosty|sizzling)\b/i;

/**
 * A hint says what happens to the STORE, never what the control is. "Sets the
 * trade policy" is the control's own label spelled out; "you own that trade at
 * the number you gave" is the consequence. Copy opening on one of these verbs
 * is naming the control.
 */
const NAMES_THE_CONTROL = /^(sets?|chooses?|picks?|selects?|controls?|toggles?|switches?|changes?|adjusts?|opens?|decides?) /i;

describe('hint copy is plain language a layperson reads right', () => {
  it('the catalog is not empty (a scan of nothing passes everything)', () => {
    expect(hints.hints.length).toBeGreaterThan(10);
  });

  it.each(hints.hints.map((h) => [h.id, h.text] as const))(
    '%s uses no temperature word',
    (_id, text) => {
      expect(text.match(TEMPERATURE)?.[0] ?? null).toBeNull();
    },
  );

  it.each(hints.hints.map((h) => [h.id, h.text] as const))(
    '%s names the consequence, not the control',
    (_id, text) => {
      expect(NAMES_THE_CONTROL.test(text.trim())).toBe(false);
    },
  );

  it.each(hints.hints.map((h) => [h.id, h.text] as const))(
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

  it.each(hints.hints.map((h) => [h.id, h.text] as const))(
    '%s is a sentence, not a fragment',
    (_id, text) => {
      expect(text.trim()).toMatch(/[.!?]$/);
      expect(text.trim().length).toBeGreaterThan(40);
    },
  );
});

describe('empty-state copy is plain language a layperson reads right (#389)', () => {
  it('the catalog is not empty (a scan of nothing passes everything)', () => {
    expect(emptyStates.states.length).toBeGreaterThan(40);
  });

  it.each(emptyStates.states.map((s) => [s.id, s.text] as const))(
    '%s uses no temperature word',
    (_id, text) => {
      expect(text.match(TEMPERATURE)?.[0] ?? null).toBeNull();
    },
  );

  it.each(emptyStates.states.map((s) => [s.id, s.text] as const))(
    '%s is a sentence, not a bare label',
    (_id, text) => {
      // "None" / "No data" tells a new player nothing they could not already
      // see. An empty region is the FIRST surface a new career meets, so each
      // of these has to say what is missing and what to do about it.
      expect(text.trim()).toMatch(/[.!?]$/);
    },
  );

  it.each(emptyStates.states.map((s) => [s.id, s.text] as const))(
    '%s quotes no figure',
    (_id, text) => {
      // Same rule as a hint, for the same reason: written once, read against
      // every store. `{slot}` fills carry the store's own words, not money.
      expect(text).not.toMatch(/\$/);
    },
  );
});

// ── The source scan ──────────────────────────────────────────────────────────

const SRC_UI = path.join(__dirname, '..', 'src', 'ui');

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

const uiFiles = sourceFiles(SRC_UI).filter((f) => !/\.test\.tsx?$/.test(f));

/**
 * The props and object keys that carry a string the PLAYER reads. This is the
 * whole reason the scan can be broad without being wrong: `'hot' | 'warm' |
 * 'cold'` as an internal band-id union, an object key, a palette name or a
 * comment is untouched, because none of them is one of these keys. The rule was
 * never "the word must not appear in the file" — it is "the word must not be
 * what the player is shown".
 */
const COPY_KEY =
  /\b(label|title|caption|summary|headline|blurb|note|emptyNote|emptyLabel|valueLabel|centerLabel|ratioLabel|streakLabel|actionLabel|confirmLabel|cancelLabel|sectionLabel|placeholder|accessibilityLabel|message|sentence|status|text)\s*[:=]\s*(['"])((?:\\.|(?!\2)[^\\\n])*)\2/g;

/**
 * A JSX text node — what a component writes between its tags. `(?!=)` keeps a
 * `>=` comparison out of the scan, and a match may not cross a line: a
 * multi-line span between two angle brackets is code, not a rendered string.
 */
const JSX_TEXT = />(?!=)([A-Za-z][^<>{}\n]*)</g;

/**
 * Comments are not player-facing, and the internal heat model is DESCRIBED in
 * them all over this tree — the rule was always about what is rendered.
 * Stripping them first is what lets the scan stay broad without an allowlist
 * that would rot.
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
}

function playerFacingStrings(src: string): string[] {
  const code = stripComments(src);
  const out: string[] = [];
  for (const m of code.matchAll(COPY_KEY)) out.push(m[3]);
  for (const m of code.matchAll(JSX_TEXT)) out.push(m[1]);
  return out.filter((s) => /[A-Za-z]/.test(s));
}

describe('no temperature word reaches a player-facing label (#389)', () => {
  it('the scan sees the UI tree (a scan of nothing passes everything)', () => {
    expect(uiFiles.length).toBeGreaterThan(80);
  });

  it.each(uiFiles)('%s labels no value with a temperature word', (file) => {
    const src = fs.readFileSync(file, 'utf8');
    const offenders = playerFacingStrings(src).filter((s) => TEMPERATURE.test(s));
    expect(offenders).toEqual([]);
  });
});

/**
 * The copy catalogs under `data/`. Not every JSON file in there is copy — most
 * are numbers, and one (`recon-surprise-events.json`) carries mechanical event
 * descriptions where "cold start" is the name of a real thing rather than a
 * position on a scale. These are the files whose strings are LABELS the player
 * reads off a control or a region.
 */
const COPY_CATALOGS = [
  'hints.json',
  // #390 — `effect` made this a copy catalog: the sentence the character card
  // states about each pick lives beside the lever it describes.
  'backstories.json',
  'empty-states.json',
  'pricing-strategies.json',
  'nav-tabs.json',
  'career-endings.json',
  'desk-orders.json',
  'clock-bites.json',
  'owner-interrupts.json',
] as const;

function catalogStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => catalogStrings(v, out));
  else if (value != null && typeof value === 'object')
    Object.entries(value).forEach(([k, v]) => {
      // `_doc` keys are the file's own record of why it is shaped the way it
      // is — written for the next session, not rendered to anybody.
      if (!k.startsWith('_')) catalogStrings(v, out);
    });
  return out;
}

describe('no temperature word reaches a copy catalog (#389)', () => {
  it.each(COPY_CATALOGS)('data/%s labels no value with a temperature word', (name) => {
    const raw: unknown = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', 'data', name), 'utf8'),
    );
    const offenders = catalogStrings(raw).filter((s) => TEMPERATURE.test(s));
    expect(offenders).toEqual([]);
  });
});

// ── Scale end-labels ─────────────────────────────────────────────────────────

/**
 * A magnitude with no axis attached. "Medium" beside a dollar range says
 * medium WHAT — the auction's condition read shipped exactly that until #389.
 * A scale end must name the thing it is an end of.
 */
const BARE_MAGNITUDE =
  /^(very\s+)?(high|higher|highest|low|lower|lowest|med|medium|mid|strong|weak|good|bad|ok|okay|poor|fair)$/i;

const DIAL_LABEL = /\b(leftLabel|rightLabel)\s*=\s*(?:\{)?["']([^"']+)["']/g;

describe('every scale end-label is an axis word (#389)', () => {
  /**
   * The dial ends written in source — the shared `PostureDial` takes its two
   * ends as props, so a scan of those props catches a fourth dial built next
   * year without anybody remembering this rule exists.
   */
  const dialEnds: { file: string; label: string }[] = uiFiles.flatMap((file) =>
    [...fs.readFileSync(file, 'utf8').matchAll(DIAL_LABEL)].map((m) => ({
      file,
      label: m[2],
    })),
  );

  it('the scan found the dials (a scan of nothing passes everything)', () => {
    expect(dialEnds.length).toBeGreaterThanOrEqual(4);
  });

  it.each(dialEnds.map((d) => [`${path.basename(d.file)} · ${d.label}`, d.label] as const))(
    '%s names the axis',
    (_where, label) => {
      expect(TEMPERATURE.test(label)).toBe(false);
      expect(BARE_MAGNITUDE.test(label.trim())).toBe(false);
    },
  );

  /**
   * The scales that live in `data/` — the three standing desk orders and the
   * pricing ladder. Their option labels are what the player picks between, so
   * they are ends of a scale in exactly the same way.
   */
  const dataScales: { scale: string; labels: readonly string[] }[] = (() => {
    const tunables: {
      ownership: { hoursOfOp: { options: { label: string }[] } };
      tradePolicy: { policies: { label: string }[] };
      fniPosture: { postures: { label: string }[] };
    } = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', 'data', 'tunables.json'), 'utf8'),
    );
    const pricing: { strategies: Record<string, { label: string }> } = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, '..', 'data', 'pricing-strategies.json'),
        'utf8',
      ),
    );
    return [
      {
        scale: 'trade policy',
        labels: tunables.tradePolicy.policies.map((p) => p.label),
      },
      {
        scale: 'F&I posture',
        labels: tunables.fniPosture.postures.map((p) => p.label),
      },
      {
        scale: 'hours of operation',
        labels: tunables.ownership.hoursOfOp.options.map((o) => o.label),
      },
      { scale: 'pricing strategy', labels: Object.values(pricing.strategies).map((s) => s.label) },
    ];
  })();

  it.each(dataScales.map((s) => [s.scale, s.labels] as const))(
    'the %s scale names its own axis at every position',
    (_scale, labels) => {
      expect(labels.length).toBeGreaterThanOrEqual(3);
      for (const label of labels) {
        expect(TEMPERATURE.test(label)).toBe(false);
        expect(BARE_MAGNITUDE.test(label.trim())).toBe(false);
      }
    },
  );
});
