/**
 * Jest configuration.
 *
 * This lives in its own file, and deliberately keeps the project's path out of
 * every glob.
 *
 * `testMatch` entries are globs, and Jest substitutes `<rootDir>` into them and
 * then runs the result through `replacePathSepForGlob`, which rewrites `\` to
 * `/` *except* when the next character is a glob metacharacter. A checkout under
 * a dot-directory — a git worktree at `.claude/worktrees/<name>` — therefore came
 * out as `...dealership-alpha\.claude/worktrees/...`: micromatch read the `\.` as
 * an escaped literal dot, so the glob wanted a `dealership-alpha.claude` segment
 * that does not exist and matched zero files. `npm test` in a worktree found no
 * tests at all.
 *
 * The fix is to put no path text in a glob. `roots` is a path option — resolved,
 * never globbed — so it scopes the crawl safely, and `testMatch` stays relative.
 * Scoping to `tests/` and `src/` also keeps a run in the main checkout from
 * crawling sibling worktrees under `.claude/`.
 */
module.exports = {
  preset: 'jest-expo',
  rootDir: __dirname,
  roots: ['<rootDir>/tests', '<rootDir>/src'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testTimeout: 20000,
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
};
