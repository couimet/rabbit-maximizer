import { TYPES } from '../inversify-types.js';
import type { PRState } from '../types/PRState.js';

import type { CoderabbitGitHubClient } from './coderabbitGitHubClient.js';

import type { Logger } from '@couimet/logger-contract';
import { inject, injectable } from 'inversify';

export interface PRStateFetcher {
  fetch(repo: string, pr: number, fn: string): Promise<PRState | undefined>;
}

@injectable()
export class PRStateFetcherImpl implements PRStateFetcher {
  /* c8 ignore start — decorator emit branches */
  constructor(
    @inject(TYPES.CoderabbitGitHubClient)
    private readonly github: CoderabbitGitHubClient,
    @inject(TYPES.Logger) private readonly log: Logger,
  ) {}
  /* c8 ignore stop */

  async fetch(repo: string, pr: number, fn: string): Promise<PRState | undefined> {
    try {
      return await this.github.getPRState(repo, pr);
    } catch (err: unknown) {
      this.log.warn({ fn, repo, pr, error: err }, 'Failed to fetch PR state; proceeding without it');
      return undefined;
    }
  }
}
