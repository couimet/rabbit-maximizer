import type { ProbeFactory } from '../../src/probes/ProbeFactory.js';

import {
  createMockDetectedProbe,
  createMockEnqueueProbe,
  createMockPrunerProbe,
  createMockReviewDetectorProbe,
  createMockReviewRetriggerProbe,
  createMockSchedulerProbe,
} from './createMockProbes.js';

import { jest } from '@jest/globals';

export const createMockProbeFactory = (overrides?: Partial<Record<keyof ProbeFactory, jest.Mock>>): jest.Mocked<ProbeFactory> =>
  ({
    createDetectedProbe: jest.fn().mockReturnValue(createMockDetectedProbe()),
    createMarkQueueItemReviewedProbe: jest.fn(),
    createEnqueueProbe: jest.fn().mockReturnValue(createMockEnqueueProbe()),
    createSchedulerProbe: jest.fn().mockReturnValue(createMockSchedulerProbe()),
    createPrunerProbe: jest.fn().mockReturnValue(createMockPrunerProbe()),
    createReviewDetectorProbe: jest.fn().mockReturnValue(createMockReviewDetectorProbe()),
    createReviewRetriggerProbe: jest.fn().mockReturnValue(createMockReviewRetriggerProbe()),
    ...overrides,
  }) as unknown as jest.Mocked<ProbeFactory>;
