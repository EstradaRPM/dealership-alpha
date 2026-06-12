# Second-Level IA — inside the locked 5-tab shell

**Status:** Design locked, 2026-06-12 (grill record — do not re-grill).
**Reads from:** `macro-loop-spine.md` (locked), `goals-targets-design.md` (locked), the fixed 5-tab nav decision (tabs never appear/disappear or tier-gate).
**Feeds:** every per-surface UI rebrand slice. A surface's home is answered by this doc's charters + rules, not by a new debate.

The 5 tabs themselves are settled and out of scope here. This doc decides what lives *inside* each tab, the sorting rules that auto-file future surfaces, and the navigation pattern between levels.

---

## 1. Tab charters (the sorting rule)

**Mnemonic: Home reads, Operations runs, People staff, Finance accounts, Growth compounds.**

| Tab | Charter | Filing test |
|---|---|---|
| **HOME** | Where do I stand — the day cycle's read-and-launch hub | Status you check between days. Home renders **glances only** and launches nothing but the day (§6). |
| **OPERATIONS** | Work **IN** the business — the store as a physical place | A department you walk into, or a pre-open policy lever (Prep). |
| **PEOPLE** | Who works it — the org | Roster, hiring, training/development, later retention/poaching and GM placement. |
| **FINANCE** | Where the money went — accounting & analytics | Backward-looking judgment numbers in honest DMS idiom: KPI dashboard, deal history, P&L/cash flow, month-close results, later floorplan. |
| **GROWTH** | Work **ON** the business — everything that compounds across months | The demand console (marketing → BDC), the tier-gate detail board, later franchise courtship, acquisitions, the multi-store portfolio. |

Growth is one idea, not two roommates: steering demand is *how* you grow, the gate board is the *scoreboard* of growth, courtship/portfolio is growth at higher altitude. Its content matures along the spine's own arc (T1 cheap ads → T5 BDC → T6+ acquisitions), the same way Operations grows departments.

## 2. The four cross-cutting rules

1. **FAB / no readout-only sections.** A section ships only when there's a decision with teeth behind it. Sim-depth stays under the hood until it's a fun decision (existing principle, applied to IA): no surface exists just to display.
2. **Operating vs. judging.** A number you act on while doing the job renders in the room where you do the job; a period number you read to judge the business renders in Finance. The same metric may appear in both rooms in different *forms* (per-car age on the Lot vs. fleet-average age in Finance) — that is the distinction working, not duplication.
3. **Absent until unlocked, data-driven.** Surfaces for mechanics that don't exist yet do not render — no grayed foreshadow tiles, no unlock-tease framing (foreshadowing the climb is Growth's gate board's job). The UI layer contains **zero unlock logic**: the Operations dock renders whatever departments the world says are stood up; People renders the sections whose mechanics exist. IA defines containers; tier/world data defines contents.
4. **Glances route.** Every Home glance deep-links into its owning room (cash card → Finance, gate strip → Growth board, market glance → Growth console, stat-strip chips → their Operations rooms). Home never renders detail but always routes to it.

## 3. Navigation pattern

**In-tab stacks, with the floor-mode carve-out.** Sub-screens (auction, pricing, department screens, drill-downs) render inside the shell — the tab bar stays visible and each tab owns a navigation stack; switching tabs preserves position within each. This replaces the current unmount-the-shell pattern and retires the lifted-state workaround (`App.tsx:375-379` vintage).

Carve-outs: **the live floor remains a full-screen MODE** entered via START DAY (the watch-it-resolve beat suspends the console deliberately), and modals stay modals (day recap #253, escalations, hand-play).

## 4. Per-tab anatomy

### HOME (glances only)
Identity header · hero · cash + reputation glances · collapsed calendar (#256) · monthly gate strip · stat strip · recap chip (#253) · market glance · START DAY footer. Detail for every glance lives in its owning tab (rule 4).

### OPERATIONS
- **Department dock** — kit-styled 2-column `Card` tile grid (IconBadge + name + queue badge / one-line status). Replaces the legacy `BottomNav` row reuse. **Lot is a full-width hero tile through Act 1.** Tiles appear as departments stand up (rule 3). At T4 the new/used split does **not** add a department — both streams live inside the Sales tile (goals doc decision 4).
- **Lot owns the whole stock pipeline as one room:** stock list with per-car aging/carrying cost · the pricing screen · sourcing (**auction lives here**, not as a top-level destination or a Prep button) · later the UCM mandate lever, which sits *next to* the manual auction surface so delegation reads as permission, not amputation (spine §2), and the auction home-base (spine §9) needs no special UI — the door just never closes.
- **Prep** — pure pre-open policy levers (hours, trade policy). Marketing/demand levers move out (→ Growth). No navigation links parked here.

### PEOPLE
- **Roster** — staff cards (skill read, morale, salary once it exists). Ships now.
- **Hiring** — the pool/flow (`PersonnelScreen` restyled). Ships now with current mechanics; scarcity/gating teeth arrive with the staff-teeth pass.
- **Development** — *reserved region, renders only when the training mechanic exists* (rule 3 + rule 1).

### FINANCE
Landing surface = the analytics dashboard, mapped from `docs/planning/mockups/analytics.png` (the mockup's separate Analytics + Finance tabs **merge** into this one tab). Layout grammar: time-range chips (Today/7D/30D/Quarter) → headline stat cards with sparklines + vs-prior-period deltas → one hero trend chart → secondary breakdowns (bar, donut) → small-stat row. Existing `KPIDashboard` is row one of this, unstyled. Siblings: deal history (`HistoryScreen`), month-close results; later P&L/cash-flow statements, floorplan (T4).
**Build dependency flagged:** the kit needs chart primitives (sparkline/bar/donut, `react-native-svg`-based) before the Finance slice — same enabling role #225 played for the shell.

### GROWTH
- **Demand console** — the demand mechanic's **single operating surface**: who's been walking in (segment mix + drift), who you're targeting, active campaigns + cost. Readout and levers in one room — reading the mix is the feedback for the lever. Later absorbs the T5 BDC console (the industrial version of the same job, spine §11).
- **Tier-gate detail board** — the five faces in their native idioms (goals doc decision 3); this is also where foreshadowing the climb lives.
- **Later:** franchise courtship/dossier (spine §12.5), acquisitions, multi-store portfolio + mandates (goals doc decision 5).

## 5. Parked — captured here, owned elsewhere (do not adjudicate in UI slices)

- **Staff-teeth inputs (→ the spine §5 staff design pass, alongside #249):** opening-gated hiring (must fire to browse the pool — scarcity made tangible; adjudicate blind-risk vs. anti-fun there) · weekly training cadence with short-term morale cost for skill gain toward the talent ceiling · interactions (training vs. poaching risk, firing vs. gate-month streaks).
- **Department-mechanics residue (→ its own pass):** what the **Office** department means once Finance owns the books · whether **BDC** exists as a T1 department when the spine names it T5's hire · where the **follow-up verb** lives before a BDC absorbs it. The dock design doesn't change when these resolve — only the world data does (rule 3).
- **Chart primitives** — enabling slice before the Finance surface.
