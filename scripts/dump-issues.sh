#!/usr/bin/env bash
# Regenerate ISSUES.md — a local, gitignored snapshot of open GitHub issues
# for offline reading / note-taking. GitHub remains the source of truth.
#
# NOTE FOR AGENTS: do NOT Read this file whole — it is ~1.3k lines / ~15-20K
# tokens. For a single issue, prefer `gh issue view <N>`. For the open list,
# `gh issue list --state open --limit 200`. Read ISSUES.md only when the user
# explicitly asks for offline notes or scratch content.
set -euo pipefail

OUT="ISSUES.md"

{
  echo "# Open Issues — dealership-alpha"
  echo
  echo "**Snapshot:** $(date '+%Y-%m-%d %H:%M %Z')"
  echo "**Source of truth:** https://github.com/EstradaRPM/dealership-alpha/issues"
  echo "**Regenerate:** \`bash scripts/dump-issues.sh\`"
  echo
  echo "This file is **gitignored** — your notes here are local-only. GitHub is authoritative; this is for offline reading and scribbling."
  echo

  gh issue list --state open --limit 200 --json number,title,labels,body --jq '
    sort_by(.number) | .[] |
    "---\n\n## #\(.number) — \(.title)\n\n" +
    (if (.labels | length) > 0 then "**Labels:** " + (.labels | map(.name) | join(", ")) + "\n\n" else "" end) +
    .body + "\n"
  '
} > "$OUT"

echo "Wrote $OUT ($(wc -l < "$OUT") lines)"
