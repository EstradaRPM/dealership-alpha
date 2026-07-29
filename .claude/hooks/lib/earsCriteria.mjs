/**
 * EARS acceptance-criteria parsing (#337).
 *
 * EARS is five sentence patterns that force the trigger and the required response
 * to be explicit, so a criterion is directly testable:
 *
 *   ubiquitous        The system shall <response>.
 *   event-driven      When <trigger>, the system shall <response>.
 *   state-driven      While <state>, the system shall <response>.
 *   unwanted          If <condition>, then the system shall <response>.
 *   optional feature  Where <feature is present>, the system shall <response>.
 *
 * The convention lives in docs/agent-handoff.md; this module is what makes it
 * checkable rather than remembered.
 */

const HEADING = /^(#{1,6})\s+(.*)$/;
const CRITERIA_HEADING = /acceptance\s+criteria/i;
const BULLET = /^(\s*)(?:[-*+]|\d+[.)])\s+(.*)$/;

/** True if the text contains a heading that opens an acceptance-criteria section. */
export function hasCriteriaHeading(text) {
  return String(text ?? '')
    .split(/\r?\n/)
    .some((line) => {
      const m = HEADING.exec(line);
      return Boolean(m && CRITERIA_HEADING.test(m[2]));
    });
}

/**
 * Returns the lines of the first acceptance-criteria section, or null if the text
 * has no such heading. The section runs to the next heading at the same level or
 * higher — a deeper sub-heading stays inside it.
 */
export function extractCriteriaSection(text) {
  const lines = String(text ?? '').split(/\r?\n/);
  let level = null;
  const body = [];
  for (const line of lines) {
    const m = HEADING.exec(line);
    if (level === null) {
      if (m && CRITERIA_HEADING.test(m[2])) level = m[1].length;
      continue;
    }
    if (m && m[1].length <= level) break;
    body.push(line);
  }
  return level === null ? null : body;
}

/** Which of the five EARS patterns `sentence` matches, or null if it matches none. */
export function classify(sentence) {
  const s = String(sentence ?? '').trim();
  if (!/\bshall\b/i.test(s)) return null;
  if (/^when\b/i.test(s)) return 'event-driven';
  if (/^while\b/i.test(s)) return 'state-driven';
  if (/^if\b/i.test(s)) return /\bthen\b/i.test(s) ? 'unwanted' : null;
  if (/^where\b/i.test(s)) return 'optional';
  return 'ubiquitous';
}

/**
 * Checks an issue body against the convention.
 *
 * Only TOP-LEVEL bullets in the section are judged — indented sub-bullets carry
 * the test mapping and other detail, and a criterion's supporting notes are not
 * themselves criteria.
 *
 * @returns {{ ok: boolean, reason: 'missing-section'|'no-criteria'|'prose-criteria'|null,
 *            criteria: string[], offenders: string[] }}
 */
export function checkCriteria(text) {
  const section = extractCriteriaSection(text);
  if (section === null) return { ok: false, reason: 'missing-section', criteria: [], offenders: [] };

  const criteria = [];
  const offenders = [];
  let current = null; // a top-level bullet may wrap onto continuation lines

  const settle = () => {
    if (current === null) return;
    const sentence = current.replace(/\s+/g, ' ').trim();
    if (classify(sentence)) criteria.push(sentence);
    else offenders.push(sentence);
    current = null;
  };

  for (const line of section) {
    const m = BULLET.exec(line);
    if (m) {
      const indented = m[1].length >= 2;
      if (indented) continue; // sub-bullet: detail, not a criterion
      settle();
      current = m[2];
      continue;
    }
    if (!line.trim()) {
      settle();
      continue;
    }
    if (current !== null && /^\s+\S/.test(line)) current += ` ${line.trim()}`;
    else settle();
  }
  settle();

  if (criteria.length === 0 && offenders.length === 0)
    return { ok: false, reason: 'no-criteria', criteria, offenders };
  if (offenders.length > 0) return { ok: false, reason: 'prose-criteria', criteria, offenders };
  return { ok: true, reason: null, criteria, offenders };
}

/** The block message for a failed check — the five patterns plus what was wrong. */
export function explain(result) {
  const patterns =
    `The five EARS patterns (docs/agent-handoff.md § "Acceptance criteria (EARS)"):\n` +
    `  ubiquitous    The system shall <response>.\n` +
    `  event-driven  When <trigger>, the system shall <response>.\n` +
    `  state-driven  While <state>, the system shall <response>.\n` +
    `  unwanted      If <condition>, then the system shall <response>.\n` +
    `  optional      Where <feature is present>, the system shall <response>.\n` +
    `Each criterion must map to at least one test that fails when the criterion is unmet.`;

  if (result.reason === 'missing-section')
    return (
      `BLOCKED — this issue has no "Acceptance criteria (EARS)" section.\n` +
      `On an AFK slice the issue body is the entire brief: the implementing session reads the ` +
      `issue, the recipes, and the touched module's CLAUDE.md, and nothing else. Criteria left ` +
      `implicit are where a slice quietly builds the adjacent thing.\n\n${patterns}`
    );

  if (result.reason === 'no-criteria')
    return (
      `BLOCKED — the acceptance-criteria section is empty. File at least one criterion.\n\n${patterns}`
    );

  const shown = result.offenders.slice(0, 5).map((o) => `  - ${o.slice(0, 160)}`);
  return (
    `BLOCKED — ${result.offenders.length} acceptance criterion/criteria are prose, not EARS:\n` +
    `${shown.join('\n')}\n\n` +
    `Restate each as one of the five patterns, or move it out of the criteria section if it ` +
    `is context rather than a criterion (indented sub-bullets are exempt — use them for the ` +
    `test mapping).\n\n${patterns}`
  );
}
