import type { DemandReadoutModel } from '../DemandReadout';
import type { HomeMarketGlance } from './HomeTab';
import { emptyState } from '../copy';

/**
 * Pure read-model builder for the Home **market glance** (#349).
 *
 * The demand console moved to Growth; what stays on Home is the two-line read
 * that says whether the console is worth opening — what buyers want most right
 * now, and what you're currently paying to steer them. It is a projection of the
 * console's own model, so the glance can never disagree with the room it routes
 * into (that drift is exactly what a hand-written summary would invite).
 */
export function buildMarketGlance(demand: DemandReadoutModel): HomeMarketGlance {
  // The forward heat vector is sorted hottest-first; fall back to the trailing
  // observed mix's biggest share when no heat console is available yet.
  const hottest = demand.heatBands?.[0];
  const observedTop = [...demand.entries].sort((a, b) => b.share - a.share)[0];
  const topLabel = hottest?.label ?? observedTop?.label;
  const headline = topLabel
    ? `Buyers want ${topLabel} most`
    : emptyState('home_glance_demand');

  const running = demand.advertising?.options.find(
    (o) => o.id === demand.advertising?.selectedId,
  );
  const campaignLabel =
    running && running.costLabel
      ? `Running ${running.label} · ${running.costLabel}`
      : emptyState('home_glance_campaign');

  return { headline, campaignLabel };
}
