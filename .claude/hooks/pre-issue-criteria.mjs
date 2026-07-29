#!/usr/bin/env node
/**
 * PreToolUse (Bash | PowerShell) — every filed slice carries EARS acceptance criteria.
 *
 * `gh issue create` is the moment the convention either holds or is silently
 * skipped, and it is skipped by forgetting rather than by deciding. So the check
 * runs here, outside the model's attention: a create whose body has no
 * "Acceptance criteria (EARS)" section — or whose criteria are prose — is blocked
 * with the five patterns in the message.
 *
 * Applies to new issues only. Existing issues were written against a working
 * convention and rewriting them would change agreed scope silently (#337), so
 * `gh issue edit` is not judged.
 */
import fs from 'node:fs';
import path from 'node:path';
import { readHookInput, block, allow, PROJECT_DIR } from './lib/hookIo.mjs';
import { checkCriteria, explain } from './lib/earsCriteria.mjs';

const input = await readHookInput();
const command = String(input.tool_input?.command ?? '');
if (!command) allow();

// Only a create the shell will actually run counts. A mention of the words inside
// a quoted string — a grep, a script body, a commit message or a doc about this very
// hook — is preceded by something other than a command separator and is left alone.
// A backtick is deliberately NOT a separator here: legacy `cmd` substitution is
// vanishingly rare next to markdown inline code, and treating it as one blocked this
// hook's own commit message.
const CREATE = /\bgh\s+issue\s+create\b/g;
const RUNS_HERE = /(^|[\n;&|({])[ \t]*$/;
const starts = [];
for (let m = CREATE.exec(command); m; m = CREATE.exec(command)) {
  if (RUNS_HERE.test(command.slice(0, m.index))) starts.push(m.index);
}
if (starts.length === 0) allow();

const BODY_FILE = /(?:--body-file|-F)[=\s]+("[^"]+"|'[^']+'|\S+)/g;
const cwd = input.cwd && fs.existsSync(input.cwd) ? input.cwd : PROJECT_DIR;

/** The command slice for one create, plus the contents of any body file it names. */
function textFor(index, i) {
  const slice = command.slice(index, starts[i + 1] ?? command.length);
  // An inline body starts on the same line as the flag, so its first markdown
  // heading would not sit at the start of a line. Break the line at the opening
  // quote so the body is parsed as the document it is.
  const parts = [slice.replace(/(--body|-b)([=\s]+)(["'$]*)/g, '$1$2$3\n')];
  for (let m = BODY_FILE.exec(slice); m; m = BODY_FILE.exec(slice)) {
    const raw = m[1].replace(/^['"]|['"]$/g, '');
    if (raw === '-') continue; // body on stdin — nothing to read here
    try {
      parts.push(fs.readFileSync(path.isAbsolute(raw) ? raw : path.resolve(cwd, raw), 'utf8'));
    } catch {
      // Unreadable body file: judged on the command text alone, which will fail
      // the check and say so rather than waving the create through.
    }
  }
  BODY_FILE.lastIndex = 0;
  return parts.join('\n');
}

for (const [i, index] of starts.entries()) {
  const text = textFor(index, i);
  // `gh issue create --help` files nothing.
  if (/^gh\s+issue\s+create\s+(?:--help|-h)\b/.test(text)) continue;
  const result = checkCriteria(text);
  if (!result.ok) block(explain(result));
}

allow();
