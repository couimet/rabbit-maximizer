import type { QueueOrderRepository } from '../../src/db/queueOrderRepository.js';
import { type QueueItem, QueueStatus } from '../../src/types/index.js';

import { getUniqueDate, getUniqueInt, getUniqueString } from '@couimet/dynamic-testing';
import { jest } from '@jest/globals';

const makeItem = (): QueueItem => {
  const id = getUniqueInt();
  return {
    id,
    uuid: getUniqueString({ prefix: 'uuid-' }),
    repo_full_name: `${getUniqueString({ prefix: 'org' })}/${getUniqueString({ prefix: 'repo' })}`,
    pr_number: getUniqueInt(),
    status: QueueStatus.pending,
    not_before: getUniqueDate(),
    attempts: 0,
    source_comment_url: `https://github.com/owner/repo/issues/1#issuecomment-${id}`,
    source_comment_id: id,
    created_at: getUniqueDate(),
    updated_at: getUniqueDate(),
  };
};

export const createMockQueueOrderRepo = (overrides?: Partial<jest.Mocked<QueueOrderRepository>>): jest.Mocked<QueueOrderRepository> =>
  ({
    getEffectiveOrder: jest.fn<any>().mockResolvedValue([]),
    moveItems: jest.fn<any>().mockResolvedValue([]),
    moveToTop: jest.fn<any>().mockResolvedValue(makeItem()),
    ...overrides,
  }) as unknown as jest.Mocked<QueueOrderRepository>;
