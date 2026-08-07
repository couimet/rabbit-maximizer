import { TYPES } from '../domain.js';
import type { ActivityListItemResponse, EnrichedQueueItem, QueueItem } from '../types/index.js';
import { nullableDateToISOString, nullableString, QueueItemEnricher } from '../utils/index.js';

import { inject, injectable } from 'inversify';

@injectable()
export class ReviewQueueToActivityListItemMapper {
  /* c8 ignore start — decorator emit branches */
  constructor(@inject(TYPES.QueueItemEnricher) private readonly enricher: QueueItemEnricher) {}
  /* c8 ignore stop */

  async mapToList(items: QueueItem[]): Promise<ActivityListItemResponse[]> {
    const enriched = await this.enricher.enrich(items);
    return enriched.map((item) => this.fromEnriched(item));
  }

  private fromEnriched(item: EnrichedQueueItem): ActivityListItemResponse {
    return {
      uuid: item.uuid,
      repo_full_name: item.repo_full_name,
      pr_number: item.pr_number,
      pr_title: item.pr_title,
      author_login: item.authorLogin,
      status: item.status,
      resolution: nullableString(item.resolution),
      retriggered_at: nullableDateToISOString(item.retriggered_at),
      resolved_at: nullableDateToISOString(item.resolved_at),
      failed_at: nullableDateToISOString(item.failed_at),
      created_at: item.created_at.toISOString(),
      retrigger_comment_url: nullableString(item.retrigger_comment_url),
      source_comment_url: item.source_comment_url,
      last_review_url: nullableString(item.coderabbitReview?.htmlUrl),
      last_review_state: nullableString(item.coderabbitReview?.state) as ActivityListItemResponse['last_review_state'],
      review_count: item.reviewCount,
      retrigger_count: item.retriggerCount,
      last_coderabbit_acknowledged_at: nullableDateToISOString(item.lastCoderabbitAcknowledgedAt),
      pr_state: nullableString(item.prState) as ActivityListItemResponse['pr_state'],
      last_activity_at: computeLastActivity(item),
    };
  }
}

const computeLastActivity = (item: QueueItem): string => {
  const dates: Date[] = [];
  if (item.resolved_at) dates.push(item.resolved_at);
  if (item.failed_at) dates.push(item.failed_at);
  if (item.retriggered_at) dates.push(item.retriggered_at);
  dates.push(item.created_at);
  return dates.reduce((latest, d) => (d.getTime() > latest.getTime() ? d : latest)).toISOString();
};
