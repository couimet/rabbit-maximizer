import type { ReEnqueueAction } from './index.js';

export interface ReEnqueueDecision {
  readonly action: ReEnqueueAction;
  readonly reason: string;
}
