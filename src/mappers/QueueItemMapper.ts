import type { QueueItemResponse } from '../types/api.js';
import type { QueueItem } from '../types/QueueItem.js';

import { injectable } from 'inversify';

@injectable()
export class QueueItemMapper {
  mapToQueueItemResponse(input: QueueItem): QueueItemResponse {
    return {
      id: input.id,
      uuid: input.uuid,
      repo_full_name: input.repo_full_name,
      pr_number: input.pr_number,
      pr_title: input.pr_title,
      status: input.status as QueueItemResponse['status'],
      attempts: input.attempts,
      source_comment_url: input.source_comment_url,
      trigger_source: input.trigger_source as QueueItemResponse['trigger_source'],
      retrigger_comment_url: input.retrigger_comment_url,
      retriggered_at: input.retriggered_at?.toISOString(),
      failed_at: input.failed_at?.toISOString(),
      reviewed_at: input.reviewed_at?.toISOString(),
      created_at: input.created_at.toISOString(),
      updated_at: input.updated_at.toISOString(),
    };
  }

  mapToQueueItemResponseList(inputs: QueueItem[]): QueueItemResponse[] {
    return inputs.map((item) => this.mapToQueueItemResponse(item));
  }
}
