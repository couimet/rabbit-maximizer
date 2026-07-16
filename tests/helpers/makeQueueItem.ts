import { QueueStatus } from '../../src/types/QueueStatus.js';
import { TriggerSource } from '../../src/types/TriggerSource.js';

import { getRandomEnumValue, getUniqueDate, getUniqueGitHubRepoRef, getUniqueInt, getUuid } from '@couimet/dynamic-testing';

export const makeQueueItem = (overrides: Record<string, unknown> = {}) => ({
  id: getUniqueInt(),
  uuid: getUuid(),
  repo_full_name: getUniqueGitHubRepoRef().fullName,
  pr_number: getUniqueInt(),
  pr_title: `Test PR ${getUniqueInt()}`,
  status: getRandomEnumValue(QueueStatus),
  not_before: getUniqueDate(),
  attempts: 0,
  source_comment_url: `https://github.com/owner/repo/pull/1#discussion_r${getUniqueInt()}`,
  trigger_source: getRandomEnumValue(TriggerSource),
  created_at: getUniqueDate(),
  updated_at: getUniqueDate(),
  ...overrides,
});
