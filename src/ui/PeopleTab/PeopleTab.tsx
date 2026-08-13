import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '../theme';
import {
  SectionHeader,
  Surface,
  Collapsible,
  Badge,
  IconBadge,
  HintLine,
} from '../kit';
import { emptyState } from '../copy';
import { ChipRow } from '../DeptControls';
import { ManagerStatusCard } from './ManagerStatusCard';
import { RosterCard, CandidateCard } from './peopleCards';
import { DEPARTMENT_META, DEPARTMENT_ORDER, type PeopleDepartmentId } from './departments';
import {
  wageText,
  type PeopleCandidate,
  type PeopleHiringModel,
  type PeopleRoleOption,
  type PeopleRosterMember,
  type PeopleSlotRow,
} from './peopleModel';
import type { ManagerStatusModel } from './managerStatus';

export type {
  PeopleSkillRead,
  PeopleSkillGrowth,
  PeoplePromotionOption,
  PeopleRaiseAsk,
  PeopleRosterMember,
  PeopleCandidate,
  PeopleRoleOption,
  PeopleHiringModel,
  PeopleSlotRow,
} from './peopleModel';
export type { PeopleDepartmentId, PeopleDepartmentMeta } from './departments';

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
  /**
   * Consequence hints (#388), each null once the player has used that block's
   * controls. Three lessons, one per region: what a hire costs, what moving or
   * losing someone does, and what answering a wage demand costs either way.
   */
  hints?: PeopleTabHints;
}

export interface PeopleTabHints {
  hiring?: string | null;
  staffMoves?: string | null;
  raise?: string | null;
}

/** Bucket a list by department, keeping each department's incoming order. */
function byDepartment<T extends { readonly department: PeopleDepartmentId }>(
  items: readonly T[],
): Map<PeopleDepartmentId, T[]> {
  const out = new Map<PeopleDepartmentId, T[]>();
  for (const item of items) {
    const bucket = out.get(item.department);
    if (bucket) bucket.push(item);
    else out.set(item.department, [item]);
  }
  return out;
}

/** The department's tile — same glyph and accent the rest of the app gives it. */
function DepartmentTile({ dept }: { dept: PeopleDepartmentId }) {
  const meta = DEPARTMENT_META[dept];
  return <IconBadge name={meta.icon} tone={meta.tone} variant="soft" size="sm" />;
}

/**
 * The slot board (#352) — every job this department opened, how many of its
 * desks are filled, and (for the jobs you can hire into) an open desk you can
 * press to start shopping for that job. An empty slot IS the hire affordance:
 * the board is the only place the ceiling is stated, so the surface never
 * re-derives it.
 */
function SlotBoard({
  dept,
  slots,
  selectedRoleId,
  onSelectHiringRole,
}: {
  dept: PeopleDepartmentId;
  slots: readonly PeopleSlotRow[];
  selectedRoleId: string;
  onSelectHiringRole: (roleId: string) => void;
}) {
  const t = useTheme();
  const s = makeStyles(t);
  if (slots.length === 0) return null;
  return (
    <View style={s.slotBoard} testID={`people-slot-board-${dept}`}>
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
            style={[s.slotRow, row.roleId === selectedRoleId && s.slotRowSelected]}
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

/**
 * One department's people, as one panel: its desks, then everyone sitting at
 * them. The panel IS the separation the surface is built on — a store with a
 * sales floor, a shop and a body shop reads as three groups you can shut
 * independently, not one undifferentiated column of staff cards.
 */
function DepartmentPanel({
  dept,
  slots,
  members,
  selectedRoleId,
  onSelectHiringRole,
  onPromote,
  onFire,
  onAcceptRaise,
  onRefuseRaise,
  raiseHint,
}: {
  dept: PeopleDepartmentId;
  slots: readonly PeopleSlotRow[];
  members: readonly PeopleRosterMember[];
  selectedRoleId: string;
  onSelectHiringRole: (roleId: string) => void;
  onPromote: (staffId: string, toRoleId: string) => void;
  onFire: (staffId: string) => void;
  onAcceptRaise: (staffId: string) => void;
  onRefuseRaise: (staffId: string) => void;
  raiseHint?: string | null;
}) {
  const t = useTheme();
  const s = makeStyles(t);
  const meta = DEPARTMENT_META[dept];
  const desks = slots.reduce((n, r) => n + r.total, 0);
  const filled = slots.reduce((n, r) => n + r.filled, 0);
  const open = desks - filled;

  return (
    <Collapsible
      style={s.panel}
      testID={`people-dept-${dept}`}
      title={meta.label}
      summary={desks > 0 ? `${filled} of ${desks} desks filled` : meta.blurb}
      leading={<DepartmentTile dept={dept} />}
      accessory={
        open > 0 ? (
          <Badge label={`${open} open`} tone="info" variant="soft" textCase="sentence" />
        ) : desks > 0 ? (
          <Badge label="Full" tone="positive" variant="soft" textCase="sentence" />
        ) : undefined
      }
    >
      <SlotBoard
        dept={dept}
        slots={slots}
        selectedRoleId={selectedRoleId}
        onSelectHiringRole={onSelectHiringRole}
      />
      {members.length === 0 ? (
        <Text style={s.hint} testID={`people-dept-empty-${dept}`}>
          {`${emptyState('people_department_roster', { department: meta.label })} ${meta.blurb}`}
        </Text>
      ) : (
        members.map((member) => (
          <RosterCard
            key={member.id}
            member={member}
            raiseHint={raiseHint}
            onPromote={(toRoleId) => onPromote(member.id, toRoleId)}
            onFire={() => onFire(member.id)}
            onAcceptRaise={() => onAcceptRaise(member.id)}
            onRefuseRaise={() => onRefuseRaise(member.id)}
          />
        ))
      )}
    </Collapsible>
  );
}

/**
 * One department's applicants. The role chips pick which of that department's
 * jobs you are shopping for; the applicants render in the panel whose
 * department owns the selected job, so "who I could hire" is separated from
 * "who works here" by the same department lines the team is grouped on.
 */
function HiringPanel({
  dept,
  roleOptions,
  hiring,
  shopping,
  roleFull,
  onSelectHiringRole,
  onHire,
}: {
  dept: PeopleDepartmentId;
  roleOptions: readonly PeopleRoleOption[];
  hiring: PeopleHiringModel;
  /** The selected job belongs to this department — the applicants land here. */
  shopping: boolean;
  roleFull: boolean;
  onSelectHiringRole: (roleId: string) => void;
  onHire: (candidateId: string) => void;
}) {
  const t = useTheme();
  const s = makeStyles(t);
  const meta = DEPARTMENT_META[dept];
  const applicants: readonly PeopleCandidate[] = shopping ? hiring.candidates : [];

  return (
    <Collapsible
      style={s.panel}
      testID={`people-hiring-dept-${dept}`}
      title={meta.label}
      summary={
        shopping
          ? `${applicants.length} ${applicants.length === 1 ? 'applicant' : 'applicants'} today`
          : `${roleOptions.length} ${roleOptions.length === 1 ? 'job' : 'jobs'} you can hire for`
      }
      leading={<DepartmentTile dept={dept} />}
      defaultExpanded={shopping}
    >
      <ChipRow
        options={roleOptions.map((r) => ({ id: r.id, label: r.label }))}
        selectedId={hiring.selectedRoleId}
        onSelect={onSelectHiringRole}
        testID={`people-hiring-roles-${dept}`}
      />
      {!shopping ? (
        <Text style={s.hint}>{emptyState('people_hiring_no_role')}</Text>
      ) : applicants.length === 0 ? (
        <Text style={s.hint} testID="people-hiring-empty">
          {emptyState('people_hiring_no_applicants')}
        </Text>
      ) : (
        applicants.map((c) => (
          <CandidateCard
            key={c.id}
            candidate={c}
            affordable={hiring.cash >= c.hiringCost}
            roleFull={roleFull}
            onHire={() => onHire(c.id)}
          />
        ))
      )}
    </Collapsible>
  );
}

/**
 * The People surface (one of the fixed 5-tab IA — always present, never
 * tier-gated). #347 rebuilt it as the org tab the locked IA §4 charters: the
 * **roster**, the **hiring pool**, and manager delegation, as three sections of
 * one surface.
 *
 * It is now organised the way the store is: three regions — who works here,
 * who you could hire, what your managers run — and inside the first two, one
 * **collapsible panel per department**. Sales, Service, the Body Shop and the
 * store-wide jobs are separate boxes with their own glyph, their own desk
 * count and their own fold, instead of one flat column where a service advisor
 * and a salesperson looked like the same kind of row. A person is a folded
 * line (name, job, what they cost) that opens onto the evidence; a person
 * asking for money opens itself and keeps its prompt pinned.
 *
 * Hiring resolves **in place**: pressing Hire updates the roster panel right
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
  hints,
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

  const slotsByDept = byDepartment(slots);
  const rosterByDept = byDepartment(roster);
  const rolesByDept = byDepartment(hiring.roleOptions);

  // A department earns a team panel by having desks or bodies in it. One with
  // neither renders nothing — the locked IA bans foreshadow tiles, and an empty
  // "Body Shop" box at Tier 1 is exactly that.
  const teamDepts = DEPARTMENT_ORDER.filter(
    (d) => (slotsByDept.get(d)?.length ?? 0) > 0 || (rosterByDept.get(d)?.length ?? 0) > 0,
  );
  const hiringDepts = DEPARTMENT_ORDER.filter((d) => (rolesByDept.get(d)?.length ?? 0) > 0);

  // Which department's panel the applicants land in. Falls back to the first
  // hiring panel so a selection the role list doesn't recognise still shows the
  // pool it came with rather than swallowing it.
  const shoppingDept =
    hiring.roleOptions.find((r) => r.id === hiring.selectedRoleId)?.department ??
    hiringDepts[0];

  return (
    <View style={s.region} testID="people-tab">
      <SectionHeader title="People" />

      {/* The store-level read, above the fold and above every panel: how much of
          the building is staffed, and what that staffing costs a day. */}
      <Surface style={s.summary} testID="people-summary">
        <View style={s.summaryRow}>
          <View style={s.summaryCell}>
            <Text style={s.summaryFigure} testID="people-desks-total">
              {desks > 0 ? `${filled} of ${desks}` : '—'}
            </Text>
            <Text style={s.summaryCaption}>desks filled</Text>
          </View>
          <View style={s.summaryDivider} />
          <View style={s.summaryCell}>
            <Text
              style={s.summaryFigure}
              testID={roster.length > 0 ? 'people-payroll-total' : undefined}
            >
              {roster.length > 0 ? wageText(dailyPayroll) : '—'}
            </Text>
            <Text style={s.summaryCaption}>daily payroll</Text>
          </View>
        </View>
      </Surface>

      <View style={s.region} testID="people-region-roster">
        <SectionHeader
          title="Your Team"
          accessory={<Text style={s.count}>{`${filled} of ${desks}`}</Text>}
        />
        <Text style={s.hint}>
          {roster.length === 0
            ? emptyState('people_roster_empty')
            : everyDeskFilled
              ? emptyState('people_roster_full')
              : 'Everyone drawing a paycheck from this store, by department.'}
        </Text>
        {teamDepts.map((dept) => (
          <DepartmentPanel
            key={dept}
            dept={dept}
            slots={slotsByDept.get(dept) ?? []}
            members={rosterByDept.get(dept) ?? []}
            selectedRoleId={hiring.selectedRoleId}
            onSelectHiringRole={onSelectHiringRole}
            onPromote={onPromote}
            onFire={onFire}
            onAcceptRaise={onAcceptRaise}
            onRefuseRaise={onRefuseRaise}
            raiseHint={hints?.raise}
          />
        ))}
        {hints?.staffMoves && (
          <HintLine id="staff_moves" text={hints.staffMoves} />
        )}
      </View>

      <View style={s.region} testID="people-region-hiring">
        <SectionHeader title="Hiring" />
        <Text style={s.hint}>
          Who is looking for work today. A fresh set walks in every morning.
        </Text>
        {hiringDepts.map((dept) => (
          <HiringPanel
            key={dept}
            dept={dept}
            roleOptions={rolesByDept.get(dept) ?? []}
            hiring={hiring}
            shopping={dept === shoppingDept}
            roleFull={roleFull}
            onSelectHiringRole={onSelectHiringRole}
            onHire={onHire}
          />
        ))}
        {hints?.hiring && <HintLine id="hire_candidate" text={hints.hiring} />}
      </View>

      <View style={s.region} testID="people-region-managers">
        <SectionHeader title="Delegation" />
        <Collapsible
          style={s.panel}
          testID="people-delegation"
          variant="flat"
          bodyPadded={false}
          defaultExpanded={false}
          title="What your managers run"
          summary={
            managerStatus.ucmPresent || managerStatus.departments.some((d) => d.present)
              ? 'Which decisions your managers make without asking you.'
              : emptyState('people_no_managers')
          }
          leading={<IconBadge name="people" tone="primary" variant="soft" size="sm" />}
        >
          <ManagerStatusCard model={managerStatus} />
        </Collapsible>
      </View>
    </View>
  );
}

function makeStyles(t: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    region: { marginTop: t.spacing.xl },
    panel: { marginTop: t.spacing.md },
    summary: { marginTop: t.spacing.md },
    // The row lives INSIDE the card, not on it: a raised `Surface` puts the
    // passed style on its outer frame and lays its children out in the gradient
    // fill, so a `flexDirection` set on the card never reaches them.
    summaryRow: { flexDirection: 'row', alignItems: 'center' },
    summaryCell: { flex: 1, alignItems: 'center' },
    summaryDivider: {
      width: StyleSheet.hairlineWidth,
      alignSelf: 'stretch',
      backgroundColor: t.colors.border,
    },
    summaryFigure: {
      ...t.typography.statValue,
      color: t.colors.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    summaryCaption: {
      ...t.typography.caption,
      color: t.colors.textMuted,
      marginTop: t.spacing.xxs,
    },
    count: { ...t.typography.statLabel, color: t.colors.textSecondary },
    hint: {
      ...t.typography.caption,
      color: t.colors.textMuted,
      marginTop: t.spacing.xs,
    },
    slotBoard: { gap: t.spacing.xxs, marginBottom: t.spacing.md },
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
    slotRowSelected: {
      borderWidth: 1,
      borderColor: t.colors.primary,
    },
    slotLabel: { ...t.typography.caption, color: t.colors.textSecondary },
    slotCount: {
      ...t.typography.statLabel,
      color: t.colors.textPrimary,
      fontVariant: ['tabular-nums'],
    },
  });
}
