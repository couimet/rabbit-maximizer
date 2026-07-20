import { evaluateReEnqueue } from '../../src/detection/ReEnqueueEvaluator.js';
import { QueueStatus } from '../../src/types/QueueStatus.js';
import { makeQueueItem } from '../helpers/makeQueueItem.js';

import { describe, expect, it } from '@jest/globals';

describe('evaluateReEnqueue', () => {
  it('returns fall_through when no existing item', () => {
    const result = evaluateReEnqueue(undefined);
    expect(result).toStrictEqual({ action: 'fall_through', reason: 'No existing queue item' });
  });

  it('returns skip for pending items', () => {
    const result = evaluateReEnqueue(makeQueueItem({ status: QueueStatus.pending }));
    expect(result).toStrictEqual({ action: 'skip', reason: 'Already pending' });
  });

  it('returns skip for retriggered items', () => {
    const result = evaluateReEnqueue(makeQueueItem({ status: QueueStatus.retriggered }));
    expect(result).toStrictEqual({ action: 'skip', reason: 'Already retriggered' });
  });

  it('returns re_enqueue for reviewed items', () => {
    const result = evaluateReEnqueue(makeQueueItem({ status: QueueStatus.reviewed }));
    expect(result).toStrictEqual({ action: 're_enqueue', reason: 'Previously reviewed; re-enqueuing' });
  });

  it('returns re_enqueue for failed items', () => {
    const result = evaluateReEnqueue(makeQueueItem({ status: QueueStatus.failed }));
    expect(result).toStrictEqual({ action: 're_enqueue', reason: 'Previously failed; re-enqueuing' });
  });

  it('returns fall_through for coderabbit_skipped items', () => {
    const result = evaluateReEnqueue(makeQueueItem({ status: QueueStatus.coderabbit_skipped }));
    expect(result).toStrictEqual({ action: 'fall_through', reason: 'Was skipped; may need re-evaluation' });
  });
});
