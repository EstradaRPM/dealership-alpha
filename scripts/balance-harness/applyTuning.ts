/**
 * `apply` — the one place in the harness that writes `data/**` (#345).
 *
 * The search proposes; a human accepts. Everything else in the harness mutates
 * the loaders' in-memory objects and restores them, so a study leaves the
 * working tree clean. This module is the deliberate exception, and it is gated
 * three ways:
 *
 *   1. **An explicit confirming flag.** `apply` without `--confirm` prints the
 *      diff, writes nothing, and exits non-zero.
 *   2. **A stale-baseline refusal.** The study recorded what `data/**` held when
 *      it opened. If disk has moved since — someone hand-tuned, or a previous
 *      trial from this same study was already applied — the diff being reviewed
 *      is not the diff that would land, so the write is refused.
 *   3. **A surgical edit, not a reserialization.** `JSON.stringify` would
 *      reformat every data file it touched (the repo's JSON keeps hand-authored
 *      one-line objects, and `1.0` would come back as `1`), burying a two-number
 *      tuning in a thousand-line diff. Instead the raw text is scanned to the
 *      exact span of the target value and only those characters are replaced —
 *      so the git diff of a calibration commit is one line per tuned key, which
 *      is the whole point of the #105 review protocol.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { applyOverride, dataFilePath, positionalPath, readTunable } from './overrides';
import { dimensionById, type Candidate, type Dimension } from './searchSpace';

const REPO_ROOT = join(__dirname, '..', '..');

export interface PlannedEdit {
  readonly id: string;
  readonly file: string;
  readonly path: string;
  readonly current: number;
  readonly next: number;
}

export interface ApplyOptions {
  /** Without this, nothing is written. */
  readonly confirm: boolean;
  /** The values the study measured its diff against, per dimension id. */
  readonly baseline?: Candidate;
}

export class ApplyRefused extends Error {}

// ── JSON text surgery ────────────────────────────────────────────────────────

const WHITESPACE = /\s/;

function skipWhitespace(text: string, pos: number): number {
  while (pos < text.length && WHITESPACE.test(text[pos])) pos++;
  return pos;
}

/** Position just past the string literal starting at `pos`. */
function endOfString(text: string, pos: number): number {
  let i = pos + 1;
  while (i < text.length) {
    if (text[i] === '\\') {
      i += 2;
      continue;
    }
    if (text[i] === '"') return i + 1;
    i++;
  }
  throw new Error('Unterminated string in JSON');
}

/** Position just past the complete JSON value starting at `pos`. */
function endOfValue(text: string, pos: number): number {
  const ch = text[pos];
  if (ch === '"') return endOfString(text, pos);
  if (ch === '{' || ch === '[') {
    const close = ch === '{' ? '}' : ']';
    let depth = 0;
    let i = pos;
    while (i < text.length) {
      const c = text[i];
      if (c === '"') {
        i = endOfString(text, i);
        continue;
      }
      if (c === ch) depth++;
      else if (c === close) {
        depth--;
        if (depth === 0) return i + 1;
      }
      i++;
    }
    throw new Error('Unterminated object or array in JSON');
  }
  let i = pos;
  while (i < text.length && !/[,}\]\s]/.test(text[i])) i++;
  return i;
}

/** Start of the value under `key` in the object beginning at `pos`. */
function memberStart(text: string, pos: number, key: string): number {
  let i = skipWhitespace(text, pos);
  if (text[i] !== '{') throw new Error(`Expected an object at offset ${i}`);
  i = skipWhitespace(text, i + 1);
  while (i < text.length && text[i] !== '}') {
    const keyEnd = endOfString(text, i);
    const name = JSON.parse(text.slice(i, keyEnd)) as string;
    i = skipWhitespace(text, keyEnd);
    if (text[i] !== ':') throw new Error(`Expected ':' at offset ${i}`);
    const valueStart = skipWhitespace(text, i + 1);
    if (name === key) return valueStart;
    i = skipWhitespace(text, endOfValue(text, valueStart));
    if (text[i] === ',') i = skipWhitespace(text, i + 1);
  }
  throw new Error(`Key '${key}' not found`);
}

/** Start of element `index` in the array beginning at `pos`. */
function elementStart(text: string, pos: number, index: number): number {
  let i = skipWhitespace(text, pos);
  if (text[i] !== '[') throw new Error(`Expected an array at offset ${i}`);
  i = skipWhitespace(text, i + 1);
  for (let n = 0; i < text.length && text[i] !== ']'; n++) {
    if (n === index) return i;
    i = skipWhitespace(text, endOfValue(text, i));
    if (text[i] === ',') i = skipWhitespace(text, i + 1);
  }
  throw new Error(`Array index ${index} out of range`);
}

/**
 * The `[start, end)` span of the numeric value at a positional dotted path.
 * Selectors (`unlocks[id=auction_data]`) are resolved to indices by
 * `positionalPath` before this is called — a text scanner has no way to know
 * which field identifies an array element.
 */
export function findValueSpan(text: string, positional: string): { start: number; end: number } {
  let pos = skipWhitespace(text, 0);
  const parts = positional.split('.');
  for (const part of parts) {
    const isIndex = /^\d+$/.test(part);
    pos = isIndex && text[pos] === '[' ? elementStart(text, pos, Number(part)) : memberStart(text, pos, part);
  }
  return { start: pos, end: endOfValue(text, pos) };
}

/** Replace one numeric value in raw JSON text, leaving every other byte alone. */
export function replaceValueInText(text: string, positional: string, value: number): string {
  const { start, end } = findValueSpan(text, positional);
  const existing = text.slice(start, end);
  if (!Number.isFinite(Number(existing))) {
    throw new Error(`Path '${positional}' does not address a number (found ${existing}).`);
  }
  return text.slice(0, start) + String(value) + text.slice(end);
}

// ── The gated write ──────────────────────────────────────────────────────────

export function planEdits(candidate: Candidate, dims: readonly Dimension[]): PlannedEdit[] {
  const edits: PlannedEdit[] = [];
  for (const [id, next] of Object.entries(candidate)) {
    const dim = dimensionById(id, dims);
    const current = readTunable(dim.file, dim.path);
    if (Object.is(current, next)) continue;
    edits.push({ id, file: dim.file, path: dim.path, current, next });
  }
  return edits.sort((a, b) => (a.file + a.path).localeCompare(b.file + b.path));
}

/**
 * Write a candidate into `data/**`. Refuses without `confirm`, and refuses if
 * disk has drifted from the baseline the study measured against.
 */
export function applyCandidateToDisk(
  candidate: Candidate,
  dims: readonly Dimension[],
  opts: ApplyOptions,
): PlannedEdit[] {
  if (opts.baseline) {
    const drifted: string[] = [];
    for (const [id, was] of Object.entries(opts.baseline)) {
      const dim = dimensionById(id, dims);
      const now = readTunable(dim.file, dim.path);
      if (!Object.is(was, now)) drifted.push(`${dim.file}:${dim.path} ${was} → ${now}`);
    }
    if (drifted.length > 0) {
      throw new ApplyRefused(
        'Refusing to apply: data/** has changed since this study was opened, so the ' +
          'reviewed diff is not the diff that would land. Re-run the study against the ' +
          `current values. Drifted:\n  ${drifted.join('\n  ')}`,
      );
    }
  }

  const edits = planEdits(candidate, dims);
  if (!opts.confirm) {
    throw new ApplyRefused(
      'Refusing to apply without --confirm. Nothing was written. ' +
        `Re-run with --confirm to write ${edits.length} value(s) into data/**.`,
    );
  }

  for (const edit of edits) {
    const diskPath = join(REPO_ROOT, dataFilePath(edit.file));
    const text = readFileSync(diskPath, 'utf8');
    const positional = positionalPath(edit.file, edit.path);
    writeFileSync(diskPath, replaceValueInText(text, positional, edit.next));
    // Keep the loaders' in-memory object in step with disk. The CLI exits right
    // after this, but a stale in-memory value that disagrees with the file just
    // written is the kind of inconsistency that costs someone an afternoon.
    applyOverride(edit.file, edit.path, edit.next);
  }
  return edits;
}
