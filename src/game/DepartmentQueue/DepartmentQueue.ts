import type { EventBus } from '../EventBus';
import type { DeptKey, QueueItem } from './types';

export interface DepartmentQueue {
  getQueue(dept: DeptKey): readonly QueueItem[];
  getBadgeCount(dept: DeptKey): number;
  getBadges(): Record<DeptKey, number>;
  resolveItem(id: string): void;
  resolveTop(dept: DeptKey): void;
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
  };
}
