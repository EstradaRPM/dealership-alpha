#!/usr/bin/env node
/**
 * PreToolUse (Edit | Write | MultiEdit) — enforce the module-boundary convention.
 *
 * Root CLAUDE.md calls this the load-bearing architectural rule and then admits
 * "no lint rule enforces this — it is a review-time convention". This hook is the
 * enforcement, at write time, outside the model's control.
 *
 * Blocks a write whose new content imports past another module's `index.ts`
 * barrel. Pre-existing reach-ins are enumerated in module-boundary-allow.json so
 * only NEW debt is blocked.
 */
import fs from 'node:fs';
import path from 'node:path';
import { readHookInput, toRepoRelative, block, allow, PROJECT_DIR } from './lib/hookIo.mjs';
import { findBoundaryViolations } from './lib/moduleBoundary.mjs';

const input = await readHookInput();
const toolInput = input.tool_input ?? {};
const filePath = toRepoRelative(toolInput.file_path);
if (!filePath) allow();
// The hooks tree *describes* the rule (fixtures, messages); it isn't a consumer of
// the modules, so it is not judged by it. Everything else in the repo is.
if (filePath.startsWith('.claude/')) allow();

// Only the text being introduced is checked — an edit elsewhere in a file that
// already carries old debt must not be blocked by that old debt.
const pieces = [];
if (typeof toolInput.content === 'string') pieces.push(toolInput.content);
if (typeof toolInput.new_string === 'string') pieces.push(toolInput.new_string);
if (Array.isArray(toolInput.edits)) {
  for (const edit of toolInput.edits) {
    if (typeof edit?.new_string === 'string') pieces.push(edit.new_string);
  }
}
if (pieces.length === 0) allow();

let allowList = {};
try {
  allowList = JSON.parse(
    fs.readFileSync(path.join(PROJECT_DIR, '.claude', 'hooks', 'module-boundary-allow.json'), 'utf8'),
  ).allow ?? {};
} catch {
  // Missing allow-list means nothing is grandfathered — enforce the bare rule.
}

const violations = findBoundaryViolations({ filePath, content: pieces.join('\n'), allowList });
if (violations.length === 0) allow();

const lines = violations.map(
  (v) => `  '${v.specifier}' reaches into ${v.targetModule}'s internals — import from '${v.barrel}' instead.`,
);

block(
  `BLOCKED — module-boundary convention (root CLAUDE.md).\n` +
    `${filePath} would import past another module's barrel:\n` +
    `${lines.join('\n')}\n\n` +
    `Every module's public surface is its index.ts. If the symbol you need is not exported ` +
    `there, that is a public-surface decision: either re-export it from the barrel (and say ` +
    `so in the module's CLAUDE.md), or get what you need through the surface that already ` +
    `exists. Do not work around this by aliasing the path.\n` +
    `Accepted legacy reach-ins live in .claude/hooks/module-boundary-allow.json; that list ` +
    `is meant to shrink, not grow.`,
);
