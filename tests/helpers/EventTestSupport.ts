import { EventType } from '../../src/domain.js';

import { generateReviewRef } from './ReviewRefTestSupport.js';

import { getRandomEnumValue, getUniqueDate, getUniqueInt, getUniqueString, getUuid } from '@couimet/dynamic-testing';
import type { Event } from '@prisma/client';

export const generateEventHydrationData = (overrideValues?: Partial<Event>): Event => {
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
    pull_request_id: getUniqueInt(),
    repo_full_name: ref.repoFullName,
    pr_number: ref.prNumber,
    correlation_id: getUuid(),
    request_id: getUuid(),
    version: getUniqueString(),
    payload: JSON.stringify({ source_ts: getUniqueDate().toISOString(), source_comment_url: getUniqueString() }),
    metadata: JSON.stringify({ git_sha: getUniqueString() }),
    ...rest,
  };
};
