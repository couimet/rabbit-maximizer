import { ExecutionContextErrorCodes } from './executionContextErrorCodes.js';
import { isNonBlank } from './isNonBlank.js';

import { DetailedError } from '@couimet/detailed-error';
import { v4 as uuidv4 } from 'uuid';

export class RequestId {
  private constructor(private readonly value: string) {}

  static create(): RequestId {
    return new RequestId(uuidv4());
  }

  static fromString(value: string): RequestId {
    if (isNonBlank(value)) {
      return new RequestId(value);
    }

    throw new DetailedError({
      code: ExecutionContextErrorCodes.INVALID_BLANK_REQUEST_ID,
      message: 'requestId must be a non-blank string',
      functionName: 'RequestId.fromString',
      details: { value },
    });
  }

  /** Never throws: blank or missing values fall back to a generated id. */
  static fromStringOrCreate(value: string | undefined): RequestId {
    if (isNonBlank(value)) {
      return RequestId.fromString(value);
    }

    return RequestId.create();
  }

  toString(): string {
    return this.value;
  }
}
