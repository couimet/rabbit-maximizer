import type { RabbitMaximizerError } from '../errors/RabbitMaximizerError.js';
import { DetailedResult } from '../external-deps/couimet/detailed-result/DetailedResult.js';

export type RabbitResult<T> = DetailedResult<T, RabbitMaximizerError>;

export const RabbitResult = {
  ok: <T>(value: T): RabbitResult<T> => DetailedResult.ok(value) as RabbitResult<T>,
  err: (error: RabbitMaximizerError): RabbitResult<never> => DetailedResult.err(error) as RabbitResult<never>,
};
