import type { PullRequestRepository, QueueRepository } from './db/index.js';
import type { ProbeFactory } from './probes/index.js';
import { Resolution } from './domain.js';
import type { IgnoreRules } from './IgnoreRules.js';
import { TYPES } from './server-domain.js';

import { inject, injectable } from 'inversify';

/**
 * Resolves the queue items whose pull request matches an ignore rule. The detection
 * path only sees comments, so an item the loop enqueued before the rule existed stays
 * queued; this sweep re-matches the current rules against the current pull request rows.
 */
@injectable()
export class ExclusionSweeper {
  /* c8 ignore start — decorator emit branches */
  constructor(
    @inject(TYPES.QueueRepository)
    private readonly queue: QueueRepository,
    @inject(TYPES.PullRequestRepository)
    private readonly pullRequests: PullRequestRepository,
    @inject(TYPES.ProbeFactory)
    private readonly probes: ProbeFactory,
    @inject(TYPES.IgnoreRules)
    private readonly ignoreRules: IgnoreRules,
  ) {}
  /* c8 ignore stop */

  async sweep(): Promise<number> {
    if (!this.ignoreRules.hasRules()) {
      return 0;
    }

    const activeItems = await this.queue.getActiveQueue();
    if (activeItems.length === 0) {
      return 0;
    }

    const probe = this.probes.createExclusionSweeperProbe();
    probe.sweepStarted(activeItems.length);

    const pullRequestIds = [...new Set(activeItems.map((item) => item.pull_request_id))];
    const columns = await this.pullRequests.getColumnMaps(pullRequestIds, ['author_login', 'title']);
    const authorLogins = columns.author_login;
    const titles = columns.title;

    let excluded = 0;
    for (const item of activeItems) {
      const authorLogin = authorLogins.get(item.pull_request_id);
      const title = titles.get(item.pull_request_id);
      if (authorLogin === undefined || title === undefined) {
        continue;
      }
      if (this.ignoreRules.match({ authorLogin, title }) === undefined) {
        continue;
      }

      try {
        const changed = await this.queue.markResolvedByPullRequestId(item.pull_request_id, Resolution.Excluded, undefined);
        if (changed > 0) {
          excluded += 1;
        }
      } catch (err: unknown) {
        probe.itemFailed(item.repo_full_name, item.pr_number, item.pull_request_id, err);
      }
    }

    probe.completed(activeItems.length, excluded);
    return excluded;
  }
}
