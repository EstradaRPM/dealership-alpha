#!/usr/bin/env node
/**
 * PreToolUse (Edit | Write | MultiEdit) — surface the save-envelope ritual.
 *
 * Bumping WORLD_SNAPSHOT_VERSION drags three other obligations with it, one of
 * which is a genuine trap: `npm run gen:fixtures` cannot reproduce
 * data/fixtures/tier-2.json (the harness bot game-overs around day 125, still at
 * tier 1, and writes nothing). The fixture is kept alive by migrating it in
 * place, not by regenerating it. That fact lives in docs/balance-harness-recipe.md
 * and gets re-derived from scratch every time it matters.
 *
 * The reminder is delivered as a one-time interrupt rather than a silent note:
 * a PreToolUse hook has no non-blocking channel that reliably reaches the agent,
 * and a reminder nobody reads is the failure mode being fixed. It fires at most
 * once per session — re-issue the same edit and it proceeds.
 */
import {
  readHookInput,
  toRepoRelative,
  block,
  allow,
  readSessionState,
  updateSessionState,
} from './lib/hookIo.mjs';

const input = await readHookInput();
const toolInput = input.tool_input ?? {};
const filePath = toRepoRelative(toolInput.file_path);
if (!filePath) allow();

// Only the shipped trees can carry the ritual. Hook sources and docs *describe*
// the envelope constant; they don't bump it.
if (!/^(src|data|tests|scripts)\//.test(filePath)) allow();

const pieces = [toolInput.content, toolInput.new_string, toolInput.old_string]
  .filter((p) => typeof p === 'string')
  .concat(
    Array.isArray(toolInput.edits)
      ? toolInput.edits.flatMap((e) => [e?.old_string, e?.new_string].filter((s) => typeof s === 'string'))
      : [],
  );
const text = pieces.join('\n');

const touchesEnvelope =
  /WORLD_SNAPSHOT_VERSION|WORLD_SNAPSHOT_MIGRATIONS/.test(text) ||
  /(^|\/)worldSnapshot[^/]*\.tsx?$/.test(filePath) ||
  /^data\/fixtures\//.test(filePath);
if (!touchesEnvelope) allow();

const sessionId = input.session_id;
if (readSessionState(sessionId).envelopeRitualShown) allow();
updateSessionState(sessionId, { envelopeRitualShown: true });

block(
  `REMINDER, not a rejection — re-issue this exact edit and it will proceed. ` +
    `Fires once per session.\n\n` +
    `You are touching the world-snapshot envelope (${filePath}). The full ritual ` +
    `(docs/save-migration-recipe.md):\n` +
    `  1. Bump WORLD_SNAPSHOT_VERSION only if the SET of \`modules\` keys changes. A change ` +
    `inside one module's blob is that module's own schemaVersion problem — leave the envelope alone.\n` +
    `  2. Register a migration keyed by the OLD version in WORLD_SNAPSHOT_MIGRATIONS, ` +
    `materializing a behavior-neutral default (prefer an exported createDefault*Snapshot() factory).\n` +
    `  3. Add the migration test in tests/worldSnapshot.test.ts ` +
    `(describe 'world-snapshot versioning + migrations (#196)'). Do not weaken the ` +
    `newer-runtime / missing-step throws.\n` +
    `  4. RE-STAMP data/fixtures/tier-2.json by MIGRATING IT IN PLACE — restore the fixture ` +
    `through the real migrate + restoreWorld path and re-capture with snapshotWorld. ` +
    `Do NOT run \`npm run gen:fixtures\`: under current tunables the harness bot goes bankrupt ` +
    `~day 125 still at tier 1, reaches neither T2 nor T3, and writes nothing. ` +
    `tests/tierFixtures.test.ts asserts the fixture sits at WORLD_SNAPSHOT_VERSION, so a ` +
    `forgotten re-stamp is a red suite, not a silent break.`,
);
