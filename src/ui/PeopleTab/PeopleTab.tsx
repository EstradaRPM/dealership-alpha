import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '../theme';
import { SectionHeader, Surface, Button, Badge, Meter } from '../kit';
import { ChipRow } from '../DeptControls';
import { ManagerStatusCard } from './ManagerStatusCard';
import type { ManagerStatusModel } from './managerStatus';

/** One skill axis as a staff card shows it (#347). */
export interface PeopleSkillRead {
  readonly id: string;
  /** Plain-language axis name, from `data/staff-skills.json`. */
  readonly label: string;
  /** Current value on the 0…`cap` scale. */
  readonly value: number;
  readonly cap: number;
}

/** A legal promotion target, already labelled for display (#324). */
export interface PeoplePromotionOption {
  readonly toRoleId: string;
  readonly label: string;
}

/**
 * A raise this person is waiting on an answer to (#356). Both wages are carried
 * because the prompt states both: what they are on, and what they are asking
 * for. The player is choosing between two numbers, so both have to be on screen.
 */
export interface PeopleRaiseAsk {
  /** What they are paid today. */
  readonly currentWage: number;
  /** What they are asking to be paid — or what a rival has offered them. */
  readonly askedWage: number;
  /**
   * The rival who made the offer (#357), or `null` when this is the person
   * asking for themselves. One prompt covers both: with a name on it the two
   * buttons become **Match** / **Let them go**, and a deadline line appears.
   */
  readonly rivalName?: string | null;
  /** The day they leave unless the offer is matched. Set with `rivalName`. */
  readonly deadlineDay?: number | null;
}

/** One person on payroll. */
export interface PeopleRosterMember {
  readonly id: string;
  readonly name: string;
  readonly roleLabel: string;
  /** 0–1. How well they do the work (the `effectiveness` composite). */
  readonly workQuality: number;
  /** 0–1. How straight they play it (the `trustworthiness` composite). */
  readonly honesty: number;
  /** 0–1, or `null` when morale isn't being tracked for this staffer. */
  readonly morale: number | null;
  /** What they are worth right now, 1–5 — climbs as their skills grow (#353). */
  readonly grade: number;
  /**
   * The grade their wage is set at (#353). Equal to `grade` for a fresh hire;
   * once they outgrow it the card states BOTH, because the gap is the thing
   * the player is about to be asked to close.
   */
  readonly paidGrade: number;
  /** What this person costs per day — `wage(role, paidGrade)`, the sum the ledger charges. */
  readonly dailyWage: number;
  readonly skills: readonly PeopleSkillRead[];
  readonly promotions: readonly PeoplePromotionOption[];
  /** Their outstanding raise demand, or `null` when they are not asking (#356). */
  readonly raise: PeopleRaiseAsk | null;
}

/** One person you could hire today. */
export interface PeopleCandidate {
  readonly id: string;
  readonly name: string;
  readonly roleLabel: string;
  readonly traits: readonly string[];
  readonly workQuality: number;
  readonly honesty: number;
  /** The grade they'd sign at, 1–5 — what their wage is priced off (#353). */
  readonly grade: number;
  /** What they'd cost per day once hired. */
  readonly dailyWage: number;
  readonly skills: readonly PeopleSkillRead[];
  /** One-time sign-on fee — distinct from the wage, so the card labels both. */
  readonly hiringCost: number;
}

/** `$340/day` — the wage grammar shared by every card on this surface. */
function wageText(dailyWage: number): string {
  return `$${dailyWage.toLocaleString()}/day`;
}

export interface PeopleRoleOption {
  readonly id: string;
  readonly label: string;
}

export interface PeopleHiringModel {
  readonly roleOptions: readonly PeopleRoleOption[];
  readonly selectedRoleId: string;
  readonly candidates: readonly PeopleCandidate[];
  /** Cash on hand — a candidate you can't afford can't be hired. */
  readonly cash: number;
}

/**
 * One job's desks at the current tier (#352). This replaced the single
 * "N of cap" line: scarcity is per role, so "3 of 4 people" told the player
 * nothing about the job they were actually shopping for.
 */
export interface PeopleSlotRow {
  readonly roleId: string;
  readonly label: string;
  readonly filled: number;
  readonly total: number;
  /**
   * Whether an open desk here can be filled by hiring. False for the
   * promotion-only jobs, whose desks are reached from a roster card instead.
   */
  readonly hireable: boolean;
}

export interface PeopleTabProps {
  /** The delegated-authority read-model (#325). */
  managerStatus: ManagerStatusModel;
  /** Everyone on payroll right now. */
  roster: readonly PeopleRosterMember[];
  /**
   * What the whole roster burns every day (#353). Read off the engine's own
   * sum rather than added up here — the number on screen has to be the number
   * the overnight drain charges, and two additions can disagree.
   */
  dailyPayroll: number;
  /** The desks this tier opened, per job (#352). */
  slots: readonly PeopleSlotRow[];
  /** The candidate pool + the role you're shopping for. */
  hiring: PeopleHiringModel;
  onSelectHiringRole: (roleId: string) => void;
  onHire: (candidateId: string) => void;
  onPromote: (staffId: string, toRoleId: string) => void;
  onFire: (staffId: string) => void;
  /** Pay the asked wage (#356) — the member's wage moves from the next drain. */
  onAcceptRaise: (staffId: string) => void;
  /** Turn the demand down (#356) — the wage holds, morale doesn't. */
  onRefuseRaise: (staffId: string) => void;
}

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
    <View style={{ marginTop: t.spacing.sm, gap: t.spacing.sm }}>
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
    <View style={{ marginTop: t.spacing.md, gap: t.spacing.sm }}>
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
 * The raise moment (#356, C1 R2) — the one place growth turns into a decision
 * instead of a drift. Two numbers and two buttons, and the numbers are stated
 * in the same `$N/day` grammar as every other wage on this surface so the
 * comparison needs no translating.
 *
 * It sits on the person's own card rather than in a banner: the question is
 * about *them*, and their grade, skills and morale are the evidence the player
 * answers it on. Nothing here is a temperature word — "asking for" and "on now"
 * name what the numbers are.
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
  const s = makeStyles(t);
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

function RosterCard({
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
  const s = makeStyles(t);
  // A grade that has outgrown the paid one is stated as TWO numbers, never
  // averaged into one (#353): the wage is set at `paidGrade` and stays there
  // until a raise is agreed, so a blended figure would name a wage nobody is
  // paying and hide the gap the raise slice fires on.
  const outgrown = member.grade !== member.paidGrade;
  const payLine = outgrown
    ? `Grade ${member.grade} · Paid at grade ${member.paidGrade} · ${wageText(member.dailyWage)}`
    : `Grade ${member.grade} · ${wageText(member.dailyWage)}`;
  return (
    <Surface testID={`people-roster-card-${member.id}`} style={s.card}>
      <View style={s.cardHead}>
        <View style={s.cardHeadText}>
          <Text style={s.personName}>{member.name}</Text>
          <Text style={s.personRole}>{member.roleLabel}</Text>
          <Text style={s.payLine} testID={`people-roster-pay-${member.id}`}>
            {payLine}
          </Text>
        </View>
      </View>
      <CompositeMeters
        workQuality={member.workQuality}
        honesty={member.honesty}
        morale={member.morale}
      />
      <SkillList skills={member.skills} idPrefix={`roster-${member.id}`} />
      <RaisePrompt member={member} onAccept={onAcceptRaise} onRefuse={onRefuseRaise} />
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
    </Surface>
  );
}

/**
 * The slot board (#352) — every job this tier opened, how many of its desks are
 * filled, and (for the jobs you can hire into) an open desk you can press to
 * start shopping for that job. An empty slot IS the hire affordance: the board
 * is the only place the ceiling is stated, so the surface never re-derives it.
 */
function SlotBoard({
  slots,
  selectedRoleId,
  onSelectHiringRole,
}: {
  slots: readonly PeopleSlotRow[];
  selectedRoleId: string;
  onSelectHiringRole: (roleId: string) => void;
}) {
  const t = useTheme();
  const s = makeStyles(t);
  if (slots.length === 0) return null;
  return (
    <View style={s.slotBoard} testID="people-slot-board">
      {slots.map((row) => {
        const open = row.total - row.filled;
        const canHire = row.hireable && open > 0;
        return (
          <Pressable
            key={row.roleId}
            testID={`people-slot-${row.roleId}`}
            onPress={canHire ? () => onSelectHiringRole(row.roleId) : undefined}
            disabled={!canHire}
            accessibilityRole={canHire ? 'button' : undefined}
            // Mirrors the visible "filled of total" rather than restating it
            // as "open of total" — two readings of the same row is a way to
            // get the number wrong out loud.
            accessibilityLabel={
              canHire
                ? `Hire a ${row.label} — ${row.filled} of ${row.total} desks filled`
                : undefined
            }
            style={[
              s.slotRow,
              row.roleId === selectedRoleId && s.slotRowSelected,
            ]}
          >
            <Text style={s.slotLabel}>{row.label}</Text>
            <Text style={s.slotCount} testID={`people-slot-count-${row.roleId}`}>
              {row.filled} of {row.total}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function CandidateCard({
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
  const s = makeStyles(t);
  const blocked = !affordable || roleFull;
  return (
    <Surface testID={`people-candidate-card-${candidate.id}`} style={s.card}>
      <View style={s.cardHead}>
        <View style={s.cardHeadText}>
          <Text style={s.personName}>{candidate.name}</Text>
          <Text style={s.personRole}>{candidate.roleLabel}</Text>
          {/* The two numbers the hire is now made on (#353): what they cost to
              keep, here, and what they cost to sign, on the right. */}
          <Text style={s.payLine} testID={`people-candidate-pay-${candidate.id}`}>
            {`Grade ${candidate.grade} · ${wageText(candidate.dailyWage)}`}
          </Text>
        </View>
        <View style={s.priceColumn}>
          {/* Priced off this person's own wage (#355), so two applicants for the
              same desk quote different fees — it is a number to compare, not a
              constant to skim past. */}
          <Text style={s.price} testID={`people-candidate-fee-${candidate.id}`}>
            ${candidate.hiringCost.toLocaleString()}
          </Text>
          <Text style={s.priceCaption}>to sign</Text>
        </View>
      </View>
      {candidate.traits.length > 0 && (
        <View style={s.traitRow}>
          {candidate.traits.map((trait) => (
            <Badge key={trait} label={trait} tone="neutral" variant="soft" />
          ))}
        </View>
      )}
      <CompositeMeters workQuality={candidate.workQuality} honesty={candidate.honesty} />
      <SkillList skills={candidate.skills} idPrefix={`candidate-${candidate.id}`} />
      <View style={s.actionRow}>
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
    </Surface>
  );
}

/**
 * The People surface (one of the fixed 5-tab IA — always present, never
 * tier-gated). #347 rebuilds it as the org tab the locked IA §4 charters: the
 * **roster**, the **hiring pool**, and manager delegation, as three sections of
 * one surface. Before this, the tab rendered only the delegation card (three
 * ABSENT rows at Tier 1) while the roster and the candidate pool sat two levels
 * down inside Operations → Prep → Hire Staff — the wrong tab entirely.
 *
 * Hiring resolves **in place**: pressing Hire updates the roster section right
 * here, with no full-screen route change (IA §3 — the tab bar never unmounts).
 *
 * There is deliberately **no Development section**. IA rules 1 + 3: a section
 * ships when there's a decision with teeth behind it, and surfaces for
 * mechanics that don't exist do not render — no grayed foreshadow tile, no
 * "training coming soon". It arrives with the training mechanic.
 *
 * Presentation only — the composition root builds the models and owns writes.
 */
export function PeopleTab({
  managerStatus,
  roster,
  dailyPayroll,
  slots,
  hiring,
  onSelectHiringRole,
  onHire,
  onPromote,
  onFire,
  onAcceptRaise,
  onRefuseRaise,
}: PeopleTabProps) {
  const t = useTheme();
  const s = makeStyles(t);
  const desks = slots.reduce((n, r) => n + r.total, 0);
  const filled = slots.reduce((n, r) => n + r.filled, 0);
  const everyDeskFilled = desks > 0 && filled >= desks;
  // The ceiling that decides whether a candidate can be hired is the SELECTED
  // job's desks, not the store's total headcount (#352) — you can be full on
  // salespeople and still have the service desk open.
  const selectedSlot = slots.find((r) => r.roleId === hiring.selectedRoleId);
  const roleFull = selectedSlot != null && selectedSlot.filled >= selectedSlot.total;

  return (
    <View style={s.region} testID="people-tab">
      <SectionHeader title="People" />

      <View style={s.regionBody} testID="people-region-roster">
        <Surface testID="people-roster">
          <SectionHeader
            title="Your Team"
            accessory={<Text style={s.count}>{`${filled} of ${desks}`}</Text>}
          />
          <Text style={s.hint}>
            {roster.length === 0
              ? 'Nobody on payroll — you are working the floor alone.'
              : everyDeskFilled
                ? 'Every desk the store has room for is filled.'
                : 'Everyone drawing a paycheck from this store.'}
          </Text>
          <SlotBoard
            slots={slots}
            selectedRoleId={hiring.selectedRoleId}
            onSelectHiringRole={onSelectHiringRole}
          />
          {/* What the desks above cost to keep occupied (#353). Nobody on
              payroll renders NO row — a "$0" line is a number the player can do
              nothing with, and the empty-roster hint already says it. */}
          {roster.length > 0 && (
            <View style={s.payrollRow}>
              <Text style={s.slotLabel}>Daily payroll</Text>
              <Text style={s.slotCount} testID="people-payroll-total">
                {wageText(dailyPayroll)}
              </Text>
            </View>
          )}
        </Surface>
        {roster.map((member) => (
          <RosterCard
            key={member.id}
            member={member}
            onPromote={(toRoleId) => onPromote(member.id, toRoleId)}
            onFire={() => onFire(member.id)}
            onAcceptRaise={() => onAcceptRaise(member.id)}
            onRefuseRaise={() => onRefuseRaise(member.id)}
          />
        ))}
      </View>

      <View style={s.region} testID="people-region-hiring">
        <Surface testID="people-hiring">
          <SectionHeader title="Hiring" />
          <Text style={s.hint}>
            Who is looking for work today. A fresh set walks in every morning.
          </Text>
          <View style={s.roleRow}>
            <ChipRow
              options={hiring.roleOptions.map((r) => ({ id: r.id, label: r.label }))}
              selectedId={hiring.selectedRoleId}
              onSelect={onSelectHiringRole}
              testID="people-hiring-roles"
            />
          </View>
        </Surface>
        {hiring.candidates.length === 0 ? (
          <Surface testID="people-hiring-empty" style={s.card}>
            <Text style={s.hint}>Nobody is applying for this job today.</Text>
          </Surface>
        ) : (
          hiring.candidates.map((c) => (
            <CandidateCard
              key={c.id}
              candidate={c}
              affordable={hiring.cash >= c.hiringCost}
              roleFull={roleFull}
              onHire={() => onHire(c.id)}
            />
          ))
        )}
      </View>

      <View style={s.region} testID="people-region-managers">
        <ManagerStatusCard model={managerStatus} />
      </View>
    </View>
  );
}

function makeStyles(t: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    region: { marginTop: t.spacing.xl },
    regionBody: { marginTop: t.spacing.md },
    card: { marginTop: t.spacing.md },
    cardHead: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: t.spacing.md,
    },
    cardHeadText: { flex: 1 },
    personName: { ...t.typography.body, color: t.colors.textPrimary },
    personRole: {
      ...t.typography.caption,
      color: t.colors.textMuted,
      marginTop: t.spacing.xxs,
    },
    payLine: {
      ...t.typography.statLabel,
      color: t.colors.textSecondary,
      fontVariant: ['tabular-nums'],
      marginTop: t.spacing.xxs,
    },
    priceColumn: { alignItems: 'flex-end' },
    price: {
      ...t.typography.body,
      color: t.colors.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    priceCaption: {
      ...t.typography.caption,
      color: t.colors.textMuted,
      marginTop: t.spacing.xxs,
    },
    count: { ...t.typography.statLabel, color: t.colors.textSecondary },
    hint: {
      ...t.typography.caption,
      color: t.colors.textMuted,
      marginTop: t.spacing.xxs,
    },
    traitRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: t.spacing.xs,
      marginTop: t.spacing.sm,
    },
    roleRow: { marginTop: t.spacing.sm },
    slotBoard: { marginTop: t.spacing.md, gap: t.spacing.xxs },
    slotRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: t.spacing.md,
      paddingVertical: t.spacing.sm,
      paddingHorizontal: t.spacing.md,
      borderRadius: t.radius.sm,
      backgroundColor: t.colors.surfaceRaised,
    },
    // Same row grammar as a slot row (label left, figure right), separated by a
    // rule so the total reads as the board's footer rather than one more desk.
    payrollRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: t.spacing.md,
      marginTop: t.spacing.sm,
      paddingTop: t.spacing.sm,
      paddingHorizontal: t.spacing.md,
      borderTopWidth: 1,
      borderTopColor: t.colors.border,
    },
    slotRowSelected: {
      borderWidth: 1,
      borderColor: t.colors.primary,
    },
    // Set off from the card's read-only meters by its own raised panel and
    // border: everything above it is information, this is the one thing on the
    // card asking to be answered.
    raisePrompt: {
      marginTop: t.spacing.md,
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
    slotLabel: { ...t.typography.caption, color: t.colors.textSecondary },
    slotCount: {
      ...t.typography.statLabel,
      color: t.colors.textPrimary,
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
