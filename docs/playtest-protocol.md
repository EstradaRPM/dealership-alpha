# Playtest Protocol

How to playtest this build in a way that produces evidence, not vibes. Read before each session. Update when the protocol itself proves wrong.

## Why structure

Solo-dev playtesting fails by default: you know the systems, so you unconsciously route around weak spots and rationalize whatever happens. Structure exists to counter that. If a session doesn't follow the protocol, its findings are suspect.

## Pre-session: pre-register hypotheses

Before launching the app, open a new file in `playtests/` (template below) and write 3–5 **falsifiable** claims about what should happen. Examples:

- "Tier 1 players reach paved lot in 5–7 game days at default difficulty."
- "F&I attach hovers 40–60% with default staff and no manual coaching."
- "Average close rate for Analytical archetype is 20–40% below Impulsive."

If you can't state a hypothesis as a number or a comparison, it's not testable — rewrite it.

Pre-registration is the single most important step. It prevents the post-hoc "yeah that's about what I expected" reflex.

## Persona rotation

Don't play as "you who built this." Rotate one persona per session:

- **Min-maxer** — exploits every mechanic, looks for degenerate strategies. Tests whether the optimal path collapses to a single dominant strategy.
- **Roleplayer** — makes "realistic dealer" choices even when suboptimal. Tests whether the sim *rewards* immersion or punishes it.
- **Tourist** — clicks intuitively, ignores tooltips, no domain knowledge. Tests onboarding and legibility.

Note the persona at the top of the session file. Findings differ wildly per persona — that's the signal.

## During session: think-aloud + record

- Screen record + voice narrate. Say confusion, hesitation, "wait, why did that happen?" out loud in real time.
- Don't fix anything mid-session. Don't open the code. Note it and continue.
- Keep the session under ~30 minutes. Longer sessions produce diminishing returns and erode the persona.

## Telemetry export

At session end, export the session log from the admin console (issue #61). The exported metrics are the source of truth for hypothesis verification — your impressions during play are secondary.

## Post-session: RITE loop

**Rapid Iterative Testing & Evaluation:**

1. Identify the **single most painful** issue from the session.
2. Fix it (or file the issue and fix the next session's blocker).
3. Run the next session.

Do NOT accumulate a 30-item bug list across 10 sessions and then triage. You'll fix the wrong things first. Fix-then-test keeps each session's findings load-bearing.

Findings that aren't fixed immediately become GitHub issues, triaged like any other work.

## The 7-day cohort test

Periodically, play one save for 7 in-game days across multiple sessions. At the end, ask: **would I open the app tomorrow?**

If no, the *retention loop* is broken, not the mechanics. This is the question that separates "interesting prototype" from "premium product worth paying for." It cannot be answered by a single 30-minute session.

## The premium gut check

Maintain a running "this would embarrass me to ship" list (in `playtests/embarrass-list.md`). Don't fix items immediately — let the list grow for a week. The patterns tell you what your standards actually are, vs. what you say they are.

## Anti-patterns

- **Playing without pre-registering hypotheses.** That's vibing, not testing.
- **Fixing bugs mid-session.** Breaks the persona, destroys the data.
- **Reading telemetry before writing impressions.** You'll anchor on the numbers and lose the felt experience.
- **Skipping the Tourist persona because it's frustrating.** That frustration is the data.
- **Letting the bug list grow indefinitely.** RITE > big-bang triage.
