import React from 'react';
import { View, Text, type ViewStyle } from 'react-native';
import { useTheme } from '../theme';
import { Surface, SectionHeader, IconBadge, type IconName } from '../kit';
import { DemandReadout, type DemandReadoutModel } from '../DemandReadout';
import { GateBoard } from './GateBoard';
import type { GateBoardModel } from './gateBoardModel';
import { IndustryWire } from './IndustryWire';
import type { IndustryWireModel } from './industryWireModel';
import { WeeklyMarketReportCard } from './WeeklyMarketReportCard';
import type { WeeklyReportCardModel } from './weeklyReportModel';

export interface GrowthTabProps {
  /** The demand console's readout + levers (heat, observed mix, campaign). */
  demandReadout?: DemandReadoutModel;
  /** The standing weekly column (#177). `null` ⇒ none has published yet. */
  weeklyReport?: WeeklyReportCardModel | null;
  /** Industry-wire headlines (#176). */
  industryWire?: IndustryWireModel;
  /** Buy/cancel a wire subscription (#178). */
  onToggleSubscription?: (id: string, on: boolean) => void;
  /** The tier-gate detail board (#349). */
  gateBoard?: GateBoardModel;
}

/**
 * The **Growth** tab (#349) — work ON the business, the tab that compounds
 * across months (locked charter, `second-level-ia.md` §1).
 *
 * Two things live here, and until this slice neither had a home:
 *
 * 1. **The demand console** — the demand mechanic's single operating surface.
 *    Who's been walking in, what the forward heat says, who you're targeting,
 *    and the advertising campaign you're paying for. Readout and lever in ONE
 *    room, because reading the mix is the feedback for pulling the lever. The
 *    market report and the industry wire sit under it: the same week read
 *    slower, and then everybody else's word on it.
 * 2. **The tier-gate detail board** — the scoreboard of growth, and the only
 *    place the climb is foreshadowed (IA rule 3).
 *
 * All of this rendered on HOME before now, whose charter is glances only; the
 * advertising lever was parked in Operations → Prep, two rooms from the readout
 * that tells you whether it worked. Home keeps a market glance that routes here.
 *
 * Presentation only — every value arrives pre-formatted from the models the
 * container builds.
 */
export function GrowthTab({
  demandReadout,
  weeklyReport,
  industryWire,
  onToggleSubscription,
  gateBoard,
}: GrowthTabProps) {
  const t = useTheme();
  const region: ViewStyle = { marginTop: t.spacing.xl };
  const regionBody: ViewStyle = { marginTop: t.spacing.md };

  return (
    <View testID="growth-tab">
      <View testID="growth-region-demand">
        <SectionHeader title="Demand Console" />
        <View style={regionBody}>
          {demandReadout ? (
            <DemandReadout model={demandReadout} />
          ) : (
            <EmptyNote icon="storefront">
              Open the lot to build the demand readout.
            </EmptyNote>
          )}
        </View>
      </View>

      <View style={region} testID="growth-region-weekly-report">
        <SectionHeader title="Market Report" />
        <View style={regionBody}>
          {weeklyReport ? (
            <WeeklyMarketReportCard model={weeklyReport} />
          ) : (
            <EmptyNote icon="newspaper">
              The first weekly report comes out after your first full week.
            </EmptyNote>
          )}
        </View>
      </View>

      <View style={region} testID="growth-region-wire">
        <SectionHeader title="Industry Wire" />
        <View style={regionBody}>
          {industryWire ? (
            <IndustryWire model={industryWire} onToggleSubscription={onToggleSubscription} />
          ) : (
            <EmptyNote icon="newspaper">
              The wire starts up when your first day opens.
            </EmptyNote>
          )}
        </View>
      </View>

      <View style={region} testID="growth-region-gate">
        {gateBoard ? (
          <GateBoard model={gateBoard} />
        ) : (
          <>
            <SectionHeader title="This Month" />
            <View style={regionBody}>
              <EmptyNote icon="time">
                The month&apos;s targets light up when your first day opens.
              </EmptyNote>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

/** A region with nothing in it yet, given a surface to sit on — the same
 *  contained note idiom Home uses, so an empty band never reads as wireframe. */
function EmptyNote({ icon, children }: { icon: IconName; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <Surface
      variant="inset"
      padded={false}
      style={{
        padding: t.spacing.lg,
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.spacing.md,
      }}
    >
      <IconBadge name={icon} tone="muted" variant="soft" size="sm" />
      <Text style={{ ...t.typography.caption, color: t.colors.textMuted, flex: 1 }}>
        {children}
      </Text>
    </Surface>
  );
}
