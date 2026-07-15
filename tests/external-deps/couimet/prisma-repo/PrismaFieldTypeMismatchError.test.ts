import { PrismaFieldTypeMismatchError } from '../../../../src/external-deps/couimet/prisma-repo/PrismaFieldTypeMismatchError.js';

import { getUniqueString } from '@couimet/dynamic-testing';
import { beforeEach, describe, expect, it } from '@jest/globals';

const TABLE_NAME = 'testTable';

describe('PrismaFieldTypeMismatchError', () => {
  let error: PrismaFieldTypeMismatchError;

  beforeEach(() => {
    error = new PrismaFieldTypeMismatchError({ tableName: TABLE_NAME });
  });

  it('extends DetailedError', () => {
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('PrismaFieldTypeMismatchError');
  });

  it('has fixed code PRISMA_FIELD_TYPE_MISMATCH_P2005', () => {
    expect(error.code).toBe('PRISMA_FIELD_TYPE_MISMATCH_P2005');
  });

  it('builds message from tableName', () => {
    expect(error.message).toBe("Field type mismatch in table 'testTable'");
  });

  it('includes tableName in details', () => {
    expect(error.details).toStrictEqual({ tableName: TABLE_NAME });
  });

  it('merges extra details with tableName', () => {
    const extraKey = getUniqueString();
    const extraValue = getUniqueString();
    const err = new PrismaFieldTypeMismatchError({ tableName: TABLE_NAME, details: { [extraKey]: extraValue } });
    expect(err.details).toStrictEqual({ tableName: TABLE_NAME, [extraKey]: extraValue });
  });

  it('sets functionName when provided', () => {
    const fn = getUniqueString();
    const err = new PrismaFieldTypeMismatchError({ tableName: TABLE_NAME, functionName: fn });
    expect(err.functionName).toBe(fn);
  });

  it('passes cause to the native Error chain', () => {
    const cause = new Error('original');
    const err = new PrismaFieldTypeMismatchError({ tableName: TABLE_NAME, cause });
    expect(err.cause).toBe(cause);
  });
});
