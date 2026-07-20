import type { EventLogEntry } from '../../src/types/EventLogEntry.js';
import { EventType } from '../../src/types/EventType.js';

import { makeReviewRef } from './makeReviewRef.js';

import { getRandomEnumValue, getUniqueDate, getUniqueInt, getUuid } from '@couimet/dynamic-testing';

export const makeEventEntry = (overrides: Record<string, unknown> = {}) => {
  const ref = makeReviewRef({
    repoFullName: overrides.repo_full_name as string | undefined,
    prNumber: overrides.pr_number as number | undefined,
  });
  const { repo_full_name: _rf, pr_number: _pn, ...rest } = overrides;
  return {
    id: getUniqueInt(),
    uuid: getUuid(),
    ts: getUniqueDate(),
    type: getRandomEnumValue(EventType),
    repo_full_name: ref.repoFullName,
    pr_number: ref.prNumber,
    correlation_id: getUuid(),
    version: '1.0.0',
    payload: {},
    ...rest,
  } as EventLogEntry;
};
