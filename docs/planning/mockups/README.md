# UI Mockups — index

Final-look, neo-skeuomorphic UI renders (AI-generated) that drive the **UI-mapping pipeline**:

> image → mechanic-to-surface mapping table → adjudicate mismatches → PRD/issues.

These are **exploratory target visuals, not a settled UI spec.** Every on-screen element must eventually be backed by a real, finished mechanic or cut (no cosmetic placeholders). They are also **inconsistent with each other on purpose** (see "Cross-mockup discrepancies" below) — treat each as one proposal for *that* surface, not a unified system.

Pair these with the locked progression design in `../macro-loop-spine.md`. The nav and goals surfaces in particular were imagined *before* the macro-loop spine was locked and need re-examination against it.

---

## Files

### `home-hub.png` — Home / day-cycle hub
The primary management hub and the day's launch point. Shows: dealership identity ("Summit Motors", **TIER 2 Regional Dealer** badge), **Cash Balance** + **Reputation (CSI)** cards, a **calendar card** (Day 42, date, weather "72° Clear", week/month/quarter+season, "Sold this month 16/10"), a large **START DAY** button, a quick-stat strip (pending leads, appointments, inventory count, in-service, % on track), a 2-column grid of **department tiles** (Sales, Inventory, Finance, Service, Marketing, Staff, Reports), and a **TODAY'S TARGETS** bar (Retail Units, Gross Profit, CSI Score, $ goal with progress bars).
**Bears on:** nav taxonomy (fork 1), goals/targets (fork 2), the Floor-is-a-mode entry (START DAY), tier badge, weather surfacing. **This is the key image for the nav/goals revisit.**

### `floor-sim.png` — Live Floor Sim + HUD
The real-time top-down isometric lot, entered via START DAY (a *mode*, not a tab). Shows: clock + Open status, **Staff Morale** and **Regulatory Pressure** meters, a **Demand Mix (7-day)** bar (Sedans/SUVs/Trucks/EVs %), a floating live-stat panel (Active Shoppers, Test Drives, Waiting Leads, Today's Sales vs goal), the isometric scene (Showroom / Service bays / Sales Desk, vehicles, walking NPC tokens labeled Browsing/Looking/Test Drive), side action buttons (Marketing, Reports, Tasks), and a **selected-shopper card** (named hot lead w/ score, wanted vehicle + budget + trade-in, assigned salesperson, next action timer, **Est. Close Chance %**).
**Bears on:** FloorSim presentation (2.5D backdrop + 2D token overlay), demand-mix readout, morale/regulatory indicators, Est. Close Chance surfacing.

### `analytics.png` — Analytics / KPI dashboard
Performance dashboard with a time-range selector (Today / 7D / 30D / Quarter). Shows: top KPI cards (**Gross Per Unit**, **Units Sold**, **F&I Penetration**, **CSI Reputation**) with trend deltas, a **Gross Profit Per Unit** line chart, a **Units Sold by Week** bar chart, an **F&I Product Penetration** donut (Extended Warranty / GAP / Maintenance / Paint & Fabric / Other), and a bottom KPI row (Lead Conversion, Avg Days to Sale, Service Revenue, Close Rate).
**Bears on:** KPIDashboard, the multi-signal track record (sales record + CSI + financials), F&I-as-dials reporting, intra-tier binding-constraint readouts.

### `inventory.png` — Inventory browser + pricing screen
Stock management and the real-time pricing surface. Shows: lot summary (Total Units, Avg Days on Lot, **Aging Units** %, Avg Gross), filter/sort + All Lots/My Lot tabs, a 2-column grid of **vehicle cards** (photo, status badge — HIGH DEMAND / FRESH ARRIVAL / AGING UNIT / PRICE DROP / HOT LEAD, year-make-model-trim, stock #, days-on-lot, acq cost, asking price, **front-end gross**), and an expanded **pricing card** (acquisition cost, recon, current asking, market average, days-on-lot, a **LOWER PRICE ↔ MAX PROFIT slider**, and three strategy chips: **More Leads / Balanced / Max Profit**).
**Bears on:** the real-time pricing screen, price-drift/aging signals, the pricing-policy dial (and later the UCM/NCM who runs it), the gross×volume tradeoff made tangible.

---

## AI-generation artifacts (ignore — NOT design signals)

These images were each generated separately, so diffusion noise produced surface details that disagree across them. **Do not treat these as design divergence:**

- **Bottom nav differs in every image — this is an AI artifact, not a real split.** The nav taxonomy was deliberately decided: **Home · Operations · People · Finance · Growth** (Floor is a *mode* via START DAY, not a tab). The labels the renders happen to show (Dealership / Goals / Analytics / Deals / Store / Menu, etc.) are noise; map every mockup onto the canonical five tabs. See the `ui-mapping-pipeline` memory and `../macro-loop-spine.md`.
- **Dealership name/tier varies** (Summit Motors "Tier 2" vs Northridge Motors) — cosmetic render variance, not two entities.
- A surface drawn as a tab in one render and a tile/side-button in another is likewise noise — go by the canonical nav, not the render's chrome.
