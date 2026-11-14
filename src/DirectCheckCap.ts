import type { Config } from './config.js';
import { TYPES } from './server-domain.js';

import { inject, injectable } from 'inversify';

/**
 * The configured cap on the number of PRs the direct comment check inspects per scan.
 * The check costs one comments call per PR, so the cap bounds the API budget.
 */
@injectable()
export class DirectCheckCap {
  private readonly maxPRs: number;

  /* c8 ignore start — decorator emit branches */
  constructor(@inject(TYPES.Config) cfg: Config) {
    this.maxPRs = cfg.MAX_DIRECT_CHECK_PRS;
  }
  /* c8 ignore stop */

  max(): number {
    return this.maxPRs;
  }
}
