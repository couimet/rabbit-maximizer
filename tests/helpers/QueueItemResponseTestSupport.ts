import type { QueueItemResponse } from '../../src/types/index.js';

import { generateQueueItemHydrationData } from './QueueItemTestSupport.js';

export const generateQueueItemResponseData = (overrides?: Partial<QueueItemResponse>): QueueItemResponse => {
  const base = generateQueueItemHydrationData();
  return {
    id: base.id,
    uuid: base.uuid,
    repo_full_name: base.repo_full_name,
    pr_number: base.pr_number,
    pr_title: base.pr_title,
    status: base.status as QueueItemResponse['status'],
    attempts: base.attempts,
    source_comment_url: base.source_comment_url,
    trigger_source: base.trigger_source as QueueItemResponse['trigger_source'],
    retrigger_comment_url: base.retrigger_comment_url ?? null,
    retriggered_at: base.retriggered_at?.toISOString() ?? null,
    failed_at: base.failed_at?.toISOString() ?? null,
    reviewed_at: base.reviewed_at?.toISOString() ?? null,
    last_coderabbit_acknowledged_at: null,
    created_at: base.created_at.toISOString(),
    updated_at: base.updated_at.toISOString(),
    ...overrides,
  };
};
