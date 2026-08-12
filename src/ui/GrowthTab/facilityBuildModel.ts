import { money } from '../kit';
import type {
  ConstructionJob,
  FacilityBuildOption,
  FacilityCapacityKind,
} from '../../game/Facility';

/** One capacity kind's row on the build surface, fully formatted. */
export interface FacilityBuildRow {
  readonly kind: FacilityCapacityKind;
  /** "Lot spaces" / "Service bays" / "Body shop bays". */
  readonly label: string;
  /** "12 of 35 built". */
  readonly builtLabel: string;
  /** built ÷ ceiling, for the bar. `0` when the tier allows none. */
  readonly fill: number;
  /** The standing quote — true whether or not you can buy right now. */
  readonly priceLabel: string;
  /** The button's words. Says what it costs, or why it is not available. */
  readonly actionLabel: string;
  readonly disabled: boolean;
  /** One line per job in flight, soonest first. */
  readonly jobLabels: readonly { readonly id: string; readonly text: string }[];
}

export interface FacilityBuildModel {
  readonly rows: readonly FacilityBuildRow[];
}

const KIND_LABEL: Record<FacilityCapacityKind, string> = {
  lotSpaces: 'Lot spaces',
  serviceBays: 'Service bays',
  bodyBays: 'Body shop bays',
};

/** The unit noun each row counts in, so the copy reads as English. */
const KIND_UNIT: Record<FacilityCapacityKind, { one: string; many: string }> = {
  lotSpaces: { one: 'space', many: 'spaces' },
  serviceBays: { one: 'bay', many: 'bays' },
  bodyBays: { one: 'bay', many: 'bays' },
};

// Build costs are stated **exactly** (issue 387): this is a price the player
// presses a button to pay.

function units(kind: FacilityCapacityKind, n: number) {
  const noun = KIND_UNIT[kind];
  return `${n} ${n === 1 ? noun.one : noun.many}`;
}

function jobLabel(job: ConstructionJob) {
  return {
    id: job.id,
    text: `Building ${units(job.kind, job.units)} — opens day ${job.completesOnDay}`,
  };
}

/**
 * The Growth tab's **facility build** surface (#359, A2 R1).
 *
 * Every number on it is the engine's — what is standing, what the tier allows,
 * what the next block costs and how long it takes. The model only chooses the
 * words, so the rule the player reads here and the rule `Facility.build` runs
 * cannot drift apart.
 *
 * Three states a row can be in, and the button says which:
 *  - buildable — the price and the size of the next block;
 *  - built out to what the tier allows (or a kind this tier does not have yet);
 *  - short of cash, which names the number you are short of rather than just
 *    going grey.
 */
export function buildFacilityBuild(
  options: readonly FacilityBuildOption[],
): FacilityBuildModel {
  return {
    rows: options.map((o) => ({
      kind: o.kind,
      label: KIND_LABEL[o.kind],
      builtLabel: `${o.built} of ${o.ceiling} built`,
      fill: o.ceiling > 0 ? Math.min(1, o.built / o.ceiling) : 0,
      priceLabel: `${money(o.unitCost)} each · ${o.days} ${o.days === 1 ? 'day' : 'days'} to build`,
      actionLabel: actionLabelFor(o),
      disabled: o.refusal != null,
      jobLabels: o.jobs.map(jobLabel),
    })),
  };
}

function actionLabelFor(o: FacilityBuildOption): string {
  if (o.refusal === 'cannot-afford') return `Costs ${money(o.cost)} — not enough cash`;
  if (o.refusal === 'at-ceiling') {
    // A ceiling of zero is not "built out", it is a kind this tier does not
    // have — the Body Shop before Tier 3. Saying "built out" there would read
    // as an achievement instead of a lock.
    return o.ceiling === 0
      ? 'Not available at this tier'
      : 'Built out to the tier limit';
  }
  return `Build ${units(o.kind, o.units)} — ${money(o.cost)}`;
}
