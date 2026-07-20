import type { CoderabbitCommentRepository } from '../../src/db/coderabbitCommentRepository.js';
import { ReviewCompletionGuard } from '../../src/detection/ReviewCompletionGuard.js';
import { CodeRabbitCommentType } from '../../src/types/CodeRabbitCommentType.js';
import { makeCoderabbitCommentRow } from '../helpers/makeCoderabbitCommentRow.js';

import { getUniqueInt } from '@couimet/dynamic-testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

describe('ReviewCompletionGuard', () => {
  let mockRepo: jest.Mocked<CoderabbitCommentRepository>;

  beforeEach(() => {
    mockRepo = {
      upsert: jest.fn<any>(),
      deactivate: jest.fn<any>(),
      findByCommentId: jest.fn<any>(),
      findByPr: jest.fn<any>(),
      findActiveByType: jest.fn<any>(),
    } as unknown as jest.Mocked<CoderabbitCommentRepository>;
  });

  it('returns false when no completed review exists', async () => {
    mockRepo.findActiveByType.mockResolvedValue(undefined);
    const guard = new ReviewCompletionGuard(mockRepo);
    const result = await guard.hasCompletedReview(getUniqueInt());
    expect(result).toBe(false);
  });

  it('returns true when review_approved exists', async () => {
    const row = makeCoderabbitCommentRow({ comment_type: CodeRabbitCommentType.review_approved });
    mockRepo.findActiveByType.mockResolvedValueOnce(row).mockResolvedValueOnce(undefined);
    const guard = new ReviewCompletionGuard(mockRepo);
    const result = await guard.hasCompletedReview(getUniqueInt());
    expect(result).toBe(true);
  });

  it('returns true when review_changes_suggested exists but approved does not', async () => {
    const row = makeCoderabbitCommentRow({ comment_type: CodeRabbitCommentType.review_changes_suggested });
    mockRepo.findActiveByType.mockResolvedValueOnce(undefined).mockResolvedValueOnce(row);
    const guard = new ReviewCompletionGuard(mockRepo);
    const result = await guard.hasCompletedReview(getUniqueInt());
    expect(result).toBe(true);
  });

  it('passes tx through to repository', async () => {
    const PULL_REQUEST_ID = getUniqueInt();
    mockRepo.findActiveByType.mockResolvedValue(undefined);
    const guard = new ReviewCompletionGuard(mockRepo);
    const tx = {} as any;
    await guard.hasCompletedReview(PULL_REQUEST_ID, tx);
    expect(mockRepo.findActiveByType).toHaveBeenCalledWith(PULL_REQUEST_ID, CodeRabbitCommentType.review_approved, tx);
  });
});
