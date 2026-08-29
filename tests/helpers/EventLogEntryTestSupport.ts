import { EventType } from '../../src/domain.js';
import type { EventLogEntry } from '../../src/types/index.js';

import { generateReviewRef } from './ReviewRefTestSupport.js';

import { getRandomEnumValue, getUniqueDate, getUniqueInt, getUuid } from '@couimet/dynamic-testing';

export const generateEventLogEntryHydrationData = (overrideValues?: Partial<EventLogEntry>): EventLogEntry => {
  const ref = generateReviewRef({
    repoFullName: overrideValues?.repo_full_name,
    prNumber: overrideValues?.pr_number,
  });
  const { repo_full_name: _rf, pr_number: _pn, ...rest } = overrideValues ?? {};
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
