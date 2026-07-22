import { TYPES } from '../domain.js';
import type { QueueItem, QueueItemResponse } from '../types/index.js';
import { nullableDateToISOString, nullableString, type QueueItemEnricher } from '../utils/index.js';

import { inject, injectable } from 'inversify';

@injectable()
export class QueueItemMapper {
  /* c8 ignore start — decorator emit branches */
  constructor(@inject(TYPES.QueueItemEnricher) private readonly enricher: QueueItemEnricher) {}
  /* c8 ignore stop */

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
      retrigger_comment_url: nullableString(input.retrigger_comment_url),
      retriggered_at: nullableDateToISOString(input.retriggered_at),
      failed_at: nullableDateToISOString(input.failed_at),
      reviewed_at: nullableDateToISOString(input.reviewed_at),
      pr_state: input.pr_state as QueueItemResponse['pr_state'],
      last_coderabbit_acknowledged_at: nullableDateToISOString(input.last_coderabbit_acknowledged_at),
      created_at: input.created_at.toISOString(),
      updated_at: input.updated_at.toISOString(),
    };
  }

  async mapToQueueItemResponseList(inputs: QueueItem[]): Promise<QueueItemResponse[]> {
    const enriched = await this.enricher.enrich(inputs);
    return enriched.map((item) => this.mapToQueueItemResponse(item));
  }
}
