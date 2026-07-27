import { safeDeriveActivityStatus } from '../../dashboard/src/activityState.js';
import type { QueueItemResponse } from '../../src/types/index.js';
import { generateQueueItemResponseData } from '../helpers/index.js';

import { describe, expect, it } from '@jest/globals';

describe('safeDeriveActivityStatus', () => {
  it('returns derived status for valid items', () => {
    const item = generateQueueItemResponseData({ status: 'pending', source_comment_url: undefined });

    const result = safeDeriveActivityStatus(item);

    expect(result).toStrictEqual({ state: 'pending', linkUrl: undefined });
  });

  it('returns fallback when deriveActivityStatus throws', () => {
    const item = generateQueueItemResponseData({ status: 'unexpected_value' as QueueItemResponse['status'] });

    const result = safeDeriveActivityStatus(item);

    expect(result).toStrictEqual({ state: 'pending', linkUrl: undefined });
  });
});
