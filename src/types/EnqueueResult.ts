import type { QueueItem } from './QueueItem.js';

/** Returned by QueueRepository.enqueue() — signals whether a new row was created. */
export interface EnqueueResult {
  readonly item: QueueItem;
  readonly created: boolean;
}
