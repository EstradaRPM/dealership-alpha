#!/usr/bin/env node
/**
 * PostToolUse (Edit | Write | MultiEdit) — typecheck the change that caused it,
 * and record the touch for the Stop hook.
 *
 * Type errors used to surface at the end of a session, attached to whatever the
 * agent happened to be doing then. Here they land on the edit that introduced
 * them.
 *
 * The check is incremental (`tsc --noEmit --incremental`) with its build-info
 * parked in the ignored session-state dir: ~6.5s cold, ~3.4s warm, so a burst of
 * edits stays tolerable. The build-info file is never committed and never shared
 * with `npm run typecheck`, which stays a clean full check.
 */
import { spawnSync } from 'node:child_process';
import {
  readHookInput,
  toRepoRelative,
  block,
  allow,
  readSessionState,
  updateSessionState,
  PROJECT_DIR,
  TSBUILDINFO,
  STATE_DIR,
} from './lib/hookIo.mjs';
import fs from 'node:fs';
import path from 'node:path';

const input = await readHookInput();
const filePath = toRepoRelative(input.tool_input?.file_path);
if (!filePath) allow();

const sessionId = input.session_id;
const state = readSessionState(sessionId);
const touched = new Set(state.touched ?? []);
touched.add(filePath);
updateSessionState(sessionId, {
  touched: [...touched],
  buildStateUpdated:
    state.buildStateUpdated || filePath === 'docs/planning/build-state.md',
});

// Only source changes can break the type graph.
if (!/^src\/.*\.tsx?$/.test(filePath)) allow();

fs.mkdirSync(STATE_DIR, { recursive: true });

// tsc is invoked as a plain JS entrypoint under the current node, never through
// `npx`: on Windows, Node refuses to spawn a `.cmd` shim without `shell: true`,
// which made an earlier version of this hook exit 0 on every broken file.
const tsc = path.join(PROJECT_DIR, 'node_modules', 'typescript', 'bin', 'tsc');
if (!fs.existsSync(tsc)) {
  block(
    `The typecheck hook could not find node_modules/typescript/bin/tsc, so ${filePath} was ` +
      `NOT typechecked. Run \`npm ci\` — a hook that cannot run must say so rather than pass silently.`,
  );
}

const result = spawnSync(
  process.execPath,
  [tsc, '--noEmit', '--incremental', '--tsBuildInfoFile', TSBUILDINFO],
  { cwd: PROJECT_DIR, encoding: 'utf8', timeout: 120_000 },
);

if (result.status === 0) allow();

const output = `${result.stdout ?? ''}${result.stderr ?? ''}${result.error ? String(result.error) : ''}`.trim();
if (result.status === null) {
  block(`The typecheck hook failed to run after editing ${filePath} (no exit status):\n${output.slice(0, 1000)}`);
}

block(
  `Typecheck failed after editing ${filePath}:\n\n${output.slice(0, 4000)}\n\n` +
    `Fix this before moving on — it was introduced by the edit just made.`,
);
