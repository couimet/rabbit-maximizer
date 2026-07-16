import { PrismaErrorCodes } from '../../../../src/external-deps/couimet/prisma-repo/PrismaErrorCodes.js';
import { PrismaRecordNotFoundError } from '../../../../src/external-deps/couimet/prisma-repo/PrismaRecordNotFoundError.js';

import { getUniqueString } from '@couimet/dynamic-testing';
import { beforeEach, describe, expect, it } from '@jest/globals';

const TABLE_NAME = 'testTable';

describe('PrismaRecordNotFoundError', () => {
  let error: PrismaRecordNotFoundError;

  beforeEach(() => {
    error = new PrismaRecordNotFoundError({ tableName: TABLE_NAME });
  });

  it('extends DetailedError', () => {
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('PrismaRecordNotFoundError');
  });

  it('has fixed code PRISMA_RECORD_NOT_FOUND_P2025', () => {
    expect(error.code).toBe(PrismaErrorCodes.PRISMA_RECORD_NOT_FOUND_P2025);
  });

  it('builds message from tableName', () => {
    expect(error.message).toBe("Record not found in table 'testTable'");
  });

  it('includes tableName in details', () => {
    expect(error.details).toStrictEqual({ tableName: TABLE_NAME });
  });

  it('merges extra details with tableName', () => {
    const extraKey = getUniqueString();
    const extraValue = getUniqueString();
    const err = new PrismaRecordNotFoundError({ tableName: TABLE_NAME, details: { [extraKey]: extraValue } });
    expect(err.details).toStrictEqual({ tableName: TABLE_NAME, [extraKey]: extraValue });
  });

  it('sets functionName when provided', () => {
    const fn = getUniqueString();
    const err = new PrismaRecordNotFoundError({ tableName: TABLE_NAME, functionName: fn });
    expect(err.functionName).toBe(fn);
  });

  it('passes cause to the native Error chain', () => {
    const cause = new Error('original');
    const err = new PrismaRecordNotFoundError({ tableName: TABLE_NAME, cause });
    expect(err.cause).toBe(cause);
  });
});
