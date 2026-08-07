import type { ReviewQueueToActivityListItemMapper } from '../../src/mappers/index.js';

import { jest } from '@jest/globals';

export const createMockActivityListMapper = (
  overrides?: Partial<jest.Mocked<ReviewQueueToActivityListItemMapper>>,
): jest.Mocked<ReviewQueueToActivityListItemMapper> =>
  ({
    mapToList: jest.fn<any>().mockResolvedValue([]),
    ...overrides,
  }) as unknown as jest.Mocked<ReviewQueueToActivityListItemMapper>;
