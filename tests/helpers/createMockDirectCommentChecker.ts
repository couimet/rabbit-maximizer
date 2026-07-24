import type { DirectCommentChecker } from '../../src/services.js';

import { jest } from '@jest/globals';

export const createMockDirectCommentChecker = (): jest.Mocked<DirectCommentChecker> => ({
  check: jest.fn<any>().mockResolvedValue(undefined),
});
