import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
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
  readonly skills: readonly PeopleSkillRead[];
  readonly promotions: readonly PeoplePromotionOption[];
}

/** One person you could hire today. */
export interface PeopleCandidate {
  readonly id: string;
  readonly name: string;
  readonly roleLabel: string;
  readonly traits: readonly string[];
  readonly workQuality: number;
  readonly honesty: number;
  readonly skills: readonly PeopleSkillRead[];
  readonly hiringCost: number;
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
  /** Bodies the current tier allows on payroll (`null` = uncapped). */
  readonly headcountCap: number | null;
}

export interface PeopleTabProps {
  /** The delegated-authority read-model (#325). */
  managerStatus: ManagerStatusModel;
  /** Everyone on payroll right now. */
  roster: readonly PeopleRosterMember[];
  /** The candidate pool + the role you're shopping for. */
  hiring: PeopleHiringModel;
  onSelectHiringRole: (roleId: string) => void;
  onHire: (candidateId: string) => void;
  onPromote: (staffId: string, toRoleId: string) => void;
  onFire: (staffId: string) => void;
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

function RosterCard({
  member,
  onPromote,
  onFire,
}: {
  member: PeopleRosterMember;
  onPromote: (toRoleId: string) => void;
  onFire: () => void;
}) {
  const t = useTheme();
  const s = makeStyles(t);
  return (
    <Surface testID={`people-roster-card-${member.id}`} style={s.card}>
      <View style={s.cardHead}>
        <View style={s.cardHeadText}>
          <Text style={s.personName}>{member.name}</Text>
          <Text style={s.personRole}>{member.roleLabel}</Text>
        </View>
      </View>
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
    </Surface>
  );
}

function CandidateCard({
  candidate,
  affordable,
  atCap,
  onHire,
}: {
  candidate: PeopleCandidate;
  affordable: boolean;
  atCap: boolean;
  onHire: () => void;
}) {
  const t = useTheme();
  const s = makeStyles(t);
  const blocked = !affordable || atCap;
  return (
    <Surface testID={`people-candidate-card-${candidate.id}`} style={s.card}>
      <View style={s.cardHead}>
        <View style={s.cardHeadText}>
          <Text style={s.personName}>{candidate.name}</Text>
          <Text style={s.personRole}>{candidate.roleLabel}</Text>
        </View>
        <Text style={s.price}>${candidate.hiringCost.toLocaleString()}</Text>
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
            atCap
              ? 'No room on payroll'
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
  hiring,
  onSelectHiringRole,
  onHire,
  onPromote,
  onFire,
}: PeopleTabProps) {
  const t = useTheme();
  const s = makeStyles(t);
  const cap = hiring.headcountCap;
  const atCap = cap != null && roster.length >= cap;

  return (
    <View style={s.region} testID="people-tab">
      <SectionHeader title="People" />

      <View style={s.regionBody} testID="people-region-roster">
        <Surface testID="people-roster">
          <SectionHeader
            title="Your Team"
            accessory={
              <Text style={s.count}>
                {cap == null ? `${roster.length}` : `${roster.length} of ${cap}`}
              </Text>
            }
          />
          <Text style={s.hint}>
            {roster.length === 0
              ? 'Nobody on payroll — you are working the floor alone.'
              : atCap
                ? 'Every slot the store has room for is filled.'
                : 'Everyone drawing a paycheck from this store.'}
          </Text>
        </Surface>
        {roster.map((member) => (
          <RosterCard
            key={member.id}
            member={member}
            onPromote={(toRoleId) => onPromote(member.id, toRoleId)}
            onFire={() => onFire(member.id)}
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
              atCap={atCap}
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
    price: {
      ...t.typography.body,
      color: t.colors.textPrimary,
      fontVariant: ['tabular-nums'],
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
    actionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: t.spacing.sm,
      marginTop: t.spacing.md,
    },
  });
}
