import type { EventBus } from '../EventBus';
import type { DepartmentQueue } from '../DepartmentQueue';
import type { GameClock } from '../GameClock';

export interface CloseEarlyCost {
  walkCount: number;
  reputationHit: number;
}

export interface CloseEarly {
  previewCost(): CloseEarlyCost;
  execute(): void;
}

function loadConfig(): { reputationHitPerWalk: number } {
  const raw: unknown = require('../../../data/close-early.json');
  const cfg = raw as { reputationHitPerWalk: number };
  return { reputationHitPerWalk: cfg.reputationHitPerWalk };
}

const WALK_TYPES = new Set(['workspace', 'callback']);

export function createCloseEarly(deps: {
  bus: EventBus;
  queue: DepartmentQueue;
  clock: GameClock;
}): CloseEarly {
  const { bus, queue, clock } = deps;
  const { reputationHitPerWalk } = loadConfig();

  function countWalks(): number {
    let count = 0;
    for (const dept of ['sales', 'service', 'bdc', 'office', 'lot'] as const) {
      for (const item of queue.getQueue(dept)) {
        if (WALK_TYPES.has(item.type) && item.customerId != null) count++;
      }
    }
    return count;
  }

  return {
    previewCost() {
      const walkCount = countWalks();
      return { walkCount, reputationHit: walkCount * reputationHitPerWalk };
    },

    execute() {
      const day = clock.currentDay;
      const drained = queue.drainQueues();
      let walkCount = 0;
      for (const item of drained) {
        if (WALK_TYPES.has(item.type) && item.customerId != null) {
          bus.publish('customer:resolved', {
            customerId: item.customerId,
            outcome: 'walk',
            receptivity: 0,
            satisfaction: 0,
            retentionSeed: 0,
            heat: 0,
            agreedPrice: 0,
            frontGross: 0,
          });
          walkCount++;
        }
      }
      const reputationHit = walkCount * reputationHitPerWalk;
      if (reputationHit > 0) {
        bus.publish('reputation:satisfaction_hit', { day, amount: reputationHit, reason: 'close_early' });
      }
      bus.publish('player:close_early', { day, walkCount, reputationHit });
      clock.advanceDay();
    },
  };
}
