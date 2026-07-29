#!/usr/bin/env node
/**
 * PostToolUse (Bash | PowerShell) — note which verification commands actually ran.
 *
 * The Stop hook asserts "if src/ or data/ changed, the suite was run". That claim
 * needs evidence, and seeing the command go by is most of it — but not all of it.
 * A run that matched zero test files is not a run: Jest can report "No tests
 * found" (or be waved through with --passWithNoTests) and the session would still
 * be credited with a green suite it never executed. So the command is checked
 * against its own output, and a demonstrably empty run earns no credit.
 *
 * The check only ever *withholds* credit on positive evidence of emptiness. If
 * the output cannot be read, the command alone still counts — a hook that nags
 * through every session because it could not see stdout is worse than one that
 * occasionally trusts too much. This hook blocks nothing either way.
 */
import { readHookInput, allow, readSessionState, updateSessionState } from './lib/hookIo.mjs';

const input = await readHookInput();
const command = String(input.tool_input?.command ?? '');
if (!command) allow();

const sessionId = input.session_id;
const state = readSessionState(sessionId);

const ranSuite = /\bnpm\s+(run\s+)?test\b|\bnpx\s+jest\b|\bjest\b/.test(command);
const ranTypecheck = /\bnpm\s+run\s+typecheck\b|\btsc\s+--noEmit\b/.test(command);

/** Bash/PowerShell responses arrive as a string or as `{ stdout, stderr }`. */
function responseText(response) {
  if (typeof response === 'string') return response;
  if (!response || typeof response !== 'object') return '';
  return [response.stdout, response.stderr, response.output]
    .filter((part) => typeof part === 'string')
    .join('\n');
}

/** True only when the output positively shows the run executed no tests. */
function ranNoTests(text) {
  if (!text) return false;
  if (/No tests found/i.test(text)) return true;
  if (/\bTests:\s+0 total/.test(text)) return true;
  if (/\bTest Suites:\s+0 total/.test(text)) return true;
  return false;
}

const suiteWasEmpty = ranSuite && ranNoTests(responseText(input.tool_response));

if (ranSuite || ranTypecheck) {
  updateSessionState(sessionId, {
    suiteRun: state.suiteRun || (ranSuite && !suiteWasEmpty),
    typecheckRun: state.typecheckRun || ranTypecheck,
  });
}

allow();
