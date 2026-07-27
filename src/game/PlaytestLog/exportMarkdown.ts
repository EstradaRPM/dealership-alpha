import type {
  PlaytestDealEntry,
  PlaytestEntry,
  PlaytestFlagEntry,
  PlaytestWalkEntry,
} from './types';

export interface PlaytestExportMeta {
  /** In-game day the export was taken on. */
  day: number;
  tier: number;
  exportedAt: string;
}

export interface FinanceMix {
  deals: number;
  cash: number;
  finance: number;
  /** Financed share of all deals, 0–100, rounded to whole percent. */
  financeShare: number;
  /** Mean down payment across *financed* deals only (a cash deal's "down" is
   *  the whole car and would swamp the average). */
  avgDownFinanced: number;
  /** That mean as a share of the financed deals' mean agreed price. */
  avgDownPct: number;
  avgTerm: number;
  /** Mean APR as a whole-number percent. */
  avgApr: number;
}

// Hermes has no full Intl — group by hand rather than via toLocaleString.
function money(n: number): string {
  const rounded = Math.round(n);
  const sign = rounded < 0 ? '-' : '';
  const digits = String(Math.abs(rounded));
  return `${sign}$${digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * The finance-mix answer, not the raw rows. Playtest script §5 asks two
 * questions — "does the cash-vs-finance split look like a real used-car lot"
 * and "do heavy-down deals show up at a believable rate" — so the export
 * computes them rather than leaving a table to be eyeballed.
 */
export function computeFinanceMix(deals: readonly PlaytestDealEntry[]): FinanceMix {
  const financed = deals.filter((d) => d.paymentMethod === 'finance');
  const cash = deals.length - financed.length;
  const avgDownFinanced = mean(financed.map((d) => d.downPayment));
  const avgPriceFinanced = mean(financed.map((d) => d.agreedPrice));
  return {
    deals: deals.length,
    cash,
    finance: financed.length,
    financeShare: deals.length === 0 ? 0 : Math.round((financed.length / deals.length) * 100),
    avgDownFinanced: Math.round(avgDownFinanced),
    avgDownPct: avgPriceFinanced === 0 ? 0 : Math.round((avgDownFinanced / avgPriceFinanced) * 100),
    avgTerm: Math.round(mean(financed.map((d) => d.term))),
    avgApr: Math.round(mean(financed.map((d) => d.apr)) * 1000) / 10,
  };
}

function flagLine(e: PlaytestFlagEntry): string {
  const clock = e.at.slice(11, 16);
  const head = `- **Day ${e.ctx.day}** · ${e.ctx.phase} · T${e.ctx.tier} · ${money(e.ctx.cash)} · ${clock}`;
  return e.note === '' ? `${head} — *(flag, no note)*` : `${head} — ${e.note}`;
}

function dealRow(e: PlaytestDealEntry): string {
  const structure =
    e.paymentMethod === 'cash'
      ? 'cash'
      : `${money(e.downPayment)} down · ${money(e.loanAmount)} @ ${(e.apr * 100).toFixed(1)}% × ${e.term}mo`;
  return `| ${e.day} | ${e.paymentMethod} | ${money(e.agreedPrice)} | ${structure} | ${money(e.frontGross)} | ${money(e.backGross)} | ${e.daysInInventory} |`;
}

function walkRow(e: PlaytestWalkEntry): string {
  return `| ${e.day} | ${e.archetypeLabel ?? '—'} | ${e.reason} | ${e.wantedCategory ?? '—'} |`;
}

/**
 * One paste-ready markdown blob: the flags in chronology, the §5 deal table
 * with its split already computed, and the walk-offs with their *named*
 * reasons (which the on-screen line flattens into one sentence).
 */
export function exportMarkdown(
  entries: readonly PlaytestEntry[],
  meta: PlaytestExportMeta,
): string {
  const ordered = [...entries].sort((a, b) => a.seq - b.seq);
  const flags = ordered.filter((e): e is PlaytestFlagEntry => e.kind === 'flag');
  const deals = ordered.filter((e): e is PlaytestDealEntry => e.kind === 'deal');
  const walks = ordered.filter((e): e is PlaytestWalkEntry => e.kind === 'walk');
  const mix = computeFinanceMix(deals);

  const out: string[] = [
    '# Playtest log — round 1 (#74)',
    '',
    `Exported day ${meta.day} · Tier ${meta.tier} · ${meta.exportedAt}`,
    `${flags.length} flags · ${deals.length} deals · ${walks.length} walk-offs`,
    '',
    '## Flags',
    '',
  ];

  out.push(flags.length === 0 ? '*(none)*' : flags.map(flagLine).join('\n'));

  out.push('', '## Finance mix', '');
  if (mix.deals === 0) {
    out.push('*(no deals closed)*');
  } else {
    out.push(
      `- **${mix.finance} financed / ${mix.cash} cash** across ${mix.deals} deals (${mix.financeShare}% financed)`,
      `- Average down on a financed deal: **${money(mix.avgDownFinanced)}** (${mix.avgDownPct}% of price)`,
      `- Average term **${mix.avgTerm} months** at **${mix.avgApr}% APR**`,
    );
  }

  out.push('', '## Deals', '');
  if (deals.length === 0) {
    out.push('*(none)*');
  } else {
    out.push(
      '| Day | Method | Price | Structure | Front | Back | Days in inv |',
      '|---|---|---|---|---|---|---|',
      ...deals.map(dealRow),
    );
  }

  out.push('', '## Walk-offs', '');
  if (walks.length === 0) {
    out.push('*(none)*');
  } else {
    out.push(
      '| Day | Who | Reason | Wanted |',
      '|---|---|---|---|',
      ...walks.map(walkRow),
    );
  }

  out.push('');
  return out.join('\n');
}
