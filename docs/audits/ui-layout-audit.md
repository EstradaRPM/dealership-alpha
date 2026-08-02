# UI layout audit — shipped surfaces vs. the locked IA

**Method:** every surface below was driven live on the web target (#338), Tier 1 fresh career,
one salesperson hired, floor closed, 375×812. Every tappable target was pressed and its
destination recorded. Source references are the wiring behind each control.

**Headline:** the layout does not need re-deciding. `docs/planning/second-level-ia.md`
(locked 2026-06-12) already specifies the fix for nearly every defect found here. What
happened is that the UI-rebrand slice chain **stopped after Home** — S1/S1.5/S2/S3a–S3f/S4 all
landed, and no Operations, People, Finance or Growth slice was ever filed. The tabs are
running the #215 shell tracer's placeholder composition, twenty months of game logic later.

So this is a **delta report**, not a redesign proposal. Where shipped and locked disagree,
locked wins and the row is a build item.

---

## 1. The count

From the Operations tab at Tier 1 there are **9 reachable destinations. 6 of them open an
empty or dark screen.**

| Destination | What opens | State |
|---|---|---|
| Departments → Sales | generic queue screen | empty — queue only fills during a live floor |
| Departments → Service | generic queue screen | empty — no advisor exists at T1 |
| Departments → BDC | generic queue screen | **"Nothing waiting in BDC."** — BDC is a Tier 5 hire |
| Departments → Office | generic queue screen | empty — no mechanic behind it at any tier yet |
| Departments → Lot | generic queue screen | **"Nothing waiting in Lot."** — while 3 cars sit on the lot one tab away |
| Service Overview → | real `ServicePage` | dark at T1 — no advisor, no installed base |
| Visit Auction → | real `AuctionScreen` | live |
| Hire Staff → | real `PersonnelScreen` | live |
| Tune › (per unit) | real pricing screen | live |

All five department buttons route through one generic component
([RouteContent.tsx:241](../../src/app/screens/RouteContent.tsx:241)) that renders
`world.departmentQueue.getQueue(dept)` and nothing else. There is no per-department room —
only a queue list, and four of the five queues have no producer at Tier 1.

**Locked IA already forbids this.** Rule 3: *"Surfaces for mechanics that don't exist yet do
not render — no grayed foreshadow tiles."* The dock is supposed to render whatever
departments the world says are stood up. It instead renders a hardcoded five-across strip.

---

## 2. Defects by surface

### 2.1 Operations — the department dock

| # | Defect | Locked IA says | Evidence |
|---|---|---|---|
| O1 | Five hardcoded department buttons, four permanently empty at T1 | Dock renders only stood-up departments (rule 3) | driven; [OperationsTab.tsx:70](../../src/ui/OperationsTab/OperationsTab.tsx:70) |
| O2 | Dock reuses `BottomNav` — a *bottom tab bar component* rendered inline as a content strip | "kit-styled 2-column `Card` tile grid … **replaces the legacy `BottomNav` row reuse**" (§4) | [OperationsTab.tsx:70](../../src/ui/OperationsTab/OperationsTab.tsx:70) |
| O3 | **Lot is an empty queue screen** while owning nothing | "Lot owns the whole stock pipeline as one room: stock list · pricing screen · sourcing (**auction lives here**)" (§4) | driven |
| O4 | "Service Overview →" is a second, redundant entry to a department that already has a dock button | one room per department | [OperationsTab.tsx:72-81](../../src/ui/OperationsTab/OperationsTab.tsx:72) |
| O5 | Pushed screens (BDC, Lot, Personnel, Auction) **unmount the tab bar** | "the tab bar stays visible and each tab owns a navigation stack. **This replaces the current unmount-the-shell pattern**" (§3) | driven — dept screens have only a Back button |

### 2.2 Operations — the Prep block

| # | Defect | Locked IA says | Evidence |
|---|---|---|---|
| P1 | **Duplicate heading.** `SectionHeader "Prep"` immediately followed by `"NEXT-DAY PREP"` | — (plain layout bug) | [OperationsTab.tsx:95](../../src/ui/OperationsTab/OperationsTab.tsx:95) + [OwnershipLevers.tsx:190](../../src/ui/OwnershipLevers/OwnershipLevers.tsx:190) |
| P2 | "Visit Auction →" and "Hire Staff →" are **navigation links parked in Prep** | "Prep — pure pre-open policy levers (hours, trade policy). **No navigation links parked here.**" (§4) | [OwnershipLevers.tsx:254-277](../../src/ui/OwnershipLevers/OwnershipLevers.tsx:254) |
| P3 | Auction is a Prep button | auction belongs to the Lot room (§4) | same |
| P4 | Hiring is a Prep button; the **roster lives behind it**, two levels down, inside Operations | Roster + Hiring are **People's** charter and "ship now" (§4) | driven |
| P5 | Advertising lever sits in Prep | "Marketing/demand levers move out (→ Growth)"; Growth owns the demand console (§4) | [OwnershipLevers.tsx:306](../../src/ui/OwnershipLevers/OwnershipLevers.tsx:306) |
| P6 | Per-unit price list + Tune rows sit in Prep | stock list and pricing belong to the Lot room (§4) | [OwnershipLevers.tsx:239-251](../../src/ui/OwnershipLevers/OwnershipLevers.tsx:239) |
| P7 | Six stacked full-width cards, one control each — the block scrolls ~2.5 screens to hold 14 controls | — (density) | driven |
| P8 | The floating "Open Floor" CTA **overlaps the Advertising card**; the playtest chip overlaps a price input | — (z-order/inset bug) | driven |

After P2–P6 move out, Prep is what the locked IA says it is: **hours and trade policy.** Two
levers, one card.

### 2.3 Styling — Operations is the last pre-kit surface

`OwnershipLevers` does not use the design-system kit. It imports the raw `colors` map directly
and builds its own `StyleSheet` with literal radii, font sizes and spacing
([OwnershipLevers.tsx:2](../../src/ui/OwnershipLevers/OwnershipLevers.tsx:2),
[:369-463](../../src/ui/OwnershipLevers/OwnershipLevers.tsx:369)) rather than reading semantic
roles through `useTheme()`. This is why the top of the Operations tab (kit `SectionHeader`,
kit nav strip) and the bottom (Prep cards) look like two different games: different card fill,
different corner radius, different type scale, different accent treatment.

`DemandReadout` was migrated for exactly this reason in #257 and was called "the last pre-kit
surface on Home" — it was the last on *Home*. `OwnershipLevers` is the last one anywhere.

### 2.4 People — the tab does not hold its charter

Shipped People renders **only manager delegation status**: used-car manager, service manager,
body-shop manager, each "ABSENT / MANUAL". Every one of them is absent at T1, so the entire
tab is three empty status rows and a paragraph of explanation.

The roster and the hiring pool — which the locked IA says are People's and "ship now" — are
instead reached through **Operations → Prep → Hire Staff**.

### 2.5 Finance and Growth — placeholder cards

Both render a tagline and the line *"This surface is coming in a later slice."* Between them
they are **2 of the 5 primary tabs**. Their content is phase 10 in the build order, gated on
chart primitives, and the locked IA §4 already specifies both layouts in detail.

The placeholder copy itself should go regardless of when the content lands — a tab that tells
the player a surface is coming later is the foreshadow-tease rule 3 forbids.

### 2.6 Home

Home is the one tab that got its slices and it shows: the gate strip, calendar, stat strip,
market glance and wire all render in kit styling. Two charter violations remain:

- **Glances don't route.** Rule 4 says every Home glance deep-links into its owning room. The
  cash card, market glance and gate strip are inert readouts.
- The **Market / Market Report / Industry Wire** stack renders in full on Home. The charter is
  "glances only" — the demand console is Growth's room (§4).

### 2.7 Cross-cutting

- **Hire cost does not vary with the candidate.** Three salespeople at 48% / 70% / 62%
  effectiveness, all priced at exactly $1,000, because cost is keyed to role class
  ([tunables.json:252](../../data/tunables.json:252)). The hire screen presents a menu with a
  strictly dominant option. This is already inside phase 6's C1 ruling (one daily wage,
  grade × role) — noted here because it is the first decision a new player is asked to make
  and it currently isn't one.
- **Staff have no names.** The roster row reads "salesperson · 70% eff / 65% trust". The
  people you hire, raise, and lose to a rival (C1 R2) are unnamed stat lines.
- **Hero art repeats on every tab.** The lot photograph is the header backdrop on Home,
  Operations, People, Finance and Growth, costing ~22% of the viewport on tactical screens
  that need density. #252 owns the header-backdrop treatment.

---

## 3. What this means for the build order

Nothing here reopens a locked design. The whole audit resolves to: **build the four
per-surface rebrand slices that were never filed**, in the order the locked IA implies.

| Order | Slice | Why first |
|---|---|---|
| 1 | **Operations rebuild** — dock as data-driven tile grid, Lot becomes the stock room (list + pricing + auction), Prep reduced to hours + trade policy, `OwnershipLevers` migrated to the kit | Fixes every O- and P-row and the 6-of-9 dead destinations. Highest felt payoff per unit of work. |
| 2 | **People rebuild** — roster + hiring move in from Operations; manager delegation becomes a section, not the whole tab | Removes P4; makes the tab hold its charter. Lands next to phase 6 (C1 staff-teeth), which adds wages, raises and named staff to the same surface. |
| 3 | **In-tab navigation stacks** — pushed screens render inside the shell, tab bar persists | O5. Structural; touches `Navigator` + `AppRoot`, so it wants to land after the surfaces it carries settle. |
| 4 | **Growth** — demand console (absorbs the advertising lever + the Home market stack) + tier-gate board | P5 and the Home charter violation both terminate here. |
| 5 | **Finance** — analytics dashboard; needs the chart primitives enabling slice first | Phase 10's stated dependency, unchanged. |

The playtest gate (#74) is **downstream of slice 1**. Round 1's script sends the player
through Operations on Day 0 and every day after; asking whether the loop feels good while
6 of 9 doors open on empty rooms measures the doors, not the loop.
