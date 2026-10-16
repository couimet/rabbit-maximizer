import type { Config } from '../config.js';
import { TYPES } from '../server-domain.js';

import { inject, injectable } from 'inversify';

/**
 * The configured phrases that mark a CodeRabbit comment as a permanent refusal.
 * The match is a plain case-sensitive substring test.
 */
@injectable()
export class RefusalPhrases {
  private readonly phrases: readonly string[];

  /* c8 ignore start — decorator emit branches */
  constructor(@inject(TYPES.Config) cfg: Config) {
    this.phrases = cfg.CODERABBIT_REFUSAL_PHRASES;
  }
  /* c8 ignore stop */

  match(body: string): string | undefined {
    return this.phrases.find((phrase) => body.includes(phrase));
  }
}
