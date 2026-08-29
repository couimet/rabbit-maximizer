import type { PruneEvaluator } from '../../src/services.js';

import { jest } from '@jest/globals';

export const createMockPruneEvaluator = (overrides?: Partial<jest.Mocked<PruneEvaluator>>): jest.Mocked<PruneEvaluator> =>
  ({
    evaluate: jest.fn<any>().mockResolvedValue([]),
    ...overrides,
  }) as unknown as jest.Mocked<PruneEvaluator>;
