import { DismissalReason, PrState } from '../domain.js';
import { RabbitMaximizerError } from '../errors/index.js';

export const dismissalReasonFromPrState = (prState: PrState): DismissalReason => {
  switch (prState) {
    case PrState.merged:
      return DismissalReason.prMerged;
    case PrState.closed:
      return DismissalReason.prClosedWithoutMerge;
    default:
      throw RabbitMaximizerError.forUnexpectedSwitchDefault('prState', prState, 'dismissalReasonFromPrState');
  }
};
