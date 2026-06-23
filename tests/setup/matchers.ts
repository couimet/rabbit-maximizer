import {
  type ExpectedRabbitOptimizerError,
  toBeRabbitOptimizerError,
  toThrowRabbitOptimizerError,
  toThrowRabbitOptimizerErrorAsync,
} from '../matchers/toBeRabbitOptimizerError.js';

import { expect } from '@jest/globals';

declare module '@jest/expect' {
  interface Matchers<R extends void | Promise<void>> {
    toBeRabbitOptimizerError(code: string, expected: ExpectedRabbitOptimizerError): R;
    toThrowRabbitOptimizerError(code: string, expected: ExpectedRabbitOptimizerError): R;
  }
}

expect.extend({
  toBeRabbitOptimizerError,
  toThrowRabbitOptimizerError,
  toThrowRabbitOptimizerErrorAsync,
});
