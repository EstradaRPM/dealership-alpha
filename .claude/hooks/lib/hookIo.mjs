/**
 * Shared plumbing for the repo's Claude Code hooks.
 *
 * Every hook is a Node script so the same file runs under Git Bash, cmd.exe and
 * PowerShell — the three shells this repo gets driven from. Hooks read one JSON
 * object on stdin and signal back with an exit code:
 *
 *   0  proceed silently
 *   2  block / interrupt, with the reason on stderr (fed back to the agent)
 *
 * Project root is derived from this file's own location, never from cwd, so a
 * hook invoked from a subdirectory still resolves repo-relative paths.
 */
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Absolute path to the repo root (`.claude/hooks/lib` → up three). */
export const PROJECT_DIR = path.resolve(here, '..', '..', '..');

/** Reads the hook payload JSON from stdin. Returns `{}` if stdin is empty. */
export async function readHookInput() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/** Repo-relative POSIX path for an absolute-or-relative file path, or null if outside the repo. */
export function toRepoRelative(filePath) {
  if (!filePath) return null;
  const abs = path.isAbsolute(filePath) ? filePath : path.resolve(PROJECT_DIR, filePath);
  const rel = path.relative(PROJECT_DIR, abs);
  if (!rel || rel.startsWith('..')) return null;
  return rel.split(path.sep).join('/');
}

/** Blocks the tool call / stop, handing `message` back to the agent. Never returns. */
export function block(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

/** Proceeds silently. Never returns. */
export function allow() {
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Per-session scratch state
//
// The Stop hook needs to know what happened earlier in the same session (was
// src/ touched? was the suite run?). Hook processes are one-shot, so the facts
// are accumulated in a small JSON file keyed by session id, under an ignored
// directory. Nothing here is load-bearing for the game — if it is lost the Stop
// hook simply has less to assert.
// ---------------------------------------------------------------------------

const STATE_DIR = path.join(PROJECT_DIR, '.claude', '.session-state');

function stateFile(sessionId) {
  const safe = String(sessionId || 'unknown').replace(/[^A-Za-z0-9_-]/g, '_');
  return path.join(STATE_DIR, `${safe}.json`);
}

export function readSessionState(sessionId) {
  try {
    return JSON.parse(fs.readFileSync(stateFile(sessionId), 'utf8'));
  } catch {
    return {};
  }
}

/** Merges `patch` into the session's state and returns the merged object. */
export function updateSessionState(sessionId, patch) {
  const next = { ...readSessionState(sessionId), ...patch };
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.writeFileSync(stateFile(sessionId), JSON.stringify(next, null, 2));
  } catch {
    // A hook must never fail the session over its own bookkeeping.
  }
  return next;
}

/** Absolute path of the incremental tsbuildinfo the typecheck hook reuses. */
export const TSBUILDINFO = path.join(STATE_DIR, 'hook-typecheck.tsbuildinfo');

export { STATE_DIR };
