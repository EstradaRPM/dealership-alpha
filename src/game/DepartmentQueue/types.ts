export type DeptKey = 'sales' | 'service' | 'bdc' | 'office' | 'lot';
export type ItemType = 'routine' | 'workspace' | 'callback' | 'missed_opportunity';

export interface QueueItem {
  readonly id: string;
  readonly type: ItemType;
  readonly dept: DeptKey;
  readonly label: string;
  readonly createdDay: number;
  readonly customerId?: string;
  /** Service items only (#303): the base ticket revenue, carried on the queue
   *  item so the per-tick floor drain can resolve a restored (post-load) item
   *  without the retired flat intake table. */
  readonly baseRevenue?: number;
}

/**
 * Save/load blob (#193). Self-versioned per the #188 contract. Captures every
 * department's pending work verbatim; restore re-seats the queues and advances
 * the id counter past the restored ids so freshly-enqueued items never collide.
 */
export interface DepartmentQueueSnapshot {
  readonly schemaVersion: 1;
  readonly queues: Record<DeptKey, readonly QueueItem[]>;
}
