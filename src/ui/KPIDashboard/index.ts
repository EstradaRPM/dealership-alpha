export { KPIDashboard } from './KPIDashboard';
export type { KPIDashboardProps } from './KPIDashboard';
export { MarketStatePanel } from './MarketStatePanel';
export {
  classifyValueBand,
  buildSegmentHeatCells,
  buildActiveShocks,
  buildInventoryValuation,
  buildStaleInventory,
} from './marketState';
export type {
  MarketStateModel,
  SegmentHeatCell,
  ActiveShockView,
  ShockSegmentEffect,
  InventoryValuationView,
  StaleInventoryView,
  ValueBand,
  ValueBandEdges,
  ShockInstanceInput,
  ValuationVehicleInput,
} from './marketState';
