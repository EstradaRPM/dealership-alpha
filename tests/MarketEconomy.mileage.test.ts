import {
  computeAnchor,
  loadMarketAnchorConfig,
  loadMarketConditionModsConfig,
  loadMarketDepreciationCurvesConfig,
  loadMarketMarkupConfig,
  loadMarketSegmentFallbackConfig,
  type AnchorVehicleInput,
} from '../src/game/MarketEconomy';
import { loadBrandTiersConfig } from '../src/game/SalesProcess';

const deps = {
  anchorConfig: loadMarketAnchorConfig(),
  fallbackConfig: loadMarketSegmentFallbackConfig(),
  curvesConfig: loadMarketDepreciationCurvesConfig(),
  conditionConfig: loadMarketConditionModsConfig(),
  brandTiers: loadBrandTiersConfig(),
  markupConfig: loadMarketMarkupConfig(),
};

const REF_MI = deps.curvesConfig.referenceMileage;

const civic = (mileage: number): AnchorVehicleInput => ({
  templateId: 'vanda_sedan',
  brand: 'vanda',
  year: deps.curvesConfig.referenceYear,
  mileage,
  category: 'sedan',
  condition: 'average',
});

const f150 = (mileage: number): AnchorVehicleInput => ({
  templateId: 'corden_truck',
  brand: 'corden',
  year: deps.curvesConfig.referenceYear,
  mileage,
  category: 'truck',
  condition: 'average',
});

describe('MarketEconomy.computeAnchor — mileage curve (#156)', () => {
  it('at or below referenceMileage produces the baseline anchor (multiplier=1)', () => {
    const base = computeAnchor(civic(REF_MI), deps);
    expect(computeAnchor(civic(0), deps)).toBe(base);
    expect(computeAnchor(civic(REF_MI), deps)).toBe(base);
  });

  it('monotonically depreciates with rising mileage, then floors', () => {
    const milestones = [REF_MI, REF_MI + 20_000, REF_MI + 60_000, 250_000, 400_000];
    const values = milestones.map((m) => computeAnchor(civic(m), deps));
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeLessThanOrEqual(values[i - 1]);
    }
    const shape = deps.curvesConfig.curves.sedan;
    const base = deps.anchorConfig.templates.vanda_sedan.baseAnchor;
    expect(values[values.length - 1]).toBeCloseTo(base * shape.mileageFloor, 6);
  });

  it('trucks tolerate mileage better than sedans (smaller per-10k discount)', () => {
    const sedanShape = deps.curvesConfig.curves.sedan;
    const truckShape = deps.curvesConfig.curves.truck;
    expect(truckShape.per10kMileageDepreciation).toBeLessThan(
      sedanShape.per10kMileageDepreciation,
    );
    const sedanRatio =
      computeAnchor(civic(REF_MI + 100_000), deps) /
      computeAnchor(civic(REF_MI), deps);
    const truckRatio =
      computeAnchor(f150(REF_MI + 100_000), deps) /
      computeAnchor(f150(REF_MI), deps);
    expect(truckRatio).toBeGreaterThan(sedanRatio);
  });
});
