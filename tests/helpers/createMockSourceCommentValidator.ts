import type { SourceCommentValidator } from '../../src/SourceCommentValidator.js';

import { jest } from '@jest/globals';

export const createMockSourceCommentValidator = (overrides?: Partial<jest.Mocked<SourceCommentValidator>>): jest.Mocked<SourceCommentValidator> =>
  ({
    validate: jest.fn<any>().mockResolvedValue({ action: 'proceed' }),
    ...overrides,
  }) as unknown as jest.Mocked<SourceCommentValidator>;
