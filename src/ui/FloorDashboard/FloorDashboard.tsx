import React from 'react';
import { colors } from '../theme';
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
  /** Representative open-hours window for the HUD clock (renderLoop tunable). */
  openHour: number;
  closeHour: number;
  /** Cash on hand (Economy). */
  cash: number;
  /** A forced exception is waiting to be hand-played. */
  exceptionPending: boolean;
  /** Ups: real customers admitted onto the lot today (fresh walk-ins +
   *  be-backs). The only arrival count the live floor surfaces — drove-by /
   *  turned-away traffic is an EOD-recap concept, never a live-floor visual
   *  (#130, locked by the #107 reconciliation). */
  ups: number;
  /** Closed deals today (funnel sold). */
  sold: number;
  /** Walked-in but not yet engaged — still-warm prospects. */
  pendingWarm: number;
  /** Running gross today (front + back, summed from closed deals). */
  gross: number;
  /** Regulatory pressure readout for the live-floor HUD. */
  regulatoryPressure?: RegulatoryPressureModel;
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
  /** Live StaffMorale value on the 0-100 morale scale. */
  morale?: number;
}

export interface RegulatoryPressureModel {
  /** Current pressure accumulated by RegulatoryMeter. */
  pressure: number;
  /** Configured cap for pressure, from regulatory tunables. */
  max: number;
}

/**
 * One event-log row. A `walk` is a transient informational line; a `match` is
 * the inventory-buyer match-payoff toast (#199), a highlighted reward line; an
 * `exception` is a tappable alert row whose `id` is the grabbable CustomerRef —
 * tapping it surfaces the hand-play modal (wired next slice).
 */
export type FloorEvent =
  | { kind: 'walk'; key: string; text: string }
  | { kind: 'match'; key: string; text: string }
  | { kind: 'exception'; key: string; customerId: string; text: string };

export interface InventoryStats {
  /** Vehicles currently on the lot. */
  unitsOnLot: number;
  /** Capital tied up in lot stock (purchase + recon). */
  flooredValue: number;
  /** Average days a current unit has sat in inventory (0 if empty). */
  avgDaysInInventory: number;
}

/**
 * Live-clock controls (#121). The view dispatches these; the render-loop
 * hook in the composition root owns the wall-clock interval and FloorSim.
 * Absent ⇒ no control bar (the pre-#121 static dashboard).
 */
export interface FloorControls {
  speed: number;
  speeds: readonly number[];
  paused: boolean;
  onSetSpeed: (speed: number) => void;
  onTogglePause: () => void;
  onSkipToClose: () => void;
}

interface Props {
  model: FloorDashboardModel;
  /** Live-clock speed/pause controls (#121). Absent ⇒ no control bar. */
  controls?: FloorControls;
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
  /** Open the in-session save/load/menu surface. */
  onOpenGameMenu?: () => void;
}

function money(n: number): string {
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(Math.round(n)).toLocaleString()}`;
}

/**
 * Representative open-hours wall clock from the logical tick fraction. Pure
 * presentation — game logic stays wall-clock-free; this only maps
 * currentTick/ticksPerDay onto the [openHour, closeHour] window.
 */
function clockLabel(
  tick: number,
  ticksPerDay: number,
  openHour: number,
  closeHour: number,
): string {
  const frac = ticksPerDay <= 0 ? 0 : Math.min(1, tick / ticksPerDay);
  const totalMin = Math.round((openHour + frac * (closeHour - openHour)) * 60);
  const h24 = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const period = h24 < 12 || h24 === 24 ? 'a' : 'p';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')}${period}`;
}

/**
 * Time remaining until the day closes (#233 S3b) — the reframed mockup "Results
 * in" countdown, honestly labeled as time-to-close. Maps the remaining tick
 * fraction onto the open-hours window; "Closing" once the floor is spent.
 */
function timeToCloseLabel(
  tick: number,
  ticksPerDay: number,
  openHour: number,
  closeHour: number,
): string {
  const frac = ticksPerDay <= 0 ? 1 : Math.min(1, tick / ticksPerDay);
  const minsLeft = Math.max(0, Math.round((1 - frac) * (closeHour - openHour) * 60));
  if (minsLeft <= 0) return 'Closing';
  const h = Math.floor(minsLeft / 60);
  const m = minsLeft % 60;
  return h > 0 ? `${h}h ${m}m to close` : `${m}m to close`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function pressureFillWidth(model: RegulatoryPressureModel): number {
  const max = Math.max(1, model.max);
  const pct = Math.max(0, Math.min(1, model.pressure / max));
  return Math.round(pct * 72);
}

function RegulatoryGauge({ model }: { model: RegulatoryPressureModel }) {
  return (
    <View
      style={styles.regGauge}
      accessibilityLabel={`Regulatory pressure ${Math.round(model.pressure)} of ${Math.round(model.max)}`}
    >
      <Text style={styles.regGaugeLabel}>
        REG {Math.round(model.pressure)}/{Math.round(model.max)}
      </Text>
      <View style={styles.regTrack}>
        <View style={[styles.regFill, { width: pressureFillWidth(model) }]} />
      </View>
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
  controls,
  onExceptionPress,
  onCherryPick,
  onOpenGameMenu,
}: Props) {
  const {
    day,
    tick,
    ticksPerDay,
    openHour,
    closeHour,
    cash,
    exceptionPending,
    ups,
    sold,
    pendingWarm,
    gross,
    regulatoryPressure,
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
          {clockLabel(tick, ticksPerDay, openHour, closeHour)}
        </Text>
        <Text style={styles.hudCell} testID="floor-time-to-close">
          {timeToCloseLabel(tick, ticksPerDay, openHour, closeHour)}
        </Text>
        <Text style={styles.hudCell}>{money(cash)}</Text>
        {regulatoryPressure ? (
          <RegulatoryGauge model={regulatoryPressure} />
        ) : null}
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
        {onOpenGameMenu ? (
          <TouchableOpacity
            style={styles.menuBtn}
            accessibilityRole="button"
            accessibilityLabel="Open game menu"
            onPress={onOpenGameMenu}
          >
            <Text style={styles.menuBtnText}>Menu</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Live-clock controls (#121) */}
      {controls && (
        <View style={styles.controlBar}>
          <TouchableOpacity
            style={styles.ctrlBtn}
            accessibilityRole="button"
            accessibilityLabel={controls.paused ? 'Resume day' : 'Pause day'}
            onPress={controls.onTogglePause}
          >
            <Text style={styles.ctrlBtnText}>
              {controls.paused ? '▶ Resume' : '❚❚ Pause'}
            </Text>
          </TouchableOpacity>
          {controls.speeds.map((s) => {
            const on = !controls.paused && controls.speed === s;
            return (
              <TouchableOpacity
                key={s}
                style={[styles.ctrlBtn, on && styles.ctrlBtnActive]}
                accessibilityRole="button"
                accessibilityLabel={`${s}× speed`}
                onPress={() => controls.onSetSpeed(s)}
              >
                <Text
                  style={[styles.ctrlBtnText, on && styles.ctrlBtnTextActive]}
                >
                  {s}×
                </Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            style={styles.ctrlBtn}
            accessibilityRole="button"
            accessibilityLabel="Skip to close"
            onPress={controls.onSkipToClose}
          >
            <Text style={styles.ctrlBtnText}>⏭ Close</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* VIN-style live stat grid + secondary panels */}
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        <Text style={styles.sectionLabel}>TODAY</Text>
        <View style={styles.grid}>
          <Stat label="UPS" value={String(ups)} />
          <Stat label="SOLD" value={String(sold)} />
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
                {s.morale != null ? (
                  <Text style={styles.staffMorale}>
                    MORALE {Math.round(s.morale)}
                  </Text>
                ) : null}
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
            ) : e.kind === 'match' ? (
              <Text key={e.key} style={styles.matchLine}>
                {e.text}
              </Text>
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
  root: { flex: 1, backgroundColor: colors.base },
  hud: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceRaised,
  },
  hudCell: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: colors.textSecondary,
    letterSpacing: 1,
  },
  hudPip: { fontSize: 14, color: colors.border },
  hudPipActive: { color: colors.reward },
  regGauge: {
    minWidth: 72,
    gap: 3,
  },
  regGaugeLabel: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: colors.textSecondary,
    letterSpacing: 1,
  },
  regTrack: {
    width: 72,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
  },
  regFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.reward,
  },
  menuBtn: {
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  menuBtnText: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: colors.textSecondary,
    letterSpacing: 1,
  },
  controlBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceRaised,
  },
  ctrlBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceRaised,
  },
  ctrlBtnActive: { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
  ctrlBtnText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: colors.textMuted,
    letterSpacing: 1,
  },
  ctrlBtnTextActive: { color: colors.reward },
  body: { flex: 1 },
  bodyContent: { padding: 20 },
  sectionLabel: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: colors.border,
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
    backgroundColor: colors.surface,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.surfaceRaised,
    paddingVertical: 16,
    paddingHorizontal: 14,
  },
  statValue: {
    fontFamily: 'monospace',
    fontSize: 22,
    fontWeight: '700',
    color: colors.primary,
  },
  statLabel: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: colors.borderMuted,
    letterSpacing: 2,
    marginTop: 6,
  },
  emptyLine: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: colors.borderMuted,
  },
  staffStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  staffChip: {
    backgroundColor: colors.surface,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.surfaceRaised,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  staffRole: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: colors.primary,
  },
  staffDept: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: colors.borderMuted,
    letterSpacing: 1,
    marginTop: 3,
  },
  staffMorale: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: colors.textSecondary,
    letterSpacing: 1,
    marginTop: 5,
  },
  walkLine: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: colors.borderMuted,
    paddingVertical: 4,
  },
  matchLine: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: colors.reward,
    fontWeight: '600',
    paddingVertical: 4,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginVertical: 4,
  },
  cherryPick: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 4,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceRaised,
  },
  cherryPickText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: colors.primary,
    letterSpacing: 1,
  },
  alertPip: { fontSize: 12, color: colors.reward },
  alertText: {
    flex: 1,
    fontFamily: 'monospace',
    fontSize: 12,
    color: colors.textPrimary,
  },
});
