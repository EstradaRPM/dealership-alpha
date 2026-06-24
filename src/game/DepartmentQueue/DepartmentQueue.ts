import type { EventBus } from '../EventBus';
import type { DeptKey, QueueItem, DepartmentQueueSnapshot } from './types';

export interface DepartmentQueue {
  getQueue(dept: DeptKey): readonly QueueItem[];
  getBadgeCount(dept: DeptKey): number;
  getBadges(): Record<DeptKey, number>;
  resolveItem(id: string): void;
  resolveTop(dept: DeptKey): void;
  resolveByCustomerId(customerId: string): boolean;
  drainQueues(): readonly QueueItem[];
  snapshot(): DepartmentQueueSnapshot;
  restore(snap: DepartmentQueueSnapshot): void;
}

const DEPT_KEYS: DeptKey[] = ['sales', 'service', 'bdc', 'office', 'lot', 'bodyshop'];

let _nextId = 1;
function makeId(): string {
  return `q-${_nextId++}`;
}

export function createDepartmentQueue(deps: { bus: EventBus }): DepartmentQueue {
  const { bus } = deps;

  const queues: Record<DeptKey, QueueItem[]> = {
    sales: [], service: [], bdc: [], office: [], lot: [], bodyshop: [],
  };

  bus.subscribe('clock:day_started', ({ day }) => {
    queues.office.push({
      id: makeId(),
      type: 'routine',
      dept: 'office',
      label: 'Receptionist phone question',
      createdDay: day,
    });
  });

  bus.subscribe('capacity:customer_admitted', ({ day, customerId, label }) => {
    queues.sales.push({
      id: makeId(),
      type: 'workspace',
      dept: 'sales',
      label,
      createdDay: day,
      customerId,
    });
  });

  bus.subscribe('capacity:missed_opportunity', ({ day, customerId, label }) => {
    queues.sales.push({
      id: makeId(),
      type: 'missed_opportunity',
      dept: 'sales',
      label,
      createdDay: day,
      customerId,
    });
  });

  bus.subscribe('followup:bdc_tasks_ready', ({ day, entries }) => {
    for (const entry of entries) {
      queues.bdc.push({
        id: makeId(),
        type: 'callback',
        dept: 'bdc',
        label: `BDC callback: ${entry.archetypeLabel} (heat ${entry.heat})`,
        createdDay: day,
        customerId: entry.customerId,
      });
    }
  });

  bus.subscribe('bdc:callback_succeeded', ({ customerId, day, archetypeLabel }) => {
    queues.sales.push({
      id: makeId(),
      type: 'workspace',
      dept: 'sales',
      label: archetypeLabel,
      createdDay: day,
      customerId,
    });
  });

  bus.subscribe('service:intake_ready', ({ day, items }) => {
    for (const item of items) {
      queues.service.push({
        id: item.serviceItemId,
        type: 'routine',
        dept: 'service',
        label: item.label,
        createdDay: day,
        customerId: item.customerId,
        baseRevenue: item.baseRevenue,
        jobCategory: item.jobCategory,
        vehicleId: item.vehicleId,
      });
    }
  });

  // Body Shop lane (#314): the Tier-3 mirror of the Service lane. BodyShopQueue
  // re-publishes CollisionStream's gated intake as bodyshop:intake_ready; each
  // item carries the channel `source` (insurance/retail) the drain prices through
  // and the collision parts category the gate consumes.
  bus.subscribe('bodyshop:intake_ready', ({ day, items }) => {
    for (const item of items) {
      queues.bodyshop.push({
        id: item.bodyShopItemId,
        type: 'routine',
        dept: 'bodyshop',
        label: item.label,
        createdDay: day,
        customerId: item.customerId,
        baseRevenue: item.baseRevenue,
        jobCategory: item.jobCategory,
        vehicleId: item.vehicleId,
        source: item.source,
      });
    }
  });

  return {
    getQueue(dept) { return queues[dept]; },
    getBadgeCount(dept) { return queues[dept].length; },
    getBadges() {
      return Object.fromEntries(
        DEPT_KEYS.map(d => [d, queues[d].length])
      ) as Record<DeptKey, number>;
    },
    resolveItem(id) {
      for (const dept of DEPT_KEYS) {
        const idx = queues[dept].findIndex(item => item.id === id);
        if (idx !== -1) {
          queues[dept].splice(idx, 1);
          return;
        }
      }
    },
    resolveTop(dept) {
      if (queues[dept].length > 0) {
        queues[dept].shift();
      }
    },
    resolveByCustomerId(customerId) {
      for (const dept of DEPT_KEYS) {
        const idx = queues[dept].findIndex(item => item.customerId === customerId);
        if (idx !== -1) {
          queues[dept].splice(idx, 1);
          return true;
        }
      }
      return false;
    },
    drainQueues() {
      const all: QueueItem[] = [];
      for (const dept of DEPT_KEYS) {
        all.push(...queues[dept]);
        queues[dept] = [];
      }
      return all;
    },

    snapshot() {
      const out = {} as Record<DeptKey, readonly QueueItem[]>;
      for (const dept of DEPT_KEYS) {
        out[dept] = queues[dept].map((item) => ({ ...item }));
      }
      return { schemaVersion: 1, queues: out };
    },

    restore(snap) {
      let maxAutoId = 0;
      for (const dept of DEPT_KEYS) {
        queues[dept] = (snap.queues[dept] ?? []).map((item) => ({ ...item }));
        for (const item of queues[dept]) {
          // Auto-generated ids are `q-<n>`; service items carry their own
          // `svc:...` id and don't feed this counter.
          const match = /^q-(\d+)$/.exec(item.id);
          if (match) maxAutoId = Math.max(maxAutoId, Number(match[1]));
        }
      }
      // Advance the shared counter past any restored id so new items are unique.
      if (maxAutoId >= _nextId) _nextId = maxAutoId + 1;
    },
  };
}
