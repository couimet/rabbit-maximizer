import type { QueueRepository } from './db/index.js';
import { type CoderabbitCommentClassifier, type CoderabbitGitHubClient, splitRepo } from './github/index.js';
import type { ProbeFactory } from './probes/index.js';
import { type DetectedComment, type OnDetectedCallback } from './types/index.js';
import { CodeRabbitCommentType, CommentDetectionMethod } from './domain.js';
import { TYPES } from './server-domain.js';

import { inject, injectable } from 'inversify';

/**
 * Clears queue items that CodeRabbit already permanently refused. An item the loop
 * enqueued before the phrase list existed stays queued, so this sweep re-reads every
 * active item's source comment from GitHub at startup and classifies the full body.
 */
@injectable()
export class RefusalSweeper {
  /* c8 ignore start — decorator emit branches */
  constructor(
    @inject(TYPES.QueueRepository)
    private readonly queue: QueueRepository,
    @inject(TYPES.CoderabbitGitHubClient)
    private readonly github: CoderabbitGitHubClient,
    @inject(TYPES.OnDetectedCallback)
    private readonly onDetected: OnDetectedCallback,
    @inject(TYPES.ProbeFactory)
    private readonly probes: ProbeFactory,
    @inject(TYPES.CoderabbitCommentClassifier)
    private readonly classifier: CoderabbitCommentClassifier,
  ) {}
  /* c8 ignore stop */

  async sweep(): Promise<number> {
    const activeItems = await this.queue.getActiveQueue();
    const probe = this.probes.createRefusalSweeperProbe();
    if (activeItems.length === 0) {
      return 0;
    }
    probe.sweepStarted(activeItems.length);

    let refused = 0;
    for (const item of activeItems) {
      let body: string;
      let createdAt: string;
      let updatedAt: string;
      try {
        const { owner, repo } = splitRepo(item.repo_full_name);
        const fetched = await this.github.fetchComment(owner, repo, item.source_comment_id);
        body = fetched.body;
        createdAt = fetched.createdAt;
        updatedAt = fetched.updatedAt;
      } catch (err: unknown) {
        probe.itemFailed(item.repo_full_name, item.pr_number, item.source_comment_id, err);
        continue;
      }

      const classification = this.classifier.classify(body);
      if (classification.classification !== CodeRabbitCommentType.review_refused) {
        continue;
      }

      const comment: DetectedComment = {
        url: item.source_comment_url,
        repoFullName: item.repo_full_name,
        prNumber: item.pr_number,
        commentId: item.source_comment_id,
        createdAt,
        updatedAt,
        prTitle: item.pr_title,
        body,
        commentType: classification.classification,
        detectedVia: CommentDetectionMethod.RefusalSweep,
      };
      try {
        await this.onDetected(comment, item.pull_request_id);
        refused += 1;
      } catch (err: unknown) {
        probe.itemFailed(item.repo_full_name, item.pr_number, item.source_comment_id, err);
      }
    }

    probe.completed(activeItems.length, refused);
    return refused;
  }
}
