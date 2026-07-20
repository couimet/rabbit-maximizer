import type { CommentEditDetector } from '../../src/detection/CommentEditDetector.js';

import { jest } from '@jest/globals';

export const createMockCommentEditDetector = () =>
  ({
    detect: jest.fn<any>(),
  }) as unknown as jest.Mocked<CommentEditDetector>;
