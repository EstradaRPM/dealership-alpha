import { readAppCompositionSource } from './helpers/appComposition';

describe('#202/#351 KPI dashboard reachability', () => {
  it('renders the KPI block inside the Finance tab, not behind the in-game menu', () => {
    const src = readAppCompositionSource();

    // The tab is wired into the shell's per-tab content record.
    expect(src).toMatch(/finance: <FinanceTabContainer/);
    // The block reads a WINDOWED snapshot — the range chips are real, not a
    // lifetime number relabelled.
    expect(src).toMatch(/world\.kpiDashboard\.getSnapshot\(window\)/);
    expect(src).toMatch(/world\.kpiDashboard\.getDailyTotals\(window\)/);

    // The old full-screen route and its menu entry are gone.
    expect(src).not.toMatch(/nav\.navigate\('kpi-dashboard'\)/);
    expect(src).not.toMatch(/screen === 'kpi-dashboard'/);
    expect(src).not.toMatch(/onKPIDashboard=/);
  });
});
