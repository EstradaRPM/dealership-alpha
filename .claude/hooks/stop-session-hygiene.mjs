#!/usr/bin/env node
/**
 * Stop — session hygiene.
 *
 * The /next contract says a BUILD session ends with the suite green, the change
 * committed, and build-state.md carrying the progress note. Two of those three
 * are checkable from what the session did, so they are checked here rather than
 * remembered.
 *
 * Fires at most once per stop chain (`stop_hook_active` guards the loop) and only
 * when src/ or data/ was actually modified — a read-only or docs-only session
 * ends silently.
 */
import { readHookInput, allow, block, readSessionState, updateSessionState } from './lib/hookIo.mjs';

const input = await readHookInput();
if (input.stop_hook_active) allow(); // already interrupted once; do not loop

const sessionId = input.session_id;
const state = readSessionState(sessionId);
const touched = state.touched ?? [];
const code = touched.filter((p) => /^(src|data)\//.test(p));
if (code.length === 0) allow();

const missing = [];
if (!state.suiteRun) missing.push('`npm test` was never run this session');
if (!state.buildStateUpdated) missing.push('`docs/planning/build-state.md` was not updated');
if (missing.length === 0) allow();

updateSessionState(sessionId, { hygieneReported: true });

const sample = code.slice(0, 8);
block(
  `Session hygiene — ${code.length} file(s) under src/ or data/ changed, but:\n` +
    `${missing.map((m) => `  - ${m}`).join('\n')}\n\n` +
    `Changed: ${sample.join(', ')}${code.length > sample.length ? `, +${code.length - sample.length} more` : ''}\n\n` +
    `Finish the unit: run the full suite, then record what landed in build-state.md ` +
    `(progress note, any new blocker, pointer if the phase closed). If this session ` +
    `deliberately isn't a /next unit, say so and stop again — this fires once.`,
);
