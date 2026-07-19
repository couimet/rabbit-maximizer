import type { ReEnqueueAction } from './ReEnqueueAction.js';

export interface ReEnqueueDecision {
  readonly action: ReEnqueueAction;
  readonly reason: string;
}
