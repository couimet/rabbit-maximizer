import type { ProbeFactory } from '../../src/probes/ProbeFactory.js';

import {
  createMockDetectedProbe,
  createMockEnqueueProbe,
  createMockMarkQueueItemReviewedProbe,
  createMockPrunerProbe,
  createMockReviewDetectorProbe,
  createMockReviewRetriggerProbe,
  createMockSchedulerProbe,
} from './createMockProbes.js';

import { jest } from '@jest/globals';

export const createMockProbeFactory = (overrides?: Partial<Record<keyof ProbeFactory, jest.Mock>>): jest.Mocked<ProbeFactory> =>
  ({
    createDetectedProbe: jest.fn().mockImplementation(() => createMockDetectedProbe()),
    createMarkQueueItemReviewedProbe: jest.fn().mockImplementation(() => createMockMarkQueueItemReviewedProbe()),
    createEnqueueProbe: jest.fn().mockImplementation(() => createMockEnqueueProbe()),
    createSchedulerProbe: jest.fn().mockImplementation(() => createMockSchedulerProbe()),
    createPrunerProbe: jest.fn().mockImplementation(() => createMockPrunerProbe()),
    createReviewDetectorProbe: jest.fn().mockImplementation(() => createMockReviewDetectorProbe()),
    createReviewRetriggerProbe: jest.fn().mockImplementation(() => createMockReviewRetriggerProbe()),
    ...overrides,
  }) as unknown as jest.Mocked<ProbeFactory>;
