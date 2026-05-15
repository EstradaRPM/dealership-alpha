import type { EventBus, EventName, EventMap } from '../EventBus';

export interface TelemetryConfig {
  schemaVersion: 1;
  cashCurveBucketDays: number;
  maxBufferedEvents: number;
}

export interface StoredEvent {
  readonly name: EventName;
  readonly day: number;
  readonly t: number;
  readonly payload: unknown;
}

export interface DealsPerDayRow {
  day: number;
  count: number;
  avgGross: number;
  avgFront: number;
  avgBack: number;
}

export interface CloseRateRow {
  archetypeLabel: string;
  arrived: number;
  closed: number;
  walked: number;
  closeRate: number;
}

export interface CashCurveRow {
  day: number;
  revenue: number;
  expense: number;
  net: number;
  cumulativeNet: number;
}

export interface QueueProxyRow {
  day: number;
  admitted: number;
  missed: number;
  resolvedClosed: number;
  resolvedWalk: number;
}

export interface MoraleRow {
  day: number;
  quits: number;
  cumulativeQuits: number;
}

export interface SessionMetrics {
  totalEvents: number;
  daysObserved: number;
  dealsPerDay: ReadonlyArray<DealsPerDayRow>;
  closeRateByArchetype: ReadonlyArray<CloseRateRow>;
  fniAttachRate: { dealsWithBackGross: number; totalDeals: number; attachPct: number };
  cashCurve: ReadonlyArray<CashCurveRow>;
  queueProxy: ReadonlyArray<QueueProxyRow>;
  moraleTrajectory: ReadonlyArray<MoraleRow>;
}

export interface SessionLog {
  schemaVersion: 1;
  exportedAt: number;
  sessionStartedAt: number;
  metrics: SessionMetrics;
  events: ReadonlyArray<StoredEvent>;
}

export interface Telemetry {
  setEnabled(on: boolean): void;
  isEnabled(): boolean;
  clear(): void;
  getEventCount(): number;
  getRawEvents(): ReadonlyArray<StoredEvent>;
  getMetrics(): SessionMetrics;
  exportSessionLog(): string;
}

function loadConfig(): TelemetryConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw: unknown = require('../../../data/telemetry.json');
  const cfg = raw as TelemetryConfig;
  return {
    schemaVersion: 1,
    cashCurveBucketDays: cfg.cashCurveBucketDays ?? 1,
    maxBufferedEvents: cfg.maxBufferedEvents ?? 100000,
  };
}

// Event names we capture. Subscribing to each individually keeps the EventBus
// typed contract intact (no wildcard) and lets us turn telemetry on/off cleanly.
const TRACKED_EVENTS: ReadonlyArray<EventName> = [
  'clock:day_started',
  'clock:day_ended',
  'customer:arrived',
  'customer:resolved',
  'customer:poached',
  'capacity:customer_admitted',
  'capacity:missed_opportunity',
  'deal:closed',
  'economy:revenue_posted',
  'economy:expense_posted',
  'inventory:vehicle_purchased',
  'inventory:vehicle_sold',
  'staff:hired',
  'staff:fired',
  'staff:quit',
  'staff:auto_resolved',
  'service:ticket_closed',
  'followup:customer_archived',
  'bdc:callback_succeeded',
  'career:tier_up',
  'player:close_early',
];

export function createTelemetry(deps: { bus: EventBus }): Telemetry {
  const { bus } = deps;
  const config = loadConfig();

  const buffer: StoredEvent[] = [];
  const subscriptions: Array<{ name: EventName; fn: (p: unknown) => void }> = [];
  let enabled = false;
  let sessionStartedAt = 0;
  let currentDay = 0;

  function record(name: EventName, payload: unknown): void {
    if (buffer.length >= config.maxBufferedEvents) return;
    if (name === 'clock:day_started') {
      currentDay = (payload as EventMap['clock:day_started']).day;
    }
    buffer.push({
      name,
      day: currentDay,
      t: Date.now() - sessionStartedAt,
      payload,
    });
  }

  function attach(): void {
    for (const name of TRACKED_EVENTS) {
      const fn = (payload: unknown) => record(name, payload);
      // Cast: EventBus.subscribe is typed per-event; we widen here intentionally
      // because the recording function is uniform across event shapes.
      (bus.subscribe as (n: EventName, f: (p: unknown) => void) => void)(name, fn);
      subscriptions.push({ name, fn });
    }
  }

  function detach(): void {
    for (const { name, fn } of subscriptions) {
      (bus.unsubscribe as (n: EventName, f: (p: unknown) => void) => void)(name, fn);
    }
    subscriptions.length = 0;
  }

  function computeMetrics(): SessionMetrics {
    const dealsByDay = new Map<number, { count: number; front: number; back: number }>();
    const archetypeArrived = new Map<string, number>();
    const archetypeClosed = new Map<string, number>();
    const archetypeWalked = new Map<string, number>();
    const customerArchetype = new Map<string, string>();
    const customerStatus = new Map<string, 'closed' | 'walk'>();
    const dayRevenue = new Map<number, number>();
    const dayExpense = new Map<number, number>();
    const dayAdmitted = new Map<number, number>();
    const dayMissed = new Map<number, number>();
    const dayResolvedClosed = new Map<number, number>();
    const dayResolvedWalk = new Map<number, number>();
    const dayQuits = new Map<number, number>();
    const daysSeen = new Set<number>();
    let dealsWithBack = 0;
    let totalDeals = 0;

    const inc = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
    const incNum = (m: Map<number, number>, k: number, v = 1) =>
      m.set(k, (m.get(k) ?? 0) + v);

    for (const ev of buffer) {
      daysSeen.add(ev.day);
      switch (ev.name) {
        case 'customer:arrived': {
          const p = ev.payload as EventMap['customer:arrived'];
          customerArchetype.set(p.customerId, p.label);
          inc(archetypeArrived, p.label);
          break;
        }
        case 'customer:resolved': {
          const p = ev.payload as EventMap['customer:resolved'];
          customerStatus.set(p.customerId, p.outcome);
          const label = customerArchetype.get(p.customerId) ?? '<unknown>';
          if (p.outcome === 'closed') inc(archetypeClosed, label);
          else inc(archetypeWalked, label);
          if (p.outcome === 'closed') incNum(dayResolvedClosed, ev.day);
          else incNum(dayResolvedWalk, ev.day);
          break;
        }
        case 'deal:closed': {
          const p = ev.payload as EventMap['deal:closed'];
          const existing = dealsByDay.get(ev.day) ?? { count: 0, front: 0, back: 0 };
          existing.count += 1;
          existing.front += p.frontGross;
          existing.back += p.backGross;
          dealsByDay.set(ev.day, existing);
          totalDeals += 1;
          if (p.backGross > 0) dealsWithBack += 1;
          break;
        }
        case 'economy:revenue_posted': {
          const p = ev.payload as EventMap['economy:revenue_posted'];
          incNum(dayRevenue, ev.day, p.amount);
          break;
        }
        case 'economy:expense_posted': {
          const p = ev.payload as EventMap['economy:expense_posted'];
          incNum(dayExpense, ev.day, p.amount);
          break;
        }
        case 'capacity:customer_admitted':
          incNum(dayAdmitted, ev.day);
          break;
        case 'capacity:missed_opportunity':
          incNum(dayMissed, ev.day);
          break;
        case 'staff:quit':
          incNum(dayQuits, ev.day);
          break;
      }
    }

    const sortedDays = [...daysSeen].sort((a, b) => a - b);

    const dealsPerDay: DealsPerDayRow[] = sortedDays
      .filter((d) => dealsByDay.has(d))
      .map((d) => {
        const r = dealsByDay.get(d)!;
        return {
          day: d,
          count: r.count,
          avgGross: r.count > 0 ? (r.front + r.back) / r.count : 0,
          avgFront: r.count > 0 ? r.front / r.count : 0,
          avgBack: r.count > 0 ? r.back / r.count : 0,
        };
      });

    const closeRateByArchetype: CloseRateRow[] = [];
    const allArchetypes = new Set<string>([
      ...archetypeArrived.keys(),
      ...archetypeClosed.keys(),
      ...archetypeWalked.keys(),
    ]);
    for (const label of [...allArchetypes].sort()) {
      const arrived = archetypeArrived.get(label) ?? 0;
      const closed = archetypeClosed.get(label) ?? 0;
      const walked = archetypeWalked.get(label) ?? 0;
      const resolved = closed + walked;
      closeRateByArchetype.push({
        archetypeLabel: label,
        arrived,
        closed,
        walked,
        closeRate: resolved > 0 ? closed / resolved : 0,
      });
    }

    let cumulative = 0;
    const cashCurve: CashCurveRow[] = sortedDays.map((d) => {
      const rev = dayRevenue.get(d) ?? 0;
      const exp = dayExpense.get(d) ?? 0;
      const net = rev - exp;
      cumulative += net;
      return { day: d, revenue: rev, expense: exp, net, cumulativeNet: cumulative };
    });

    const queueProxy: QueueProxyRow[] = sortedDays.map((d) => ({
      day: d,
      admitted: dayAdmitted.get(d) ?? 0,
      missed: dayMissed.get(d) ?? 0,
      resolvedClosed: dayResolvedClosed.get(d) ?? 0,
      resolvedWalk: dayResolvedWalk.get(d) ?? 0,
    }));

    let cumulativeQuits = 0;
    const moraleTrajectory: MoraleRow[] = sortedDays.map((d) => {
      const q = dayQuits.get(d) ?? 0;
      cumulativeQuits += q;
      return { day: d, quits: q, cumulativeQuits };
    });

    return {
      totalEvents: buffer.length,
      daysObserved: daysSeen.size,
      dealsPerDay,
      closeRateByArchetype,
      fniAttachRate: {
        dealsWithBackGross: dealsWithBack,
        totalDeals,
        attachPct: totalDeals > 0 ? dealsWithBack / totalDeals : 0,
      },
      cashCurve,
      queueProxy,
      moraleTrajectory,
    };
  }

  return {
    setEnabled(on) {
      if (on === enabled) return;
      enabled = on;
      if (on) {
        sessionStartedAt = Date.now();
        attach();
      } else {
        detach();
      }
    },
    isEnabled() {
      return enabled;
    },
    clear() {
      buffer.length = 0;
      sessionStartedAt = Date.now();
      currentDay = 0;
    },
    getEventCount() {
      return buffer.length;
    },
    getRawEvents() {
      return buffer;
    },
    getMetrics() {
      return computeMetrics();
    },
    exportSessionLog() {
      const log: SessionLog = {
        schemaVersion: 1,
        exportedAt: Date.now(),
        sessionStartedAt,
        metrics: computeMetrics(),
        events: buffer,
      };
      return JSON.stringify(log, null, 2);
    },
  };
}
