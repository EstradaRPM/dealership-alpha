#!/usr/bin/env node
/**
 * Drives every hook the way Claude Code drives it — a JSON payload on stdin, an
 * exit code back — and asserts the exit code.
 *
 * The point is the negative cases. A hook that silently no-ops is worse than no
 * hook at all: it makes a rule look enforced when it isn't. Run with:
 *
 *   npm run hooks:test
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const HOOKS = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(HOOKS, '..', '..');
const SESSION = `selftest-${process.pid}`;

let failures = 0;

function run(hook, payload) {
  const result = spawnSync(process.execPath, [path.join(HOOKS, hook)], {
    input: JSON.stringify({ session_id: SESSION, cwd: PROJECT, ...payload }),
    cwd: PROJECT,
    encoding: 'utf8',
    timeout: 180_000,
  });
  return { status: result.status, stderr: (result.stderr ?? '').trim() };
}

function expect(label, actual, wanted, extra) {
  const ok = actual.status === wanted && (!extra || extra(actual));
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label} (exit ${actual.status}, wanted ${wanted})`);
  if (!ok) {
    failures += 1;
    if (actual.stderr) console.log(`      ${actual.stderr.split('\n')[0]}`);
  }
}

const abs = (rel) => path.join(PROJECT, rel.split('/').join(path.sep));

// --- 1. module boundary -----------------------------------------------------

expect(
  'boundary: blocks a reach-in past another module barrel',
  run('pre-module-boundary.mjs', {
    tool_name: 'Write',
    tool_input: {
      file_path: abs('src/game/Economy/probe.ts'),
      content: "import { createRng } from '../NPC/Rng';\n",
    },
  }),
  2,
  (r) => r.stderr.includes('src/game/NPC/index.ts'),
);

expect(
  'boundary: allows the barrel import',
  run('pre-module-boundary.mjs', {
    tool_name: 'Write',
    tool_input: {
      file_path: abs('src/game/Economy/probe.ts'),
      content: "import { createStaff } from '../NPC';\n",
    },
  }),
  0,
);

expect(
  'boundary: allows an explicit .../index import',
  run('pre-module-boundary.mjs', {
    tool_name: 'Write',
    tool_input: {
      file_path: abs('src/game/Economy/probe.ts'),
      content: "import { createStaff } from '../NPC/index';\n",
    },
  }),
  0,
);

expect(
  'boundary: allows a module reading its own internals',
  run('pre-module-boundary.mjs', {
    tool_name: 'Write',
    tool_input: {
      file_path: abs('src/game/NPC/probe.ts'),
      content: "import { createRng } from './Rng';\nimport x from './schemas/staff';\n",
    },
  }),
  0,
);

expect(
  'boundary: allows a bare package import',
  run('pre-module-boundary.mjs', {
    tool_name: 'Write',
    tool_input: { file_path: abs('src/game/Economy/probe.ts'), content: "import { z } from 'zod';\n" },
  }),
  0,
);

expect(
  'boundary: blocks the @/ alias form too',
  run('pre-module-boundary.mjs', {
    tool_name: 'Write',
    tool_input: {
      file_path: abs('src/ui/probe.ts'),
      content: "import { createRng } from '@/game/NPC/Rng';\n",
    },
  }),
  2,
);

expect(
  'boundary: an Edit is judged on new_string only',
  run('pre-module-boundary.mjs', {
    tool_name: 'Edit',
    tool_input: {
      file_path: abs('src/createWorld.ts'),
      old_string: 'const a = 1;',
      new_string: "import { publishNews } from './game/MarketEconomy/news';\n",
    },
  }),
  2,
);

expect(
  'boundary: grandfathered reach-in is not blocked',
  run('pre-module-boundary.mjs', {
    tool_name: 'Edit',
    tool_input: {
      file_path: abs('src/createWorld.ts'),
      old_string: 'x',
      new_string: "import { deriveSeed, createRng } from './game/NPC/Rng';\n",
    },
  }),
  0,
);

expect(
  'boundary: ignores non-source files',
  run('pre-module-boundary.mjs', {
    tool_name: 'Write',
    tool_input: { file_path: abs('docs/probe.md'), content: "from '../NPC/Rng'" },
  }),
  0,
);

expect(
  'boundary: the hooks tree is not judged by the rule it enforces',
  run('pre-module-boundary.mjs', {
    tool_name: 'Write',
    tool_input: { file_path: abs('.claude/hooks/probe.mjs'), content: "from '@/game/NPC/Rng'" },
  }),
  0,
);

// --- 2. save-envelope ritual ------------------------------------------------
// Fires once per session, so the state file is cleared between the two cases.

const stateFile = path.join(PROJECT, '.claude', '.session-state', `${SESSION}.json`);
const clearState = () => fs.rmSync(stateFile, { force: true });
const VERSION_CONST = ['WORLD', 'SNAPSHOT', 'VERSION'].join('_');
const envelopeEdit = {
  tool_name: 'Edit',
  tool_input: {
    file_path: abs('src/worldSnapshot.ts'),
    old_string: `export const ${VERSION_CONST} = 20;`,
    new_string: `export const ${VERSION_CONST} = 21;`,
  },
};

clearState();
expect(
  'envelope: interrupts an envelope bump with the re-stamp rule',
  run('pre-save-envelope.mjs', envelopeEdit),
  2,
  (r) => r.stderr.includes('gen:fixtures') && r.stderr.includes('tier-2.json'),
);

expect('envelope: the re-issued edit proceeds (once per session)', run('pre-save-envelope.mjs', envelopeEdit), 0);

clearState();
expect(
  'envelope: silent on an unrelated src edit',
  run('pre-save-envelope.mjs', {
    tool_name: 'Edit',
    tool_input: { file_path: abs('src/game/Economy/Economy.ts'), old_string: 'a', new_string: 'b' },
  }),
  0,
);

clearState();
expect(
  'envelope: silent outside the shipped trees',
  run('pre-save-envelope.mjs', {
    tool_name: 'Write',
    tool_input: { file_path: abs('.claude/hooks/probe.mjs'), content: envelopeEdit.tool_input.new_string },
  }),
  0,
);

clearState();
expect(
  'envelope: also fires on a fixture rewrite',
  run('pre-save-envelope.mjs', {
    tool_name: 'Write',
    tool_input: { file_path: abs('data/fixtures/tier-2.json'), content: '{}' },
  }),
  2,
);

// --- 3. post-tool recording + typecheck -------------------------------------

clearState();
expect(
  'typecheck hook: passes on the current (green) tree',
  run('post-typecheck.mjs', {
    tool_name: 'Edit',
    tool_input: { file_path: abs('src/worldSnapshot.ts') },
    tool_response: { success: true },
  }),
  0,
);

expect(
  'record: a docs-only write is tracked but not typechecked',
  run('post-typecheck.mjs', {
    tool_name: 'Edit',
    tool_input: { file_path: abs('docs/planning/build-state.md') },
  }),
  0,
);

// The negative case is the whole point: prove the hook actually reports a type
// error rather than exiting 0 on everything. A deliberately broken file is
// planted in src/, checked, and removed whatever happens.
const brokenFile = abs('src/__hook_selftest_broken.ts');
try {
  fs.writeFileSync(brokenFile, 'export const broken: number = "not a number";\n');
  expect(
    'typecheck hook: reports a real type error',
    run('post-typecheck.mjs', { tool_name: 'Write', tool_input: { file_path: brokenFile } }),
    2,
    (r) => r.stderr.includes('__hook_selftest_broken'),
  );
} finally {
  fs.rmSync(brokenFile, { force: true });
}

// --- 4. Stop hygiene --------------------------------------------------------

clearState();
fs.mkdirSync(path.dirname(stateFile), { recursive: true });
fs.writeFileSync(stateFile, JSON.stringify({ touched: ['src/game/Economy/Economy.ts'] }));
expect(
  'stop: reports an unverified src change',
  run('stop-session-hygiene.mjs', { hook_event_name: 'Stop', stop_hook_active: false }),
  2,
  (r) => r.stderr.includes('npm test') && r.stderr.includes('build-state.md'),
);

fs.writeFileSync(
  stateFile,
  JSON.stringify({ touched: ['src/game/Economy/Economy.ts'], suiteRun: true, buildStateUpdated: true }),
);
expect(
  'stop: silent once suite + build-state are accounted for',
  run('stop-session-hygiene.mjs', { hook_event_name: 'Stop', stop_hook_active: false }),
  0,
);

fs.writeFileSync(stateFile, JSON.stringify({ touched: ['docs/notes.md'] }));
expect(
  'stop: silent on a docs-only session',
  run('stop-session-hygiene.mjs', { hook_event_name: 'Stop', stop_hook_active: false }),
  0,
);

fs.writeFileSync(stateFile, JSON.stringify({ touched: ['src/game/Economy/Economy.ts'] }));
expect(
  'stop: never loops (stop_hook_active)',
  run('stop-session-hygiene.mjs', { hook_event_name: 'Stop', stop_hook_active: true }),
  0,
);

// --- 5. command recording ---------------------------------------------------

clearState();
run('post-record-command.mjs', { tool_name: 'Bash', tool_input: { command: 'npm test -- Economy' } });
const recorded = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
expect(
  'record: `npm test` marks the suite as run',
  { status: recorded.suiteRun === true ? 0 : 1, stderr: JSON.stringify(recorded) },
  0,
);

clearState();

// --- 6. EARS acceptance criteria on filed issues ----------------------------

const EARS_BODY = [
  '## Scope',
  'Wire the thing.',
  '',
  '## Acceptance criteria (EARS)',
  '',
  '- When a day closes with a gross above the standing mark, the system shall update',
  '  `bestDayGross` and emit `records:broken`.',
  '  - test: tests/records.test.ts "beats the standing day-gross mark"',
  '- While no mark has ever been set, the system shall report the mark as null.',
  '- If the day closes with zero units, then the system shall leave `bestPvr` unchanged.',
  '',
  '## Notes',
  'Nothing else.',
].join('\n');

const ghCreate = (body) => `gh issue create --title "Probe" --body "${body.replace(/"/g, '\\"')}"`;

expect(
  'issue criteria: allows a create carrying EARS criteria',
  run('pre-issue-criteria.mjs', { tool_name: 'Bash', tool_input: { command: ghCreate(EARS_BODY) } }),
  0,
);

expect(
  'issue criteria: blocks a create with no criteria section',
  run('pre-issue-criteria.mjs', {
    tool_name: 'Bash',
    tool_input: { command: 'gh issue create --title "Probe" --body "Just do the thing."' },
  }),
  2,
  (r) => r.stderr.includes('no "Acceptance criteria (EARS)" section'),
);

expect(
  'issue criteria: blocks prose criteria under the right heading',
  run('pre-issue-criteria.mjs', {
    tool_name: 'Bash',
    tool_input: {
      command: ghCreate(
        ['## Acceptance criteria (EARS)', '', '- The record updates when a day is better.'].join('\n'),
      ),
    },
  }),
  2,
  (r) => r.stderr.includes('prose, not EARS'),
);

expect(
  'issue criteria: reads the body out of --body-file',
  (() => {
    const bodyFile = path.join(PROJECT, `.claude/.session-state/selftest-body-${process.pid}.md`);
    fs.mkdirSync(path.dirname(bodyFile), { recursive: true });
    fs.writeFileSync(bodyFile, EARS_BODY);
    try {
      return run('pre-issue-criteria.mjs', {
        tool_name: 'Bash',
        tool_input: { command: `gh issue create --title "Probe" --body-file ${bodyFile}` },
      });
    } finally {
      fs.rmSync(bodyFile, { force: true });
    }
  })(),
  0,
);

expect(
  'issue criteria: a second chained create is judged on its own body',
  run('pre-issue-criteria.mjs', {
    tool_name: 'Bash',
    tool_input: { command: `${ghCreate(EARS_BODY)} && gh issue create --title "Probe 2" --body "no criteria"` },
  }),
  2,
);

expect(
  'issue criteria: reads a heredoc body',
  run('pre-issue-criteria.mjs', {
    tool_name: 'Bash',
    tool_input: { command: `gh issue create --title "Probe" --body "$(cat <<'EOF'\n${EARS_BODY}\nEOF\n)"` },
  }),
  0,
);

// The over-trigger guard: the words appear in plenty of commands that file nothing.
expect(
  'issue criteria: ignores the words inside a quoted string',
  run('pre-issue-criteria.mjs', {
    tool_name: 'Bash',
    tool_input: { command: `node -e "console.log('gh issue create --title x')"` },
  }),
  0,
);

expect(
  'issue criteria: ignores the words in markdown inline code (a commit message)',
  run('pre-issue-criteria.mjs', {
    tool_name: 'Bash',
    tool_input: {
      command: "git commit -F - <<'MSG'\nBlocks a `gh issue create` with no criteria.\nMSG",
    },
  }),
  0,
);

expect(
  'issue criteria: ignores a grep for the words',
  run('pre-issue-criteria.mjs', {
    tool_name: 'Bash',
    tool_input: { command: 'git log --oneline | grep "gh issue create"' },
  }),
  0,
);

expect(
  'issue criteria: silent on any other command',
  run('pre-issue-criteria.mjs', {
    tool_name: 'Bash',
    tool_input: { command: 'gh issue list --state open' },
  }),
  0,
);

expect(
  'issue criteria: never blocks an edit of an existing issue',
  run('pre-issue-criteria.mjs', {
    tool_name: 'Bash',
    tool_input: { command: 'gh issue edit 337 --body "prose only"' },
  }),
  0,
);

// --- 7. the repo itself still satisfies the rule ----------------------------

const scan = spawnSync(process.execPath, [path.join(HOOKS, 'scan-module-boundary.mjs')], {
  cwd: PROJECT,
  encoding: 'utf8',
});
expect('scan: repo has no un-allowed reach-ins', { status: scan.status, stderr: scan.stdout ?? '' }, 0);

console.log(failures === 0 ? '\nAll hook checks passed.' : `\n${failures} hook check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
