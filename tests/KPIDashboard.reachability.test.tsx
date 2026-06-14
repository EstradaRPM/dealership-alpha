import * as fs from 'fs';
import * as path from 'path';
import { readAppCompositionSource } from './helpers/appComposition';

describe('#202 KPI dashboard reachability', () => {
  it('mounts the standalone KPI dashboard in the live App route graph', () => {
    const src = readAppCompositionSource();

    expect(src).toMatch(/import \{ KPIDashboard \} from '\.\.\/\.\.\/ui\/KPIDashboard'/);
    expect(src).toMatch(/nav\.navigate\('kpi-dashboard'\)/);
    expect(src).toMatch(/screen === 'kpi-dashboard'/);
    expect(src).toMatch(/onKPIDashboard=\{saveSlots\.openKPIDashboard\}/);
    expect(src).toMatch(/snapshot=\{world\.kpiDashboard\.getSnapshot\(\)\}/);
    expect(src).not.toMatch(/isUnlocked: world\.kpiDashboard\.isUnlocked/);
  });
});
