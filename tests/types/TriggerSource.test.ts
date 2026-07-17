import { TriggerSource } from '../../src/types/TriggerSource.js';

import { describe, expect, it } from '@jest/globals';

describe('TriggerSource', () => {
  it('has the correct values', () => {
    expect(TriggerSource).toStrictEqual({
      dashboard_retrigger_now: 'dashboard_retrigger_now',
      scheduler: 'scheduler',
    });
  });
});
