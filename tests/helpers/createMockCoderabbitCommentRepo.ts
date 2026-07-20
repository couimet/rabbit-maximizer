import type { CoderabbitCommentRepository } from '../../src/db/coderabbitCommentRepository.js';

import { jest } from '@jest/globals';

export const createMockCoderabbitCommentRepo = (overrides?: Partial<jest.Mocked<CoderabbitCommentRepository>>): jest.Mocked<CoderabbitCommentRepository> =>
  ({
    upsert: jest.fn<any>(),
    deactivate: jest.fn<any>(),
    findByCommentId: jest.fn<any>(),
    findByPr: jest.fn<any>(),
    findActiveByType: jest.fn<any>(),
    ...overrides,
  }) as unknown as jest.Mocked<CoderabbitCommentRepository>;
