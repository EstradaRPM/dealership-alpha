import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme';
import { Collapsible, Button, Badge, Meter } from '../kit';
import {
  wageText,
  type PeopleCandidate,
  type PeopleRosterMember,
  type PeopleSkillRead,
} from './peopleModel';

function CompositeMeters({
  workQuality,
  honesty,
  morale,
}: {
  workQuality: number;
  honesty: number;
  morale?: number | null;
}) {
  const t = useTheme();
  return (
    <View style={{ gap: t.spacing.sm }}>
      <Meter
        label="Work quality"
        value={workQuality}
        readout={`${Math.round(workQuality * 100)}%`}
        tone={workQuality >= 0.7 ? 'positive' : workQuality >= 0.45 ? 'primary' : 'danger'}
      />
      <Meter
        label="Honesty"
        value={honesty}
        readout={`${Math.round(honesty * 100)}%`}
        tone={honesty >= 0.7 ? 'positive' : honesty >= 0.45 ? 'primary' : 'danger'}
      />
      {morale != null && (
        <Meter
          label="Morale"
          value={morale}
          readout={`${Math.round(morale * 100)}%`}
          tone={morale >= 0.6 ? 'positive' : morale >= 0.35 ? 'primary' : 'danger'}
        />
      )}
    </View>
  );
}

function SkillList({
  skills,
  idPrefix,
}: {
  skills: readonly PeopleSkillRead[];
  idPrefix: string;
}) {
  const t = useTheme();
  if (skills.length === 0) return null;
  return (
    <View style={{ marginTop: t.spacing.lg, gap: t.spacing.sm }}>
      {skills.map((skill) => (
        <Meter
          key={skill.id}
          label={skill.label}
          value={skill.cap > 0 ? skill.value / skill.cap : 0}
          readout={String(Math.round(skill.value))}
          fillTestID={`${idPrefix}-skill-fill-${skill.id}`}
        />
      ))}
    </View>
  );
}

/**
 * The two-line figure block on the right of a person's header — the numbers the
 * decision about them is made on, in one column so two people stacked in a
 * panel compare down the page.
 */
function PayColumn({
  primary,
  caption,
  testID,
}: {
  primary: string;
  caption: string;
  testID?: string;
}) {
  const t = useTheme();
  const s = makeCardStyles(t);
  return (
    <View style={s.payColumn}>
      <Text style={s.payFigure} testID={testID}>
        {primary}
      </Text>
      <Text style={s.payCaption}>{caption}</Text>
    </View>
  );
}

/**
 * The raise moment (#356, C1 R2) — the one place growth turns into a decision
 * instead of a drift. Two numbers and two buttons, and the numbers are stated
 * in the same `$N/day` grammar as every other wage on this surface so the
 * comparison needs no translating.
 *
 * It sits on the person's own card rather than in a banner: the question is
 * about *them*, and their grade, skills and morale are the evidence the player
 * answers it on. Nothing here is a temperature word — "asking for" and "on now"
 * name what the numbers are. It is the card's **pinned** band, so folding the
 * person shut never folds away a question waiting on an answer.
 *
 * **A rival's offer is this same prompt with a name and a deadline on it**
 * (#357). Not a second component and not a second modal: the player learns one
 * moment and it does both jobs. What changes is the sentence (who is offering)
 * and what the buttons mean — declining a rival is a departure, so it says
 * `Let them go` rather than `Refuse`, and the deadline is stated as an exact
 * day rather than a countdown the player would have to do arithmetic on.
 */
function RaisePrompt({
  member,
  onAccept,
  onRefuse,
}: {
  member: PeopleRosterMember;
  onAccept: () => void;
  onRefuse: () => void;
}) {
  const t = useTheme();
  const s = makeCardStyles(t);
  const raise = member.raise;
  if (!raise) return null;
  const rival = raise.rivalName;
  const askLine = rival
    ? `${rival} offered ${wageText(raise.askedWage)}. On ${wageText(raise.currentWage)} now.`
    : `Asking for ${wageText(raise.askedWage)}. On ${wageText(raise.currentWage)} now.`;
  return (
    <View style={s.raisePrompt} testID={`people-raise-${member.id}`}>
      <Text style={s.raiseAsk} testID={`people-raise-ask-${member.id}`}>
        {askLine}
      </Text>
      {rival != null && raise.deadlineDay != null && (
        <Text style={s.raiseDeadline} testID={`people-raise-deadline-${member.id}`}>
          {`They leave on day ${raise.deadlineDay} unless you match.`}
        </Text>
      )}
      <View style={s.actionRow}>
        <Button
          label={rival ? 'Match' : 'Pay it'}
          onPress={onAccept}
          accessibilityLabel={
            rival
              ? `Match ${rival}'s offer and pay ${member.name} ${wageText(raise.askedWage)}`
              : `Pay ${member.name} ${wageText(raise.askedWage)}`
          }
          testID={`people-raise-accept-${member.id}`}
        />
        <Button
          label={rival ? 'Let them go' : 'Refuse'}
          variant="secondary"
          onPress={onRefuse}
          accessibilityLabel={
            rival
              ? `Let ${member.name} go to ${rival}`
              : `Refuse ${member.name} the raise`
          }
          testID={`people-raise-refuse-${member.id}`}
        />
      </View>
    </View>
  );
}

/**
 * One person on payroll, folded shut to the four things you compare people on —
 * name, job, grade, wage — and opening onto the evidence behind them (the
 * composites, every skill axis) plus the two things you can do about them.
 *
 * Shut by default: a department of five with three meters and six skill axes
 * apiece is a wall of bars nobody reads. A card whose person is asking for
 * money opens itself, because that card is a question, not a readout.
 */
export function RosterCard({
  member,
  onPromote,
  onFire,
  onAcceptRaise,
  onRefuseRaise,
}: {
  member: PeopleRosterMember;
  onPromote: (toRoleId: string) => void;
  onFire: () => void;
  onAcceptRaise: () => void;
  onRefuseRaise: () => void;
}) {
  const t = useTheme();
  const s = makeCardStyles(t);
  // A grade that has outgrown the paid one is stated as TWO numbers, never
  // averaged into one (#353): the wage is set at `paidGrade` and stays there
  // until a raise is agreed, so a blended figure would name a wage nobody is
  // paying and hide the gap the raise slice fires on.
  const outgrown = member.grade !== member.paidGrade;
  const payLine = outgrown
    ? `Grade ${member.grade} · Paid at grade ${member.paidGrade} · ${wageText(member.dailyWage)}`
    : `Grade ${member.grade} · ${wageText(member.dailyWage)}`;
  const asking = member.raise != null;

  return (
    <Collapsible
      variant="inset"
      style={s.card}
      testID={`people-roster-card-${member.id}`}
      title={member.name}
      summary={member.roleLabel}
      defaultExpanded={asking}
      accessory={
        asking ? (
          <Badge label="Needs an answer" tone="info" variant="soft" textCase="sentence" />
        ) : undefined
      }
      pinned={
        <View style={s.offerBand}>
          {/* What this person costs, always visible — it is the figure every
              other decision on the card is weighed against, so folding them
              shut must never fold it away. */}
          <Text style={s.payLine} testID={`people-roster-pay-${member.id}`}>
            {payLine}
          </Text>
          {asking && (
            <RaisePrompt member={member} onAccept={onAcceptRaise} onRefuse={onRefuseRaise} />
          )}
        </View>
      }
    >
      <CompositeMeters
        workQuality={member.workQuality}
        honesty={member.honesty}
        morale={member.morale}
      />
      <SkillList skills={member.skills} idPrefix={`roster-${member.id}`} />
      <View style={s.actionRow}>
        {member.promotions.map((p) => (
          <Button
            key={p.toRoleId}
            label={`Promote to ${p.label}`}
            variant="secondary"
            onPress={() => onPromote(p.toRoleId)}
            testID={`people-promote-${member.id}-${p.toRoleId}`}
          />
        ))}
        <Button
          label="Let go"
          variant="ghost"
          onPress={onFire}
          accessibilityLabel={`Let go of ${member.name}`}
          testID={`people-fire-${member.id}`}
        />
      </View>
    </Collapsible>
  );
}

/**
 * One applicant. Shut, it states the whole offer — who, what job, what they'd
 * cost to keep, what they'd cost to sign — and carries the Hire button, because
 * hiring is the action this panel exists for and it must never be a second tap
 * behind a fold. Opening shows the evidence: traits, composites, skill axes.
 */
export function CandidateCard({
  candidate,
  affordable,
  roleFull,
  onHire,
}: {
  candidate: PeopleCandidate;
  affordable: boolean;
  /** Every desk for THIS job is taken (#352) — a different job may still be open. */
  roleFull: boolean;
  onHire: () => void;
}) {
  const t = useTheme();
  const s = makeCardStyles(t);
  const blocked = !affordable || roleFull;
  return (
    <Collapsible
      variant="inset"
      style={s.card}
      testID={`people-candidate-card-${candidate.id}`}
      title={candidate.name}
      summary={candidate.roleLabel}
      defaultExpanded={false}
      accessory={
        // Priced off this person's own wage (#355), so two applicants for the
        // same desk quote different fees — it is a number to compare, not a
        // constant to skim past.
        <PayColumn
          primary={`$${candidate.hiringCost.toLocaleString()}`}
          caption="to sign"
          testID={`people-candidate-fee-${candidate.id}`}
        />
      }
      pinned={
        <View style={s.offerBand}>
          {/* The two numbers the hire is now made on (#353): what they cost to
              keep, and the grade that price comes from. */}
          <Text style={s.payLine} testID={`people-candidate-pay-${candidate.id}`}>
            {`Grade ${candidate.grade} · ${wageText(candidate.dailyWage)}`}
          </Text>
          <Button
            label={
              roleFull
                ? 'No desk open for this job'
                : affordable
                  ? `Hire — $${candidate.hiringCost.toLocaleString()}`
                  : "Can't afford"
            }
            onPress={blocked ? undefined : onHire}
            disabled={blocked}
            testID={`people-hire-${candidate.id}`}
          />
        </View>
      }
    >
      {candidate.traits.length > 0 && (
        <View style={s.traitRow}>
          {candidate.traits.map((trait) => (
            <Badge key={trait} label={trait} tone="neutral" variant="soft" />
          ))}
        </View>
      )}
      <View style={s.metersBlock}>
        <CompositeMeters workQuality={candidate.workQuality} honesty={candidate.honesty} />
      </View>
      <SkillList skills={candidate.skills} idPrefix={`candidate-${candidate.id}`} />
    </Collapsible>
  );
}

function makeCardStyles(t: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    card: { marginTop: t.spacing.sm },
    payColumn: { alignItems: 'flex-end' },
    payFigure: {
      ...t.typography.bodyStrong,
      color: t.colors.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    payCaption: {
      ...t.typography.caption,
      color: t.colors.textMuted,
      marginTop: t.spacing.xxs,
    },
    payLine: {
      ...t.typography.statLabel,
      color: t.colors.textSecondary,
      fontVariant: ['tabular-nums'],
    },
    metersBlock: { marginTop: t.spacing.md },
    offerBand: { gap: t.spacing.sm },
    traitRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: t.spacing.xs,
    },
    // Set off from the card's read-only meters by its own raised panel and
    // border: everything above it is information, this is the one thing on the
    // card asking to be answered.
    raisePrompt: {
      padding: t.spacing.md,
      borderRadius: t.radius.sm,
      borderWidth: 1,
      borderColor: t.colors.primary,
      backgroundColor: t.colors.surfaceRaised,
    },
    raiseAsk: {
      ...t.typography.body,
      color: t.colors.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    // The deadline is the consequence, not the offer — secondary text under the
    // sentence that states the numbers (#357).
    raiseDeadline: {
      ...t.typography.caption,
      color: t.colors.textSecondary,
      marginTop: t.spacing.xs,
      fontVariant: ['tabular-nums'],
    },
    actionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: t.spacing.sm,
      marginTop: t.spacing.md,
    },
  });
}
