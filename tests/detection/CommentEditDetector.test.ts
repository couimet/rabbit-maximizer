import { CommentEditDetector } from '../../src/detection/CommentEditDetector.js';
import { CodeRabbitCommentType } from '../../src/types/CodeRabbitCommentType.js';
import { QueueStatus } from '../../src/types/QueueStatus.js';
import { createMockCoderabbitCommentRepo, createMockCoderabbitGitHubClient, makeCoderabbitCommentRow, makeQueueItem } from '../helpers/index.js';

import { getUniqueDate, getUniqueGitHubRepoRef, getUniqueString, type UniqueRepoRef } from '@couimet/dynamic-testing';
import { beforeEach, describe, expect, it } from '@jest/globals';

describe('CommentEditDetector', () => {
  let mockRepo: ReturnType<typeof createMockCoderabbitCommentRepo>;
  let mockGithub: ReturnType<typeof createMockCoderabbitGitHubClient>;
  let owner: string;
  let repoName: string;

  beforeEach(() => {
    const repo: UniqueRepoRef = getUniqueGitHubRepoRef();
    owner = repo.owner;
    repoName = repo.repo;

    mockRepo = createMockCoderabbitCommentRepo();
    mockGithub = createMockCoderabbitGitHubClient();
  });

  it('returns undefined when no existing comment found', async () => {
    mockRepo.findByCommentId.mockResolvedValue(undefined);
    const detector = new CommentEditDetector(mockRepo, mockGithub);
    const item = makeQueueItem({ status: QueueStatus.retriggered });
    const result = await detector.detect(owner, repoName, item);
    expect(result).toBeUndefined();
  });

  it('returns wasEdited false when timestamp unchanged', async () => {
    const sameDate = getUniqueDate();
    const existing = makeCoderabbitCommentRow({ gh_updated_at: sameDate });
    mockRepo.findByCommentId.mockResolvedValue(existing);
    mockGithub.fetchComment.mockResolvedValue({ body: getUniqueString(), updatedAt: sameDate.toISOString() });
    const detector = new CommentEditDetector(mockRepo, mockGithub);
    const item = makeQueueItem({ status: QueueStatus.retriggered, source_comment_id: existing.comment_id });
    const result = await detector.detect(owner, repoName, item);
    expect(result).toStrictEqual({ wasEdited: false, newClassification: existing.comment_type, updatedCommentRow: existing });
  });

  it('returns wasEdited false when timestamp is older', async () => {
    const existingDate = getUniqueDate();
    const fetchedDate = new Date(existingDate.getTime() - 1);
    const existing = makeCoderabbitCommentRow({ gh_updated_at: existingDate });
    mockRepo.findByCommentId.mockResolvedValue(existing);
    mockGithub.fetchComment.mockResolvedValue({ body: getUniqueString(), updatedAt: fetchedDate.toISOString() });
    const detector = new CommentEditDetector(mockRepo, mockGithub);
    const item = makeQueueItem({ status: QueueStatus.retriggered, source_comment_id: existing.comment_id });
    const result = await detector.detect(owner, repoName, item);
    expect(result!.wasEdited).toBe(false);
  });

  it('detects edit and returns new classification', async () => {
    const existingDate = getUniqueDate();
    const fetchedDate = new Date(existingDate.getTime() + 1);
    const existing = makeCoderabbitCommentRow({ gh_updated_at: existingDate });
    mockRepo.findByCommentId.mockResolvedValue(existing);
    const updatedBody = 'Actionable comments posted: 3';
    mockGithub.fetchComment.mockResolvedValue({ body: updatedBody, updatedAt: fetchedDate.toISOString() });
    const upsertedRow = makeCoderabbitCommentRow({ comment_type: CodeRabbitCommentType.review_changes_suggested, gh_updated_at: fetchedDate });
    mockRepo.upsert.mockResolvedValue(upsertedRow);
    const detector = new CommentEditDetector(mockRepo, mockGithub);
    const item = makeQueueItem({ status: QueueStatus.retriggered, source_comment_id: existing.comment_id, pull_request_id: existing.pull_request_id });
    const result = await detector.detect(owner, repoName, item);
    expect(result).toStrictEqual({ wasEdited: true, newClassification: CodeRabbitCommentType.review_changes_suggested, updatedCommentRow: upsertedRow });
  });

  it('throws when fetchComment fails', async () => {
    const existing = makeCoderabbitCommentRow();
    mockRepo.findByCommentId.mockResolvedValue(existing);
    const fetchError = new Error(getUniqueString());
    mockGithub.fetchComment.mockRejectedValue(fetchError);
    const detector = new CommentEditDetector(mockRepo, mockGithub);
    const item = makeQueueItem({ status: QueueStatus.retriggered, source_comment_id: existing.comment_id });
    await expect(detector.detect(owner, repoName, item)).rejects.toThrow(fetchError.message);
  });
});
