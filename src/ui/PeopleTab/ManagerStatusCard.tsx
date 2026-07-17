import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { useTheme } from '../theme';
import { Surface, SectionHeader, Badge, Meter, type BadgeTone } from '../kit';
import type {
  ManagerStatusModel,
  UcmCapabilityFact,
  UcmAxis,
  DeptManagerFact,
  DeptManagerKey,
} from './managerStatus';

/**
 * Plain-language copy for each UCM capability, in all three states. The card —
 * never the composition root — owns the wording (same split as
 * `MarketStatePanel`'s band copy). Each names the delegation explicitly
 * ("Your UCM auto-prices…") per the #325 acceptance criteria, and the manual
 * line names what YOU do so the hand-off is legible in both directions.
 */
const UCM_COPY: Record<
  UcmAxis,
  { title: string; delegated: string; advising: string; manual: string }
> = {
  pricing: {
    title: 'Used pricing',
    delegated: 'Your UCM auto-prices new inventory to your posture.',
    advising: 'Your UCM advises on pricing — auto-pricing unlocks as their skill grows.',
    manual: 'You price every unit by hand.',
  },
  condition_reading: {
    title: 'Trade-ins & sourcing',
    delegated: 'Your UCM approves trade-ins and auto-fills the lot for you.',
    advising:
      'Your UCM advises on appraisals — auto-approval and sourcing unlock as their skill grows.',
    manual: 'Trade-ins escalate to you and you source the lot by hand.',
  },
  t_o_closing: {
    title: 'Discount desking',
    delegated: 'Your UCM desks below-floor discounts for you.',
    advising:
      'Below-floor discounts still reach you — desking unlocks as your UCM’s closing skill grows.',
    manual: 'Below-floor discounts come to your desk.',
  },
};

type UcmState = 'delegated' | 'advising' | 'manual';

function ucmState(fact: UcmCapabilityFact): UcmState {
  if (fact.delegated) return 'delegated';
  return fact.skill === null ? 'manual' : 'advising';
}

const STATE_BADGE: Record<UcmState, { label: string; tone: BadgeTone }> = {
  delegated: { label: 'Delegated', tone: 'positive' },
  advising: { label: 'Advising', tone: 'info' },
  manual: { label: 'Manual', tone: 'neutral' },
};

/** Human ladder-rung labels for the fixed-ops managers. */
const DEPT_META: Record<
  DeptManagerKey,
  { label: string; functions: Record<string, string> }
> = {
  service: {
    label: 'Service Manager',
    functions: {
      par: 'Parts par',
      pricing: 'Service pricing',
      marketing: 'Marketing',
      rush: 'Rush parts',
      capacity: 'Capacity routing',
    },
  },
  body: {
    label: 'Body Shop Manager',
    functions: {
      par: 'Parts par',
      channel: 'Insurance / retail channel',
      rush: 'Rush parts',
      capacity: 'Capacity routing',
    },
  },
};

function UcmRow({ fact }: { fact: UcmCapabilityFact }) {
  const t = useTheme();
  const copy = UCM_COPY[fact.axis];
  const state = ucmState(fact);
  const badge = STATE_BADGE[state];

  const header: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
  };
  const title: TextStyle = { ...t.typography.label, color: t.colors.textSecondary, flex: 1 };
  const body: TextStyle = {
    ...t.typography.caption,
    color: t.colors.textMuted,
    marginTop: t.spacing.xxs,
  };
  const meterWrap: ViewStyle = { marginTop: t.spacing.sm };

  return (
    <View
      style={{ paddingVertical: t.spacing.sm }}
      accessibilityRole="text"
      accessibilityLabel={`${copy.title}: ${badge.label}. ${copy[state]}`}
    >
      <View style={header}>
        <Text style={title} numberOfLines={1}>
          {copy.title}
        </Text>
        <Badge label={badge.label} tone={badge.tone} variant={state === 'manual' ? 'outline' : 'soft'} />
      </View>
      <Text style={body}>{copy[state]}</Text>
      {fact.skill !== null && (
        <View style={meterWrap}>
          <Meter
            label={`Skill vs. gate (${fact.threshold})`}
            value={fact.skill / 100}
            readout={`${Math.round(fact.skill)} / ${fact.threshold}`}
            tone={fact.delegated ? 'positive' : 'primary'}
          />
        </View>
      )}
    </View>
  );
}

function DeptRow({ fact }: { fact: DeptManagerFact }) {
  const t = useTheme();
  const meta = DEPT_META[fact.dept];

  const header: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
  };
  const title: TextStyle = { ...t.typography.label, color: t.colors.textSecondary, flex: 1 };
  const body: TextStyle = {
    ...t.typography.caption,
    color: t.colors.textMuted,
    marginTop: t.spacing.xxs,
  };
  const rungs: ViewStyle = {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: t.spacing.xs,
    marginTop: t.spacing.sm,
  };

  const summary = fact.present
    ? 'Runs the fixed-ops floor for you — each function switches on as their skill clears its gate.'
    : 'No manager on staff — you run the shop by hand.';

  return (
    <View
      style={{ paddingVertical: t.spacing.sm }}
      accessibilityRole="text"
      accessibilityLabel={`${meta.label}: ${fact.present ? 'on staff' : 'absent'}. ${summary}`}
    >
      <View style={header}>
        <Text style={title} numberOfLines={1}>
          {meta.label}
        </Text>
        <Badge
          label={fact.present ? 'On staff' : 'Absent'}
          tone={fact.present ? 'positive' : 'neutral'}
          variant={fact.present ? 'soft' : 'outline'}
        />
      </View>
      <Text style={body}>{summary}</Text>
      {fact.present && (
        <View style={rungs}>
          {fact.functions.map((rung) => (
            <Badge
              key={rung.fn}
              label={meta.functions[rung.fn] ?? rung.fn}
              tone={rung.automated ? 'positive' : 'neutral'}
              variant={rung.automated ? 'soft' : 'outline'}
            />
          ))}
        </View>
      )}
    </View>
  );
}

/**
 * Manager status card (#325) — surfaces the capabilities the player has
 * delegated to their managers so silent automation reads as *permission*
 * (macro-loop-spine §2). Renders the three UCM channel-desk gates (advise vs.
 * act) and the two fixed-ops managers with the functions they run, always
 * closing on the override invariant (§5). Pure presentation — the composition
 * root (`buildManagerStatus`) assembles the model from `world`.
 */
export function ManagerStatusCard({ model }: { model: ManagerStatusModel }) {
  const t = useTheme();
  const empty: TextStyle = { ...t.typography.caption, color: t.colors.textMuted };
  const caption: TextStyle = { ...empty, marginTop: t.spacing.xxs, marginBottom: t.spacing.xs };
  const dividedSection: ViewStyle = {
    marginTop: t.spacing.lg,
    paddingTop: t.spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.colors.borderMuted,
  };
  const footer: TextStyle = {
    ...t.typography.caption,
    color: t.colors.textMuted,
    fontStyle: 'italic',
  };

  return (
    <Surface testID="manager-status-card" style={{ marginTop: t.spacing.md }}>
      <View testID="manager-status-ucm">
        <SectionHeader title="Used-Car Manager" />
        <Text style={caption}>
          {model.ucmPresent
            ? 'What your used-car desk handles for you — advising sharpens on hire; acting is earned.'
            : 'Hire a used-car manager to start delegating the used desk.'}
        </Text>
        {model.ucm.map((fact) => (
          <UcmRow key={fact.axis} fact={fact} />
        ))}
      </View>

      <View style={dividedSection} testID="manager-status-depts">
        <SectionHeader title="Fixed-Ops Managers" />
        <View style={{ marginTop: t.spacing.sm }}>
          {model.departments.map((fact) => (
            <DeptRow key={fact.dept} fact={fact} />
          ))}
        </View>
      </View>

      <View style={dividedSection} testID="manager-status-override">
        <Text style={footer}>
          You can always override — set any unit’s price yourself, or force any deal back to
          your desk. Delegation is permission, not amputation.
        </Text>
      </View>
    </Surface>
  );
}
