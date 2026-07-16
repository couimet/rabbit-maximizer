import { softDeleteExtension } from '../../../../src/external-deps/couimet/prisma-extension-soft-delete/src/softDeleteExtension.js';

import { getUniqueInt, getUniqueString } from '@couimet/dynamic-testing';
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

  it('merges is_not_deleted: true into args.where', async () => {
    const commentId = getUniqueInt();
    const ext = softDeleteExtension({ models: { [modelName]: true } });
    const args = { where: { comment_id: commentId } };
    const query = jest.fn<any>().mockResolvedValue([{ id: 1 }]);

    await ext.query[modelName].findFirst(args, query);

    expect(args.where).toStrictEqual({ comment_id: commentId, is_not_deleted: true });
    expect(query).toHaveBeenCalledWith(args);
  });

  it('handles undefined args.where', async () => {
    const ext = softDeleteExtension({ models: { [modelName]: true } });
    const args: { where?: Record<string, unknown> } = {};
    const query = jest.fn<any>().mockResolvedValue([]);

    await ext.query[modelName].findMany(args, query);

    expect(args.where).toStrictEqual({ is_not_deleted: true });
  });

  it('supports custom column names via model config', async () => {
    const commentId = getUniqueInt();
    const ext = softDeleteExtension({
      models: { [modelName]: { isNotDeletedColumn: 'archived', deletedAtColumn: 'archived_at' } },
    });
    const args = { where: { comment_id: commentId } };
    const query = jest.fn<any>().mockResolvedValue([]);

    await ext.query[modelName].findFirst(args, query);

    expect(args.where).toStrictEqual({ comment_id: commentId, archived: true });
  });

  it('supports multiple models', () => {
    const modelB = getUniqueString();
    const ext = softDeleteExtension({ models: { [modelName]: true, [modelB]: true } });

    expect(ext.query).toHaveProperty(modelName);
    expect(ext.query).toHaveProperty(modelB);
  });
});
