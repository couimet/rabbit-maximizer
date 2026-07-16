import type { RabbitMaximizerError } from '../errors/RabbitMaximizerError.js';

import { DetailedResult } from '@couimet/detailed-result';

export class RabbitResult<T> extends DetailedResult<T, RabbitMaximizerError> {
  private constructor(success: boolean, value?: T, error?: RabbitMaximizerError) {
    super(success, value, error);
  }

  static ok<T>(value: T): RabbitResult<T> {
    return new RabbitResult<T>(true, value, undefined);
  }

  static err(error: RabbitMaximizerError): RabbitResult<never> {
    return new RabbitResult<never>(false, undefined, error);
  }
}
