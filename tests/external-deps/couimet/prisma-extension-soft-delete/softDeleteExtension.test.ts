import { softDeleteExtension } from '../../../../src/external-deps/couimet/prisma-extension-soft-delete/src/softDeleteExtension.js';

import { getUniqueString } from '@couimet/dynamic-testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

describe('softDeleteExtension', () => {
  let modelName: string;

  beforeEach(() => {
    modelName = getUniqueString();
  });

  it('returns an object with name "softDelete"', () => {
    const ext = softDeleteExtension({ models: { [modelName]: true } });

    expect(ext.name).toBe('softDelete');
  });

  it('configures query wrappers for each model', () => {
    const ext = softDeleteExtension({ models: { [modelName]: true } });

    expect(ext.query).toHaveProperty(modelName);
    expect(ext.query[modelName]).toHaveProperty('findFirst');
    expect(ext.query[modelName]).toHaveProperty('findMany');
    expect(ext.query[modelName]).toHaveProperty('count');
  });

  it('merges is_deleted: false into args.where', async () => {
    const ext = softDeleteExtension({ models: { [modelName]: true } });
    const args = { where: { comment_id: 42 } };
    const query = jest.fn<any>().mockResolvedValue([{ id: 1 }]);

    await ext.query[modelName].findFirst(args, query);

    expect(args.where).toStrictEqual({ comment_id: 42, is_deleted: false });
    expect(query).toHaveBeenCalledWith(args);
  });

  it('handles undefined args.where', async () => {
    const ext = softDeleteExtension({ models: { [modelName]: true } });
    const args: { where?: Record<string, unknown> } = {};
    const query = jest.fn<any>().mockResolvedValue([]);

    await ext.query[modelName].findMany(args, query);

    expect(args.where).toStrictEqual({ is_deleted: false });
  });

  it('supports custom column names via model config', async () => {
    const ext = softDeleteExtension({
      models: { [modelName]: { isDeletedColumn: 'archived', deletedAtColumn: 'archived_at' } },
    });
    const args = { where: { comment_id: 1 } };
    const query = jest.fn<any>().mockResolvedValue([]);

    await ext.query[modelName].findFirst(args, query);

    expect(args.where).toStrictEqual({ comment_id: 1, archived: false });
  });

  it('supports multiple models', () => {
    const modelB = getUniqueString();
    const ext = softDeleteExtension({ models: { [modelName]: true, [modelB]: true } });

    expect(ext.query).toHaveProperty(modelName);
    expect(ext.query).toHaveProperty(modelB);
  });
});
