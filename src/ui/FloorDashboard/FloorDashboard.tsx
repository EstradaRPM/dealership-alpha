import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';

/**
 * Pure read-model for the FLOOR-OPEN dashboard (#116). The composition root
 * assembles this off the composed day state (CapacityManager day-funnel,
 * Economy, the owned FloorSim). The view dispatches nothing and reaches no
 * game-logic internals — it only renders these numbers.
 */
export interface FloorDashboardModel {
  /** Calendar day (DayLoopController state). */
  day: number;
  /** Ticks elapsed in the day so far (FloorSim.currentTick). */
  tick: number;
  /** Ticks in a full day (FloorSim.ticksPerDay). */
  ticksPerDay: number;
  /** Cash on hand (Economy). */
  cash: number;
  /** A forced exception is waiting to be hand-played. */
  exceptionPending: boolean;
  /** Ups: customers admitted onto the lot today (funnel walked-in). */
  ups: number;
  /** Closed deals today (funnel sold). */
  sold: number;
  /** Customers turned away / lost today (funnel drop). */
  walked: number;
  /** Walked-in but not yet engaged — still-warm prospects. */
  pendingWarm: number;
  /** Running gross today (front + back, summed from closed deals). */
  gross: number;
  /** Impressionistic staff strip — one entry per roster member (StaffOrg). */
  staff: readonly StaffStripEntry[];
  /** Scrolling event log, oldest→newest; the view caps what it shows. */
  events: readonly FloorEvent[];
  /** Inventory stats panel read-model (derived from Inventory.getLotVehicles). */
  inventory: InventoryStats;
}

/**
 * One roster member, impressionistic only — #99 exposes no per-staff live
 * state, so the strip conveys *who is on the floor*, not what they're doing.
 */
export interface StaffStripEntry {
  /** Stable id (roster member). */
  id: string;
  /** Humanized role label (e.g. "Salesperson"). */
  role: string;
  /** Department this role serves, or 'unassigned'. */
  department: string;
}

/**
 * One event-log row. A `walk` is a transient informational line; an
 * `exception` is a tappable alert row whose `id` is the grabbable
 * CustomerRef — tapping it surfaces the hand-play modal (wired next slice).
 */
export type FloorEvent =
  | { kind: 'walk'; key: string; text: string }
  | { kind: 'exception'; key: string; customerId: string; text: string };

export interface InventoryStats {
  /** Vehicles currently on the lot. */
  unitsOnLot: number;
  /** Capital tied up in lot stock (purchase + recon). */
  flooredValue: number;
  /** Average days a current unit has sat in inventory (0 if empty). */
  avgDaysInInventory: number;
}

interface Props {
  model: FloorDashboardModel;
  /**
   * Tapped an exception alert row → surface the hand-play modal (#118) for
   * that forced exception. Absent ⇒ rows render but are inert.
   */
  onExceptionPress?: (customerId: string) => void;
  /**
   * Voluntary cherry-pick (#118): open the hand-play modal on a customer the
   * composition root selects from the grabbable roster. Absent ⇒ no affordance
   * (e.g. nothing grabbable, or tick-budget exhausted).
   */
  onCherryPick?: () => void;
}

function money(n: number): string {
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(Math.round(n)).toLocaleString()}`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/**
 * FLOOR-OPEN dashboard, part 1 (#116): persistent HUD top bar (per #95 user
 * story 14) + VINsolutions-style live stat grid. Deliberately plain
 * text/number visuals. Secondary panels (#117), recap (#119) and the render
 * loop (#121) are later slices.
 */
export function FloorDashboard({
  model,
  onExceptionPress,
  onCherryPick,
}: Props) {
  const {
    day,
    tick,
    ticksPerDay,
    cash,
    exceptionPending,
    ups,
    sold,
    walked,
    pendingWarm,
    gross,
    staff,
    events,
    inventory,
  } = model;
  // Newest first; the log is impressionistic, not an audit trail.
  const recentEvents = [...events].slice(-40).reverse();

  return (
    <View style={styles.root}>
      {/* Persistent HUD top bar */}
      <View style={styles.hud}>
        <Text style={styles.hudCell}>DAY {day}</Text>
        <Text style={styles.hudCell}>
          {tick}/{ticksPerDay}
        </Text>
        <Text style={styles.hudCell}>{money(cash)}</Text>
        <Text style={styles.hudCell}>
          {sold}U · {money(gross)}
        </Text>
        <Text
          style={[styles.hudPip, exceptionPending && styles.hudPipActive]}
          accessibilityLabel={
            exceptionPending ? 'Forced exception waiting' : 'No exceptions'
          }
        >
          {exceptionPending ? '●' : '○'}
        </Text>
      </View>

      {/* VIN-style live stat grid + secondary panels */}
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        <Text style={styles.sectionLabel}>TODAY</Text>
        <View style={styles.grid}>
          <Stat label="UPS" value={String(ups)} />
          <Stat label="SOLD" value={String(sold)} />
          <Stat label="WALKED" value={String(walked)} />
          <Stat label="PENDING-WARM" value={String(pendingWarm)} />
          <Stat label="GROSS" value={money(gross)} />
        </View>

        {onCherryPick && (
          <TouchableOpacity
            style={styles.cherryPick}
            accessibilityRole="button"
            accessibilityLabel="Cherry-pick a customer to hand-play"
            onPress={onCherryPick}
          >
            <Text style={styles.cherryPickText}>＋ Work a customer</Text>
          </TouchableOpacity>
        )}

        {/* Impressionistic staff strip */}
        <Text style={styles.sectionLabel}>FLOOR</Text>
        {staff.length === 0 ? (
          <Text style={styles.emptyLine}>No staff on the roster.</Text>
        ) : (
          <View style={styles.staffStrip}>
            {staff.map((s) => (
              <View key={s.id} style={styles.staffChip}>
                <Text style={styles.staffRole}>{s.role}</Text>
                <Text style={styles.staffDept}>{s.department}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Inventory stats panel */}
        <Text style={styles.sectionLabel}>INVENTORY</Text>
        <View style={styles.grid}>
          <Stat label="ON LOT" value={String(inventory.unitsOnLot)} />
          <Stat label="FLOORED" value={money(inventory.flooredValue)} />
          <Stat
            label="AVG DAYS"
            value={String(Math.round(inventory.avgDaysInInventory))}
          />
        </View>

        {/* Scrolling event log */}
        <Text style={styles.sectionLabel}>EVENT LOG</Text>
        {recentEvents.length === 0 ? (
          <Text style={styles.emptyLine}>Quiet so far today.</Text>
        ) : (
          recentEvents.map((e) =>
            e.kind === 'exception' ? (
              <TouchableOpacity
                key={e.key}
                style={styles.alertRow}
                accessibilityRole="button"
                accessibilityLabel={`Exception: ${e.text}`}
                onPress={() => onExceptionPress?.(e.customerId)}
              >
                <Text style={styles.alertPip}>●</Text>
                <Text style={styles.alertText}>{e.text}</Text>
              </TouchableOpacity>
            ) : (
              <Text key={e.key} style={styles.walkLine}>
                {e.text}
              </Text>
            ),
          )
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#111' },
  hud: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#161616',
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
  },
  hudCell: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#bbb',
    letterSpacing: 1,
  },
  hudPip: { fontSize: 14, color: '#333' },
  hudPipActive: { color: '#e0a23a' },
  body: { flex: 1 },
  bodyContent: { padding: 20 },
  sectionLabel: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: '#444',
    letterSpacing: 3,
    marginBottom: 14,
    marginTop: 22,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCell: {
    minWidth: 96,
    flexGrow: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#252525',
    paddingVertical: 16,
    paddingHorizontal: 14,
  },
  statValue: {
    fontFamily: 'monospace',
    fontSize: 22,
    fontWeight: '700',
    color: '#c8a96e',
  },
  statLabel: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: '#555',
    letterSpacing: 2,
    marginTop: 6,
  },
  emptyLine: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#555',
  },
  staffStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  staffChip: {
    backgroundColor: '#1a1a1a',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#252525',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  staffRole: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#c8a96e',
  },
  staffDept: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: '#555',
    letterSpacing: 1,
    marginTop: 3,
  },
  walkLine: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#666',
    paddingVertical: 4,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1f1a12',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#3a2f1a',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginVertical: 4,
  },
  cherryPick: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 4,
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2f2f2f',
  },
  cherryPickText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#c8a96e',
    letterSpacing: 1,
  },
  alertPip: { fontSize: 12, color: '#e0a23a' },
  alertText: {
    flex: 1,
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#e6c98f',
  },
});
