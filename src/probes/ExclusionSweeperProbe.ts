import type { Logger } from '@couimet/logger-contract';

export class ExclusionSweeperProbe {
  constructor(private readonly log: Logger) {}

  sweepStarted(count: number): void {
    this.log.info({ fn: 'ExclusionSweeperProbe.sweepStarted', count }, 'Sweeping active queue items for ignore-rule matches');
  }

  itemFailed(repo: string, pr: number, pullRequestId: number, error: unknown): void {
    this.log.warn({ fn: 'ExclusionSweeperProbe.itemFailed', repo, pr, pullRequestId, error }, 'Failed to sweep one queue item; skipping it and continuing');
  }

  completed(checked: number, excluded: number): void {
    this.log.info({ fn: 'ExclusionSweeperProbe.completed', checked, excluded }, 'Ignore-rule sweep completed');
  }
}
