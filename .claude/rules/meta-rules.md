---
paths: [".claude/rules/**"]
---

# Editing the rules themselves (#336)

Files in `.claude/rules/` are loaded by Claude Code, not by the app. Three properties make
them worth having, and each is easy to break:

1. **Every file here must carry `paths:` frontmatter.** A rule file with no `paths:` (or with
   `paths: ["**"]`) loads into *every* session, which is exactly the always-on context cost
   these exist to remove. `tests/claude-rules.test.ts` fails the build if one appears.
   The patterns are gitignore-style globs matched against repo-relative paths; a trailing
   `/**` is optional.
2. **Rules point at the existing doc, they do not restate it.** The per-module
   `src/game/<Module>/CLAUDE.md`, `src/ui/kit/CLAUDE.md`, `docs/*-recipe.md` and the planning
   docs stay the single source; a rule's job is to make the right one load at the right
   moment. A constraint copied into two places drifts, and the copy in the rule wins by
   accident. `tests/claude-rules.test.ts` also checks that every repo path a rule references
   still exists.
3. **A rule states a standing constraint, not a procedure.** A multi-step procedure belongs in
   a skill (`.claude/skills/`); an automatic "every time X, never Y" belongs in a hook
   (`.claude/hooks/`) where it fires outside the model's control. Reach for a rule only when
   the thing is context an agent needs *while editing a particular area*.

Do not add a `README.md` to this directory — it would be loaded as an unscoped rule.
