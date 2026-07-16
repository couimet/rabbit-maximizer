import type { EventLogEntry } from '../../src/types/EventLogEntry.js';
import { EventType } from '../../src/types/EventType.js';

import { getRandomEnumValue, getUniqueDate, getUniqueGitHubRepoRef, getUniqueInt, getUuid } from '@couimet/dynamic-testing';

export const makeEventEntry = (overrides: Record<string, unknown> = {}) =>
  ({
    id: getUniqueInt(),
    uuid: getUuid(),
    ts: getUniqueDate(),
    type: getRandomEnumValue(EventType),
    repo_full_name: getUniqueGitHubRepoRef().fullName,
    pr_number: getUniqueInt(),
    correlation_id: getUuid(),
    version: '1.0.0',
    payload: {},
    ...overrides,
  }) as EventLogEntry;
