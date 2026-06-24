export type DeptKey = 'sales' | 'service' | 'bdc' | 'office' | 'lot' | 'bodyshop';
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
  /** Service items only (#304): the due job/parts category and the vehicle,
   *  carried on the queue item so the parts-gate resolves a restored
   *  (post-load) or pre-drain-bootstrap item against the right PartsInventory
   *  category (and can name the customer/vehicle on a miss/rush). */
  readonly jobCategory?:
    | 'oil_filters'
    | 'tires_brakes'
    | 'drivetrain'
    | 'electronics'
    // Body-Shop collision categories (#314) — the same per-item carry as Service,
    // so a restored/pre-drain Body-Shop item resolves against the right
    // PartsInventory category.
    | 'windows_glass'
    | 'doors_panels'
    | 'interior_trim'
    | 'paint';
  readonly vehicleId?: string;
  /** Body-Shop items only (#314): the demand channel (insurance DRP vs retail
   *  customer-pay), carried so a restored (post-load) item prices through the
   *  right channel-posture path on the drain. */
  readonly source?: 'insurance' | 'retail';
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
