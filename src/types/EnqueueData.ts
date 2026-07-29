import type { CreateSkippedData } from './index.js';

export interface EnqueueData extends CreateSkippedData {
  readonly commentUpdatedAt?: Date;
}
