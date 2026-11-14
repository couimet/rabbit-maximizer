import type { Logger } from '@couimet/logger-contract';

export class RefusalSweeperProbe {
  constructor(private readonly log: Logger) {}

  sweepStarted(count: number): void {
    this.log.info({ fn: 'RefusalSweeperProbe.sweepStarted', count }, 'Sweeping active queue items for permanent CodeRabbit refusals');
  }

  itemFailed(repo: string, pr: number, sourceCommentId: number, error: unknown): void {
    this.log.warn({ fn: 'RefusalSweeperProbe.itemFailed', repo, pr, sourceCommentId, error }, 'Failed to sweep one queue item; skipping it and continuing');
  }

  completed(checked: number, refused: number): void {
    this.log.info({ fn: 'RefusalSweeperProbe.completed', checked, refused }, 'Permanent refusal sweep completed');
  }
}
