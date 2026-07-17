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

  it('exposes a single $allOperations handler', () => {
    const ext = softDeleteExtension({ models: { [modelName]: true } });

    expect(ext.query).toHaveProperty('$allOperations');
    expect(typeof ext.query.$allOperations).toBe('function');
  });

  it('merges is_not_deleted: true into args.where for configured models', async () => {
    const commentId = getUniqueInt();
    const ext = softDeleteExtension({ models: { [modelName]: true } });
    const args = { where: { comment_id: commentId } };
    const query = jest.fn<any>().mockResolvedValue([{ id: 1 }]);

    await ext.query.$allOperations({ model: modelName, operation: 'findFirst', args, query });

    expect(args.where).toStrictEqual({ comment_id: commentId, is_not_deleted: true });
    expect(query).toHaveBeenCalledWith(args);
  });

  it('handles undefined args.where', async () => {
    const ext = softDeleteExtension({ models: { [modelName]: true } });
    const args: { where?: Record<string, unknown> } = {};
    const query = jest.fn<any>().mockResolvedValue([]);

    await ext.query.$allOperations({ model: modelName, operation: 'findMany', args, query });

    expect(args.where).toStrictEqual({ is_not_deleted: true });
  });

  it('supports custom column names via model config', async () => {
    const commentId = getUniqueInt();
    const ext = softDeleteExtension({
      models: { [modelName]: { isNotDeletedColumn: 'archived', deletedAtColumn: 'archived_at' } },
    });
    const args = { where: { comment_id: commentId } };
    const query = jest.fn<any>().mockResolvedValue([]);

    await ext.query.$allOperations({ model: modelName, operation: 'findFirst', args, query });

    expect(args.where).toStrictEqual({ comment_id: commentId, archived: true });
  });

  it('passes through non-configured models unchanged', async () => {
    const ext = softDeleteExtension({ models: { [modelName]: true } });
    const OTHER_MODEL = getUniqueString();
    const args = { where: { comment_id: getUniqueInt() } };
    const query = jest.fn<any>().mockResolvedValue([{ id: 1 }]);

    await ext.query.$allOperations({ model: OTHER_MODEL, operation: 'findFirst', args, query });

    expect(args.where).toStrictEqual({ comment_id: args.where!.comment_id });
    expect(query).toHaveBeenCalledWith(args);
  });

  it('merges is_not_deleted: true into args.where for update', async () => {
    const rowId = getUniqueInt();
    const ext = softDeleteExtension({ models: { [modelName]: true } });
    const args = { where: { id: rowId }, data: { url: getUniqueString() } };
    const query = jest.fn<any>().mockResolvedValue({ id: rowId });

    await ext.query.$allOperations({ model: modelName, operation: 'update', args, query });

    expect(args.where).toStrictEqual({ id: rowId, is_not_deleted: true });
    expect(query).toHaveBeenCalledWith(args);
  });

  it('merges is_not_deleted: true into args.where for updateMany', async () => {
    const commentId = getUniqueInt();
    const ext = softDeleteExtension({ models: { [modelName]: true } });
    const args = { where: { comment_id: commentId }, data: { url: getUniqueString() } };
    const query = jest.fn<any>().mockResolvedValue({ count: 1 });

    await ext.query.$allOperations({ model: modelName, operation: 'updateMany', args, query });

    expect(args.where).toStrictEqual({ comment_id: commentId, is_not_deleted: true });
    expect(query).toHaveBeenCalledWith(args);
  });

  it('does not filter create operations', async () => {
    const ext = softDeleteExtension({ models: { [modelName]: true } });
    const args = { data: { comment_id: getUniqueInt() } };
    const query = jest.fn<any>().mockResolvedValue({ id: 1 });

    await ext.query.$allOperations({ model: modelName, operation: 'create', args, query });

    expect(args).not.toHaveProperty('where');
    expect(query).toHaveBeenCalledWith(args);
  });

  it('passes through when model is undefined', async () => {
    const ext = softDeleteExtension({ models: { [modelName]: true } });
    const args = { where: { comment_id: getUniqueInt() } };
    const query = jest.fn<any>().mockResolvedValue([]);

    await ext.query.$allOperations({ operation: 'findFirst', args, query } as any);

    expect(query).toHaveBeenCalledWith(args);
  });
});
