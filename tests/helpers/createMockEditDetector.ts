import type { EditDetector } from '../../src/EditDetector.js';

import { jest } from '@jest/globals';

export const createMockEditDetector = (overrides?: Partial<jest.Mocked<EditDetector>>): jest.Mocked<EditDetector> =>
  ({
    detectEdit: jest.fn<any>(),
    ...overrides,
  }) as unknown as jest.Mocked<EditDetector>;
