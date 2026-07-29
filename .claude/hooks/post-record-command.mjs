#!/usr/bin/env node
/**
 * PostToolUse (Bash | PowerShell) — note which verification commands actually ran.
 *
 * The Stop hook asserts "if src/ or data/ changed, the suite was run". That claim
 * needs evidence, and the only honest evidence is having seen the command go by.
 * This hook records nothing else and blocks nothing.
 */
import { readHookInput, allow, readSessionState, updateSessionState } from './lib/hookIo.mjs';

const input = await readHookInput();
const command = String(input.tool_input?.command ?? '');
if (!command) allow();

const sessionId = input.session_id;
const state = readSessionState(sessionId);

const ranSuite = /\bnpm\s+(run\s+)?test\b|\bnpx\s+jest\b|\bjest\b/.test(command);
const ranTypecheck = /\bnpm\s+run\s+typecheck\b|\btsc\s+--noEmit\b/.test(command);

if (ranSuite || ranTypecheck) {
  updateSessionState(sessionId, {
    suiteRun: state.suiteRun || ranSuite,
    typecheckRun: state.typecheckRun || ranTypecheck,
  });
}

allow();
