import { SchedulerStatus } from '../../src/types/SchedulerStatus.js';

import { describe, expect, it } from '@jest/globals';

describe('SchedulerStatus', () => {
  it('has the correct values', () => {
    expect(SchedulerStatus).toStrictEqual({
      paused: 'paused',
      running: 'running',
    });
  });
});
