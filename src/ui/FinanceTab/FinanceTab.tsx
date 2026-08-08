import React from 'react';
import { View, Text, type ViewStyle } from 'react-native';
import { useTheme } from '../theme';
import {
  Surface,
  SectionHeader,
  StatCard,
  Sparkline,
  BarChart,
  DonutChart,
  Button,
} from '../kit';
import { ChipRow } from '../DeptControls';
import { KPIDashboard } from '../KPIDashboard';
import type { MarketStateModel } from '../KPIDashboard';
import type {
  FinanceDashboardModel,
  FinanceRangeId,
  FinanceStat,
} from './financeModel';

export interface FinanceTabProps {
  model: FinanceDashboardModel;
  /**
   * The market-state read-model (#179) — segment value pressure, active shocks,
   * inventory valuation, stale stock. It rides the same KPI block it always
   * has; that block moved out of a dead menu screen and into this tab.
   */
  marketState?: MarketStateModel;
  onSelectRange: (id: FinanceRangeId) => void;
  /** Open the deal-history sibling screen. */
  onOpenHistory: () => void;
  /** Open the month-close results sibling screen. */
  onOpenMonthResults: () => void;
}

/**
 * The **Finance** tab (#351) — where the money went, and how the period graded.
 *
 * Locked charter (`second-level-ia.md` §1/§4): the backward-looking judgment
 * numbers, in honest DMS idiom. Everything here is a reading, never a lever —
 * the numbers you act on while working live in the room where you do the work.
 *
 * The layout is the IA's grammar, top to bottom: time-range chips → headline
 * stat cards with sparklines and period-over-period deltas → one hero trend
 * chart → the two breakdowns (how deals were funded, where the money went) →
 * the small-stat row (the KPI block, which used to be a screen behind the
 * in-game menu). The two siblings — deal history and month-close results — are
 * pushed inside this tab, so reading them never costs you the console.
 *
 * Presentation only: every value arrives pre-formatted from `financeModel`.
 */
export function FinanceTab({
  model,
  marketState,
  onSelectRange,
  onOpenHistory,
  onOpenMonthResults,
}: FinanceTabProps) {
  const t = useTheme();
  const region: ViewStyle = { marginTop: t.spacing.xl };
  const caption = {
    ...t.typography.caption,
    color: t.colors.textMuted,
    marginTop: t.spacing.xxs,
  };

  return (
    <View testID="finance-tab">
      <View testID="finance-region-range">
        <SectionHeader title="Results" />
        <Text style={caption}>{model.rangeCaption}</Text>
        <View style={{ marginTop: t.spacing.sm }}>
          <ChipRow
            options={model.ranges.map((r) => ({ id: r.id, label: r.label }))}
            selectedId={model.selectedRangeId}
            onSelect={(id) => onSelectRange(id as FinanceRangeId)}
            testID="finance-range-chips"
          />
        </View>
      </View>

      <View style={{ marginTop: t.spacing.lg }} testID="finance-region-headline">
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: t.spacing.md,
          }}
        >
          {model.headline.map((s) => (
            <HeadlineCard key={s.id} stat={s} />
          ))}
        </View>
      </View>

      <View style={region} testID="finance-region-hero">
        <Surface>
          <SectionHeader title={model.hero.title} />
          <Text style={caption}>{model.hero.caption}</Text>
          <View style={{ marginTop: t.spacing.md }}>
            <BarChart
              data={model.hero.data}
              orientation="vertical"
              showValueAxis
              emptyLabel={model.hero.emptyLabel}
              testID="finance-hero-chart"
            />
          </View>
        </Surface>
      </View>

      <View style={region} testID="finance-region-mix">
        <Surface>
          <SectionHeader title={model.grossMix.title} />
          <Text style={caption}>{model.grossMix.caption}</Text>
          <View style={{ marginTop: t.spacing.md, alignItems: 'center' }}>
            <DonutChart
              data={model.grossMix.data}
              centerValue={model.grossMix.centerValue}
              centerLabel={model.grossMix.centerLabel}
              emptyLabel={model.grossMix.emptyLabel}
              formatShare={(value, fraction) =>
                `${Math.round(fraction * 100)}% · $${Math.round(value).toLocaleString('en-US')}`
              }
              testID="finance-mix-donut"
            />
          </View>
        </Surface>
      </View>

      <View style={region} testID="finance-region-gross-breakdown">
        <Surface>
          <SectionHeader title={model.grossBreakdown.title} />
          <Text style={caption}>{model.grossBreakdown.caption}</Text>
          <View style={{ marginTop: t.spacing.md }}>
            <BarChart
              data={model.grossBreakdown.data}
              orientation="horizontal"
              emptyLabel={model.grossBreakdown.emptyLabel}
              testID="finance-gross-breakdown-bars"
            />
          </View>
        </Surface>
      </View>

      <View style={region} testID="finance-region-back-end-structure">
        <Surface>
          <SectionHeader title={model.backEndByStructure.title} />
          <Text style={caption}>{model.backEndByStructure.caption}</Text>
          <View style={{ marginTop: t.spacing.md }}>
            <BarChart
              data={model.backEndByStructure.data}
              orientation="horizontal"
              emptyLabel={model.backEndByStructure.emptyLabel}
              testID="finance-back-end-structure-bars"
            />
          </View>
        </Surface>
      </View>

      <View style={region} testID="finance-region-expenses">
        <Surface>
          <SectionHeader title={model.expenses.title} />
          <Text style={caption}>{model.expenses.caption}</Text>
          <View style={{ marginTop: t.spacing.md }}>
            <BarChart
              data={model.expenses.data}
              orientation="horizontal"
              tone="danger"
              emptyLabel={model.expenses.emptyLabel}
              testID="finance-expense-bars"
            />
          </View>
        </Surface>
      </View>

      <View style={region} testID="finance-region-kpis">
        <Surface>
          <SectionHeader title="Deal KPIs" />
          <Text style={caption}>
            The industry readings behind the headline, over the same window.
          </Text>
          <KPIDashboard snapshot={model.kpi} {...(marketState ? { marketState } : {})} />
        </Surface>
      </View>

      <View style={region} testID="finance-region-records">
        <Surface>
          <SectionHeader title="The Record" />
          <Text style={caption}>
            Every deal and event as it happened, and how each closed month graded.
          </Text>
          <View style={{ marginTop: t.spacing.md, gap: t.spacing.sm }}>
            <Button
              label="Deal History"
              variant="secondary"
              icon="time"
              onPress={onOpenHistory}
              testID="finance-open-history"
            />
            <Button
              label="Month-Close Results"
              variant="secondary"
              icon="calendar"
              onPress={onOpenMonthResults}
              testID="finance-open-month-results"
            />
          </View>
        </Surface>
      </View>
    </View>
  );
}

/**
 * One headline figure. The sparkline sits under the `StatCard` rather than
 * inside it: the kit tile is the shared KPI primitive every surface repeats,
 * and only this one wants a trend under it.
 */
function HeadlineCard({ stat }: { stat: FinanceStat }) {
  const t = useTheme();
  return (
    <Surface
      style={{ flexGrow: 1, flexBasis: '45%', minWidth: 140 }}
      testID={`finance-stat-${stat.id}`}
    >
      <StatCard
        label={stat.label}
        value={stat.value}
        {...(stat.delta ? { delta: stat.delta } : {})}
        {...(stat.deltaContext ? { deltaContext: stat.deltaContext } : {})}
        trend={stat.trend}
      />
      {stat.empty ? (
        <Text
          style={{
            ...t.typography.caption,
            color: t.colors.textMuted,
            marginTop: t.spacing.xs,
          }}
        >
          {stat.emptyNote}
        </Text>
      ) : stat.series ? (
        <View style={{ marginTop: t.spacing.sm }}>
          <Sparkline
            values={stat.series}
            tone={stat.trend === 'down' ? 'danger' : 'primary'}
            size="sm"
            testID={`finance-spark-${stat.id}`}
          />
        </View>
      ) : null}
    </Surface>
  );
}
