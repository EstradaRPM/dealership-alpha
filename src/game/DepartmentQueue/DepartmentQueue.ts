import type { EventBus } from '../EventBus';
import type { DeptKey, QueueItem } from './types';

export interface DepartmentQueue {
  getQueue(dept: DeptKey): readonly QueueItem[];
  getBadgeCount(dept: DeptKey): number;
  getBadges(): Record<DeptKey, number>;
  resolveItem(id: string): void;
  resolveTop(dept: DeptKey): void;
  resolveByCustomerId(customerId: string): boolean;
}

const DEPT_KEYS: DeptKey[] = ['sales', 'service', 'bdc', 'office', 'lot'];

let _nextId = 1;
function makeId(): string {
  return `q-${_nextId++}`;
}

export function createDepartmentQueue(deps: { bus: EventBus }): DepartmentQueue {
  const { bus } = deps;

  const queues: Record<DeptKey, QueueItem[]> = {
    sales: [], service: [], bdc: [], office: [], lot: [],
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
  };
}
