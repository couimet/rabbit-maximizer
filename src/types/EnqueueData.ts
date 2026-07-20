import type { CreateSkippedData } from './CreateSkippedData.js';

export interface EnqueueData extends CreateSkippedData {
  readonly newWait: number;
}
