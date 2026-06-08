import * as fs from 'fs';
import * as path from 'path';

describe('#202 KPI dashboard reachability', () => {
  it('mounts the standalone KPI dashboard in the live App route graph', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'App.tsx'), 'utf8');

    expect(src).toMatch(/import \{ KPIDashboard \} from '\.\/src\/ui\/KPIDashboard'/);
    expect(src).toMatch(/nav\.navigate\('kpi-dashboard'\)/);
    expect(src).toMatch(/screen === 'kpi-dashboard'/);
    expect(src).toMatch(/onKPIDashboard=\{openKPIDashboard\}/);
    expect(src).toMatch(/snapshot=\{world\.kpiDashboard\.getSnapshot\(\)\}/);
    expect(src).not.toMatch(/isUnlocked: world\.kpiDashboard\.isUnlocked/);
  });
});
