import fs from 'fs';
import path from 'path';
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { emptyState, loadEmptyStates, EMPTY_STATE_IDS } from '../src/ui/copy';
import { BarChart, DonutChart, LineChart, Sparkline } from '../src/ui/kit';
import { HomeTab } from '../src/ui/HomeTab';
import { GrowthTab } from '../src/ui/GrowthTab';
import { FinanceTab, buildFinanceDashboard, MonthResultsScreen, buildMonthResults } from '../src/ui/FinanceTab';
import { PeopleTab } from '../src/ui/PeopleTab';
import { LotRoom } from '../src/ui/LotRoom';
import { ServicePage } from '../src/ui/ServicePage';
import { BodyShopPage } from '../src/ui/BodyShopPage';
import { DepartmentScreen } from '../src/ui/DepartmentScreen';
import { ZERO_KPI_SNAPSHOT } from '../src/game/KPIDashboard';
import { DEPARTMENT_CENTERS } from '../src/game/Economy';
import type { DepartmentPnLSummary, PnLSummary } from '../src/game/Economy';
import { buildStoreWorth } from '../src/ui/StoreWorth';

/** Fixed reads the two department rooms carry beside the two empty lists. */
const SERVICE_BASE_HEALTH = {
  size: 0,
  avgLoyalty: 0,
  avgCsi: 0,
  atRiskCount: 0,
  returnsPerDay: 0,
  returnTrend: 'steady' as const,
  defectionsPerDay: 0,
  churnTrend: 'steady' as const,
};
const BODY_SHOP_CONQUEST = {
  windowTickets: 0,
  intakePerDay: 0,
  intakeTrend: 'steady' as const,
  retailShare: 0,
  insuranceShare: 0,
  retailTrend: 'steady' as const,
};

/**
 * The empty-state pass (#389).
 *
 * A region with nothing in it is the surface a brand-new career meets FIRST —
 * before a single day has run, every list, panel and chart in this game is
 * empty. Three things are asserted here and each is a different failure the
 * pass was filed to end:
 *
 * 1. every region that CAN be empty says so, as a sentence naming a next
 *    action, when it is mounted against a world where nothing has happened;
 * 2. no empty-state string survives as a literal under `src/`, so the same
 *    "nothing here yet" cannot be worded three ways on three surfaces;
 * 3. a chart handed no data draws its sentence rather than an empty axis.
 */
const catalog = loadEmptyStates();

describe('every empty region states a next action (#389)', () => {
  it('the catalog declares every region and every id carries copy', () => {
    expect(catalog.states.length).toBe(EMPTY_STATE_IDS.length);
  });

  it('Home, before the first day has opened', () => {
    const { getByText } = render(
      <HomeTab state={{ phase: 'MANAGERIAL', day: 1 } as never} />,
    );
    expect(getByText(emptyState('home_today'))).toBeTruthy();
    expect(getByText(emptyState('demand_readout'))).toBeTruthy();
  });

  it('Growth, with no console, report, wire, mix, build or board', () => {
    const { getByText } = render(<GrowthTab />);
    for (const id of [
      'demand_readout',
      'growth_weekly_report',
      'growth_wire',
      'growth_finance_mix',
      'growth_facility',
      'growth_gate_board',
    ] as const) {
      expect(getByText(emptyState(id))).toBeTruthy();
    }
  });

  it('Finance, over a window with nothing posted to the books', () => {
    const emptyPnl: PnLSummary = {
      totalRevenue: 0,
      totalExpenses: 0,
      netIncome: 0,
      entries: [],
    };
    const emptyDept: DepartmentPnLSummary = {
      departments: DEPARTMENT_CENTERS.map((center) => ({
        center,
        revenue: 0,
        costOfSale: 0,
        gross: 0,
        active: false,
      })),
      overhead: 0,
      netIncome: 0,
    };
    const model = buildFinanceDashboard({
      rangeId: '7d',
      currentDay: 3,
      kpi: ZERO_KPI_SNAPSHOT,
      priorKpi: ZERO_KPI_SNAPSHOT,
      pnl: emptyPnl,
      priorPnl: emptyPnl,
      departmentPnl: emptyDept,
      daily: [],
      hasPriorWindow: false,
    });
    const { getAllByText } = render(
      <FinanceTab
        model={model}
        storeWorth={buildStoreWorth({ cash: 0, stockValue: 0, total: 0 })}
        onSelectRange={() => {}}
        onOpenHistory={() => {}}
        onOpenMonthResults={() => {}}
      />,
    );
    expect(getAllByText(emptyState('finance_no_deals')).length).toBeGreaterThan(0);
    expect(getAllByText(emptyState('finance_no_postings')).length).toBeGreaterThan(0);
    expect(getAllByText(emptyState('finance_no_spend')).length).toBeGreaterThan(0);
  });

  it('Finance month results, before the first month has closed', () => {
    const { getByText } = render(
      <MonthResultsScreen model={buildMonthResults([])} onClose={() => {}} />,
    );
    expect(getByText(emptyState('finance_month_results'))).toBeTruthy();
  });

  it('People, with nobody on payroll and no applicants shopped', () => {
    const { getByText, getByTestId } = render(
      <PeopleTab
        managerStatus={{ ucmPresent: false, ucm: [], departments: [] }}
        roster={[]}
        dailyPayroll={0}
        slots={[]}
        hiring={{
          roleOptions: [
            { id: 'salesperson', label: 'Salesperson', department: 'sales' },
            { id: 'technician', label: 'Technician', department: 'service' },
          ],
          selectedRoleId: '',
          candidates: [],
          cash: 0,
        }}
        onSelectHiringRole={() => {}}
        onHire={() => {}}
        onPromote={() => {}}
        onFire={() => {}}
        onAcceptRaise={() => {}}
        onRefuseRaise={() => {}}
      />,
    );
    expect(getByText(emptyState('people_roster_empty'))).toBeTruthy();
    expect(getByText(emptyState('people_no_managers'))).toBeTruthy();

    // Sales is the department being shopped (the selection falls back to the
    // first hiring panel), so its panel is open on nobody having applied.
    expect(getByText(emptyState('people_hiring_no_applicants'))).toBeTruthy();
    // Service is not being shopped, so its panel is shut — and a shut
    // Collapsible unmounts its body (`src/ui/kit/CLAUDE.md`). The sentence is
    // behind the header a player would press to get to it.
    fireEvent.press(getByTestId('people-hiring-dept-service-header'));
    expect(getByText(emptyState('people_hiring_no_role'))).toBeTruthy();
  });

  it('the Lot, with nothing in stock', () => {
    const { getByText } = render(
      <LotRoom
        vehicles={[]}
        occupancy={{ occupied: 0, built: 6, spacesOpen: 6, atCapacity: false }}
        onSetAskingPrice={() => {}}
        onOpenPricing={() => {}}
        pricingStrategyOptions={[{ id: 'market', label: 'Market', blurb: 'List at market.' }]}
        pricingStrategyId="market"
        onSelectPricingStrategy={() => {}}
        autoPricingActive={false}
        onOpenAuction={() => {}}
        onWholesale={() => {}}
        onClose={() => {}}
      />,
    );
    expect(getByText(emptyState('lot_stock_count'))).toBeTruthy();
    expect(getByText(emptyState('lot_stock_list'))).toBeTruthy();
  });

  it('Service and the Body Shop, before any work has come in', () => {
    const service = render(
      <ServicePage
        model={{ demandHeat: [], coverage: [], baseHealth: SERVICE_BASE_HEALTH }}
        onClose={() => {}}
      />,
    );
    expect(service.getByText(emptyState('service_demand_heat'))).toBeTruthy();
    expect(service.getByText(emptyState('parts_coverage'))).toBeTruthy();

    const body = render(
      <BodyShopPage
        model={{ demandHeat: [], coverage: [], conquest: BODY_SHOP_CONQUEST }}
        onClose={() => {}}
      />,
    );
    expect(body.getByText(emptyState('body_shop_demand_heat'))).toBeTruthy();
    expect(body.getByText(emptyState('parts_coverage'))).toBeTruthy();
  });

  it('a department queue names the queue it is empty of', () => {
    const { getByText } = render(
      <DepartmentScreen title="Service" items={[]} onResolve={() => {}} onClose={() => {}} />,
    );
    // The `{queue}` slot carries the room's own word, so one sentence covers
    // every department rather than one string per door.
    expect(getByText(emptyState('department_queue', { queue: 'Service' }))).toBeTruthy();
  });
});

describe('an empty window draws a sentence, not an axis (#389)', () => {
  it.each([
    ['BarChart', <BarChart width={300} data={[]} emptyLabel={emptyState('finance_no_gross')} testID="c" />],
    ['DonutChart', <DonutChart data={[]} emptyLabel={emptyState('finance_no_deals')} testID="c" />],
    ['LineChart', <LineChart width={300} series={[]} emptyLabel={emptyState('finance_no_postings')} testID="c" />],
    ['Sparkline', <Sparkline values={[]} emptyLabel={emptyState('gate_trend')} testID="c" />],
  ])('%s with no data renders its own sentence', (_name, element) => {
    const { getByTestId } = render(element as React.ReactElement);
    expect(getByTestId('c-empty')).toBeTruthy();
  });

  it('every chart in the live surfaces is handed an empty label', () => {
    // A chart with no `emptyLabel` renders NOTHING when its window is empty
    // (`ChartEmpty` returns null on an absent label), which is a blank box the
    // player cannot tell from a broken one. This is the guard that a chart
    // added next year cannot ship without its sentence.
    const files = sourceFiles(path.join(__dirname, '..', 'src', 'ui')).filter(
      (f) => !/\.test\.tsx?$/.test(f) && !f.includes(`${path.sep}kit${path.sep}`),
    );
    const CHART = /<(BarChart|DonutChart|LineChart|Sparkline)\b([\s\S]*?)\/>/g;
    const missing: string[] = [];
    let seen = 0;
    for (const file of files) {
      for (const m of fs.readFileSync(file, 'utf8').matchAll(CHART)) {
        seen += 1;
        if (!m[2].includes('emptyLabel')) missing.push(`${path.basename(file)}: <${m[1]}>`);
      }
    }
    // A scan of nothing passes everything.
    expect(seen).toBeGreaterThanOrEqual(6);
    expect(missing).toEqual([]);
  });
});

// ── The literal scan ─────────────────────────────────────────────────────────

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

const srcFiles = sourceFiles(path.join(__dirname, '..', 'src')).filter(
  (f) => !/\.test\.tsx?$/.test(f),
);

/**
 * A distinctive fragment of each sentence — the `tests/HintCopy.test.ts` idiom.
 * Matching on a fragment rather than the whole string catches a component that
 * re-wraps the copy across lines, and stops the scan being defeated by a
 * trailing space. `{slot}`s are cut at the brace so a filled sentence in source
 * is still caught by the half in front of the slot.
 */
function fragmentOf(text: string): string {
  const upToSlot = text.split('{')[0];
  return (upToSlot.length >= 20 ? upToSlot : text).slice(0, 40);
}

describe('no empty-state literal survives in src/ (#389)', () => {
  it('the scan sees the source tree (a scan of nothing passes everything)', () => {
    expect(srcFiles.length).toBeGreaterThan(100);
  });

  it.each(srcFiles)('%s contains no empty-state copy', (file) => {
    const src = fs.readFileSync(file, 'utf8');
    const leaked = catalog.states
      .filter((s) => src.includes(fragmentOf(s.text)))
      .map((s) => s.id);
    expect(leaked).toEqual([]);
  });
});
