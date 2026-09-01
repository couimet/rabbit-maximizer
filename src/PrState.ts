import { RabbitMaximizerError } from './errors/index.js';

// Keep alphabetically sorted by key.
export enum PrState {
  closed = 'closed',
  merged = 'merged',
  open = 'open',
}

// String-literal union of PrState values; used at API boundaries where pr_state arrives as a plain string
export type PrStateValue = `${PrState}`;

export const getPrStateFromGitHubValue = (value: string): PrState => {
  switch (value.toLowerCase()) {
    case PrState.closed:
      return PrState.closed;
    case PrState.merged:
      return PrState.merged;
    case PrState.open:
      return PrState.open;
    default:
      throw RabbitMaximizerError.forUnexpectedSwitchDefault('GitHub PR state', value, 'getPrStateFromGitHubValue');
  }
};
