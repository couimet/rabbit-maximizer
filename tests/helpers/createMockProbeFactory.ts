import type { ProbeFactory } from '../../src/probes/index.js';

import {
  createMockDetectedProbe,
  createMockDirectCommentCheckProbe,
  createMockEnqueueProbe,
  createMockMarkQueueItemReviewedProbe,
  createMockPrScannerProbe,
  createMockPrunerProbe,
  createMockReviewDetectorProbe,
  createMockReviewRetriggerProbe,
  createMockSchedulerProbe,
} from './createMockProbes.js';

import { jest } from '@jest/globals';

export const createMockProbeFactory = (overrides?: Partial<Record<keyof ProbeFactory, jest.Mock>>): jest.Mocked<ProbeFactory> =>
  ({
    createDetectedProbe: jest.fn(() => createMockDetectedProbe()),
    createDirectCommentCheckProbe: jest.fn(() => createMockDirectCommentCheckProbe()),
    createMarkQueueItemReviewedProbe: jest.fn(() => createMockMarkQueueItemReviewedProbe()),
    createEnqueueProbe: jest.fn(() => createMockEnqueueProbe()),
    createSchedulerProbe: jest.fn(() => createMockSchedulerProbe()),
    createPrScannerProbe: jest.fn(() => createMockPrScannerProbe()),
    createPrunerProbe: jest.fn(() => createMockPrunerProbe()),
    createReviewDetectorProbe: jest.fn(() => createMockReviewDetectorProbe()),
    createReviewRetriggerProbe: jest.fn(() => createMockReviewRetriggerProbe()),
    ...overrides,
  }) as unknown as jest.Mocked<ProbeFactory>;
