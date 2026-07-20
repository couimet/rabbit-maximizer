import { RabbitMaximizerError } from '../errors/RabbitMaximizerError.js';
import type { QueueItem } from '../types/QueueItem.js';
import { QueueStatus } from '../types/QueueStatus.js';
import type { ReEnqueueDecision } from '../types/ReEnqueueDecision.js';

export const evaluateReEnqueue = (existingItem: QueueItem | undefined): ReEnqueueDecision => {
  if (existingItem === undefined) {
    return { action: 'fall_through', reason: 'No existing queue item' };
  }

  switch (existingItem.status) {
    case QueueStatus.pending:
      return { action: 'skip', reason: 'Already pending' };
    case QueueStatus.retriggered:
      return { action: 'skip', reason: 'Already retriggered' };
    case QueueStatus.reviewed:
      return { action: 're_enqueue', reason: 'Previously reviewed; re-enqueuing' };
    case QueueStatus.failed:
      return { action: 're_enqueue', reason: 'Previously failed; re-enqueuing' };
    case QueueStatus.coderabbit_skipped:
      return { action: 'fall_through', reason: 'Was skipped; may need re-evaluation' };
    /* c8 ignore next 3 — unreachable: every QueueStatus member maps to a handled case */
    default:
      throw RabbitMaximizerError.forUnexpectedSwitchDefault('queue status', existingItem.status, 'evaluateReEnqueue');
  }
};
