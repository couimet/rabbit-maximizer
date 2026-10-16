import { STATE_CLASS, STATE_LABEL } from '../../dashboard/src/components/activityStateMeta.js';

import { describe, expect, it } from '@jest/globals';

describe('activityStateMeta', () => {
  it('freezes the status pill labels', () => {
    expect(STATE_LABEL).toStrictEqual({
      review_completed: 'CodeRabbit: completed analysis',
      manual_review: 'Manual review',
      failed: 'Failed',
      pr_merged: 'PR merged',
      pr_closed: 'Closed',
      skipped: 'Skipped',
      review_in_progress: 'CodeRabbit: review in progress',
      review_limited: 'CodeRabbit review-limited',
      awaiting_review: 'Awaiting CodeRabbit review',
      stale_comment: 'Stale comment',
      permanently_refused: 'CodeRabbit refused permanently',
      pending: 'Pending',
      unknown: 'Unknown',
    });
  });

  it('freezes the status pill classes', () => {
    expect(STATE_CLASS).toStrictEqual({
      review_completed: 'reviewed',
      manual_review: 'reviewed',
      failed: 'failed',
      pr_merged: 'merged',
      pr_closed: 'closed',
      skipped: 'skipped',
      review_in_progress: 'retriggered',
      review_limited: 'retriggered',
      awaiting_review: 'retriggered',
      stale_comment: 'stale',
      permanently_refused: 'failed',
      pending: 'pending',
      unknown: 'unknown',
    });
  });
});
