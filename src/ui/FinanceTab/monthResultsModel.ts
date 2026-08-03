import type { GateBand, GateMonthVerdict } from '../../game/TierGate';
import type { KPISnapshot } from '../../game/KPIDashboard';
import type { PnLSummary } from '../../game/Economy';
import type { BadgeTone } from '../kit';
import { money } from './financeModel';

/**
 * Month-close results (#351) — the career's closed months, newest first.
 *
 * The gate already grades every month and the grade is the judgment; the
 * financial side is **re-derived** from the day-stamped deal log and the
 * persisted ledger over that month's day window rather than stored a second
 * time, so the numbers here can never drift from the ones the dashboard shows
 * for the same days.
 */

export interface MonthResultFace {
  readonly id: string;
  readonly label: string;
  readonly band: GateBand;
  readonly bandLabel: string;
  readonly tone: BadgeTone;
  /** How far the face landed against its bar, e.g. "112% of target". */
  readonly ratioLabel: string;
}

export interface MonthResultRow {
  readonly month: number;
  readonly title: string;
  /** e.g. "Day 31–60 · Tier 1". */
  readonly subtitle: string;
  readonly band: GateBand;
  readonly bandLabel: string;
  readonly tone: BadgeTone;
  readonly faces: readonly MonthResultFace[];
  readonly stats: readonly { readonly label: string; readonly value: string }[];
}

export interface MonthResultsModel {
  readonly rows: readonly MonthResultRow[];
  /** Shown in place of the list before the first month has closed. */
  readonly emptyNote: string;
}

/** One closed month's inputs — the verdict plus its re-derived financials. */
export interface MonthResultInputs {
  readonly verdict: GateMonthVerdict;
  readonly fromDay: number;
  readonly toDay: number;
  readonly kpi: KPISnapshot;
  readonly pnl: PnLSummary;
}

/**
 * Player-facing wording for the four bands. Plain language that names what
 * happened — never a temperature word (locked UI rule).
 */
const BAND_LABEL: Record<GateBand, string> = {
  exceed: 'Beat the target',
  meet: 'Hit the target',
  nearMiss: 'Just short',
  miss: 'Missed',
};

const BAND_TONE: Record<GateBand, BadgeTone> = {
  exceed: 'reward',
  meet: 'positive',
  nearMiss: 'neutral',
  miss: 'danger',
};

/**
 * Face ids are engine keys (`units`, `gross`, …); the verdict carries no label,
 * so the results screen names them the way the rest of the app does.
 */
const FACE_LABEL: Record<string, string> = {
  units: 'Units',
  gross: 'Gross',
  cash: 'Cash on Hand',
  csi: 'Customer Satisfaction',
  facility: 'Facility',
};

function faceLabel(id: string): string {
  return FACE_LABEL[id] ?? id;
}

export function buildMonthResults(
  inputs: readonly MonthResultInputs[],
): MonthResultsModel {
  // Newest first: the month you just closed is the one you came here to read.
  const rows = [...inputs]
    .sort((a, b) => b.verdict.month - a.verdict.month)
    .map((input): MonthResultRow => {
      const { verdict, kpi, pnl, fromDay, toDay } = input;
      const gross = kpi.cashGross + kpi.financeGross;
      return {
        month: verdict.month,
        title: `Month ${verdict.month}`,
        subtitle: `Day ${fromDay}–${toDay} · Tier ${verdict.tier}`,
        band: verdict.overall,
        bandLabel: BAND_LABEL[verdict.overall],
        tone: BAND_TONE[verdict.overall],
        faces: verdict.faces.map((f) => ({
          id: f.id,
          label: faceLabel(f.id),
          band: f.band,
          bandLabel: BAND_LABEL[f.band],
          tone: BAND_TONE[f.band],
          ratioLabel: `${Math.round(f.ratio * 100)}% of target`,
        })),
        stats: [
          { label: 'Units', value: String(kpi.unitsRetailed) },
          { label: 'Gross', value: money(gross) },
          { label: 'Net Income', value: money(pnl.netIncome) },
          {
            label: 'PVR',
            value: kpi.unitsRetailed > 0 ? money(kpi.pvr) : '—',
          },
        ],
      };
    });

  return {
    rows,
    emptyNote:
      'No month has closed yet. Every month the books close, the result lands here — the grade and the numbers behind it.',
  };
}
