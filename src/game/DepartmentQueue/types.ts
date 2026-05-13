export type DeptKey = 'sales' | 'service' | 'bdc' | 'office' | 'lot';
export type ItemType = 'routine' | 'workspace';

export interface QueueItem {
  readonly id: string;
  readonly type: ItemType;
  readonly dept: DeptKey;
  readonly label: string;
  readonly createdDay: number;
  readonly customerId?: string;
}
