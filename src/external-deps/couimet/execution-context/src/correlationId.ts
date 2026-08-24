import { ExecutionContextErrorCodes } from './executionContextErrorCodes.js';
import { isNonBlank } from './isNonBlank.js';

import { DetailedError } from '@couimet/detailed-error';
import { v4 as uuidv4 } from 'uuid';

export class CorrelationId {
  private constructor(private readonly value: string) {}

  static create(): CorrelationId {
    return new CorrelationId(uuidv4());
  }

  static fromString(value: string): CorrelationId {
    if (isNonBlank(value)) {
      return new CorrelationId(value);
    }

    throw new DetailedError({
      code: ExecutionContextErrorCodes.INVALID_BLANK_CORRELATION_ID,
      message: 'correlationId must be a non-blank string',
      functionName: 'CorrelationId.fromString',
      details: { value },
    });
  }

  /** Never throws: blank or missing values fall back to a generated id. */
  static fromStringOrCreate(value: string | undefined): CorrelationId {
    if (isNonBlank(value)) {
      return CorrelationId.fromString(value);
    }

    return CorrelationId.create();
  }

  toString(): string {
    return this.value;
  }
}
