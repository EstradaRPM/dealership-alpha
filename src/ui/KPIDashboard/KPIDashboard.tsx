import React from 'react';
import { View, Text, type TextStyle } from 'react-native';
import type { KPISnapshot } from '../../game/KPIDashboard';
import { useTheme } from '../theme';
import { SectionHeader, money } from '../kit';
import { MarketStatePanel } from './MarketStatePanel';
import type { MarketStateModel } from './marketState';

// Exact (issue 387). These rows sit inside the Finance room, where every figure
// has to reconcile with the statement below it.
const fmt$ = money;

function KPIRow({ label, value }: { label: string; value: string }) {
  const t = useTheme();
  const labelText: TextStyle = { ...t.typography.body, color: t.colors.textSecondary };
  const valueText: TextStyle = {
    ...t.typography.body,
    color: t.colors.textPrimary,
    fontVariant: ['tabular-nums'],
  };
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: t.spacing.xs,
      }}
    >
      <Text style={labelText}>{label}</Text>
      <Text style={valueText}>{value}</Text>
    </View>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ marginTop: t.spacing.md }}>
      <SectionHeader title={title} />
      <View style={{ marginTop: t.spacing.xs }}>{children}</View>
    </View>
  );
}

export interface KPIDashboardProps {
  snapshot: KPISnapshot;
  /** Optional market-state read-model (#179). When present, the market-state
   *  panel (segment value pressure, active shocks, valuation, stale inventory)
   *  renders below the deal KPIs. Omitted contexts (e.g. the month-close recap)
   *  show only the deal KPIs. */
  marketState?: MarketStateModel;
}

/**
 * The deal-KPI block — the industry readings in their native DMS idiom.
 *
 * An **embedded block, not a screen** (#351). It used to be a full route behind
 * the in-game menu, which is exactly why nobody read it; it is now row one of
 * the Finance dashboard, where the surrounding surface owns the chrome and the
 * scroll. Its two consumers pass different snapshots — Finance passes the
 * selected time range's, the month-close interstitial passes the month's — and
 * a KPI row reads identically in both because there is only one of it.
 *
 * Presentation only: the caller decides *which* deals these KPIs cover.
 */
export function KPIDashboard({ snapshot, marketState }: KPIDashboardProps) {
  const hasDeals = snapshot.unitsRetailed > 0;
  return (
    <View testID="kpi-dashboard">
      <Group title="Performance KPIs">
        <KPIRow label="Units Retailed" value={String(snapshot.unitsRetailed)} />
        <KPIRow label="PVR (Per Vehicle Retailed)" value={hasDeals ? fmt$(snapshot.pvr) : '—'} />
        <KPIRow label="F&I PPRU" value={hasDeals ? fmt$(snapshot.fniPpru) : '—'} />
      </Group>

      <Group title="Gross Averages">
        <KPIRow label="Avg Front Gross" value={hasDeals ? fmt$(snapshot.avgFrontGross) : '—'} />
        <KPIRow label="Avg Back Gross" value={hasDeals ? fmt$(snapshot.avgBackGross) : '—'} />
      </Group>

      <Group title="Deal Structure">
        <KPIRow label="Cash Units" value={hasDeals ? String(snapshot.cashUnits) : '—'} />
        <KPIRow label="Financed Units" value={hasDeals ? String(snapshot.financeUnits) : '—'} />
        <KPIRow label="Heavy-Down Units" value={hasDeals ? String(snapshot.heavyDownUnits) : '—'} />
        <KPIRow
          label="Avg APR"
          value={snapshot.financeUnits > 0 ? `${(snapshot.avgApr * 100).toFixed(1)}%` : '—'}
        />
        <KPIRow
          label="Avg Term"
          value={snapshot.financeUnits > 0 ? `${Math.round(snapshot.avgTerm)} mo` : '—'}
        />
        <KPIRow
          label="Avg Down"
          value={
            snapshot.financeUnits > 0 ? `${Math.round(snapshot.avgDownPct * 100)}%` : '—'
          }
        />
      </Group>

      <Group title="Inventory">
        <KPIRow
          label="Avg Days in Inventory"
          value={hasDeals ? `${Math.round(snapshot.avgDii)} days` : '—'}
        />
        <KPIRow label="Daily Carrying Cost" value={fmt$(snapshot.dailyCarryingCost)} />
      </Group>

      {marketState ? <MarketStatePanel model={marketState} /> : null}
    </View>
  );
}
