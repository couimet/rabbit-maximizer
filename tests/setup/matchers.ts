import {
  toBeRabbitOptimizerError,
  toThrowRabbitOptimizerError,
  toThrowRabbitOptimizerErrorAsync,
  type ExpectedRabbitOptimizerError,
} from "../matchers/toBeRabbitOptimizerError.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toBeRabbitOptimizerError(
        code: string,
        expected: ExpectedRabbitOptimizerError,
      ): R;
      toThrowRabbitOptimizerError(
        code: string,
        expected: ExpectedRabbitOptimizerError,
      ): R;
      toThrowRabbitOptimizerErrorAsync(
        code: string,
        expected: ExpectedRabbitOptimizerError,
      ): Promise<R>;
    }
  }
}

expect.extend({
  toBeRabbitOptimizerError,
  toThrowRabbitOptimizerError,
  toThrowRabbitOptimizerErrorAsync,
});

export {};
