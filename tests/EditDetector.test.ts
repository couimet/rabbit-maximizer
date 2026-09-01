import { EditDetectorImpl } from '../src/EditDetector.js';

import { createMockCoderabbitCommentRepo, createMockCoderabbitGitHubClient, generateQueueItemHydrationData, generateReviewRef } from './helpers/index.js';

import { getUniqueDate, getUniqueInt, getUuid } from '@couimet/dynamic-testing';
import { describe, expect, it } from '@jest/globals';

const ONE_MINUTE_MS = 60_000;

describe('EditDetector', () => {
  it('returns fallback when no matching coderabbit comment exists', async () => {
    const comments = createMockCoderabbitCommentRepo();
    const github = createMockCoderabbitGitHubClient();
    const commentId = getUniqueInt();
    const item = generateQueueItemHydrationData({ source_comment_id: commentId });

    comments.findByCommentId.mockResolvedValue(undefined);

    const detector = new EditDetectorImpl(comments, github);
    const result = await detector.detectEdit(item);

    expect(result).toBeSuccess({ action: 'fallback', reason: 'not_found', sourceCommentType: undefined });
    expect(comments.findByCommentId).toHaveBeenCalledWith(item.pull_request_id, commentId);
    expect(github.fetchComment).not.toHaveBeenCalled();
  });

  it('returns fallback when comment has not been edited', async () => {
    const comments = createMockCoderabbitCommentRepo();
    const github = createMockCoderabbitGitHubClient();
    const commentId = getUniqueInt();
    const item = generateQueueItemHydrationData({ source_comment_id: commentId });
    const lastSeenAt = getUniqueDate();

    comments.findByCommentId.mockResolvedValue({
      comment_id: commentId,
      comment_type: 'review_skipped',
      gh_updated_at: new Date(lastSeenAt.getTime() - ONE_MINUTE_MS),
      last_seen_at: lastSeenAt,
      is_not_deleted: true,
    } as any);
    // Fresh fetch returns an updatedAt <= last_seen_at, so the NotEdited guard fires
    github.fetchComment.mockResolvedValue({ body: '', createdAt: lastSeenAt.toISOString(), updatedAt: lastSeenAt.toISOString() });

    const detector = new EditDetectorImpl(comments, github);
    const result = await detector.detectEdit(item);

    expect(result).toBeSuccess({ action: 'fallback', reason: 'not_edited', sourceCommentType: 'review_skipped' });
    expect(github.fetchComment).toHaveBeenCalled();
  });

  it('returns resolved when edited comment re-classifies as review_approved', async () => {
    const comments = createMockCoderabbitCommentRepo();
    const github = createMockCoderabbitGitHubClient();
    const ref = generateReviewRef();
    const commentId = getUniqueInt();
    const item = generateQueueItemHydrationData({ source_comment_id: commentId, repo_full_name: ref.repoFullName });
    const ghCreatedAt = getUniqueDate();
    const lastSeenAt = getUniqueDate();
    const ghUpdatedAt = new Date(lastSeenAt.getTime() + ONE_MINUTE_MS);
    const fetchBody = 'No actionable comments were generated in the recent review.';

    comments.findByCommentId.mockResolvedValue({
      comment_id: commentId,
      url: ref.commentUrl,
      gh_created_at: ghCreatedAt,
      gh_updated_at: ghUpdatedAt,
      last_seen_at: lastSeenAt,
      is_not_deleted: true,
    } as any);
    github.fetchComment.mockResolvedValue({ body: fetchBody, createdAt: ghUpdatedAt.toISOString(), updatedAt: ghUpdatedAt.toISOString() });

    const detector = new EditDetectorImpl(comments, github);
    const result = await detector.detectEdit(item);

    expect(result).toBeSuccess({
      action: 'resolved',
      reviewUrl: ref.commentUrl,
      verdictState: 'review_approved',
    });
    expect(comments.findByCommentId).toHaveBeenCalledWith(item.pull_request_id, commentId);
    expect(github.fetchComment).toHaveBeenCalledWith(ref.owner, ref.repo, commentId);
    expect(comments.upsert).toHaveBeenCalledWith({
      comment_id: commentId,
      pull_request_id: item.pull_request_id,
      url: ref.commentUrl,
      comment_type: 'review_approved',
      body: fetchBody,
      gh_created_at: ghCreatedAt,
      gh_updated_at: ghUpdatedAt,
      coderabbit_run_id: null,
    });
  });

  it('returns resolved when edited comment re-classifies as review_changes_suggested', async () => {
    const comments = createMockCoderabbitCommentRepo();
    const github = createMockCoderabbitGitHubClient();
    const ref = generateReviewRef();
    const commentId = getUniqueInt();
    const item = generateQueueItemHydrationData({ source_comment_id: commentId, repo_full_name: ref.repoFullName });
    const ghCreatedAt = getUniqueDate();
    const lastSeenAt = getUniqueDate();
    const ghUpdatedAt = new Date(lastSeenAt.getTime() + ONE_MINUTE_MS);
    const fetchBody = 'Actionable comments posted: 0';

    comments.findByCommentId.mockResolvedValue({
      comment_id: commentId,
      url: ref.commentUrl,
      gh_created_at: ghCreatedAt,
      gh_updated_at: ghUpdatedAt,
      last_seen_at: lastSeenAt,
      is_not_deleted: true,
    } as any);
    github.fetchComment.mockResolvedValue({ body: fetchBody, createdAt: ghUpdatedAt.toISOString(), updatedAt: ghUpdatedAt.toISOString() });

    const detector = new EditDetectorImpl(comments, github);
    const result = await detector.detectEdit(item);

    expect(result).toBeSuccess({
      action: 'resolved',
      reviewUrl: ref.commentUrl,
      verdictState: 'review_changes_suggested',
    });
    expect(comments.findByCommentId).toHaveBeenCalledWith(item.pull_request_id, commentId);
    expect(comments.upsert).toHaveBeenCalledWith({
      comment_id: commentId,
      pull_request_id: item.pull_request_id,
      url: ref.commentUrl,
      comment_type: 'review_changes_suggested',
      body: fetchBody,
      gh_created_at: ghCreatedAt,
      gh_updated_at: ghUpdatedAt,
      coderabbit_run_id: null,
    });
  });

  it('upserts timestamps and returns fallback when edited comment is still rate-limited', async () => {
    const comments = createMockCoderabbitCommentRepo();
    const github = createMockCoderabbitGitHubClient();
    const ref = generateReviewRef();
    const commentId = getUniqueInt();
    const item = generateQueueItemHydrationData({ source_comment_id: commentId, repo_full_name: ref.repoFullName });
    const ghCreatedAt = getUniqueDate();
    const lastSeenAt = getUniqueDate();
    const ghUpdatedAt = new Date(lastSeenAt.getTime() + ONE_MINUTE_MS);
    const fetchBody = 'rate limited by coderabbit.ai';

    comments.findByCommentId.mockResolvedValue({
      comment_id: commentId,
      comment_type: 'review_skipped',
      url: ref.commentUrl,
      gh_created_at: ghCreatedAt,
      gh_updated_at: ghUpdatedAt,
      last_seen_at: lastSeenAt,
      is_not_deleted: true,
    } as any);
    github.fetchComment.mockResolvedValue({ body: fetchBody, createdAt: ghUpdatedAt.toISOString(), updatedAt: ghUpdatedAt.toISOString() });

    const detector = new EditDetectorImpl(comments, github);
    const result = await detector.detectEdit(item);

    expect(result).toBeSuccess({ action: 'fallback', reason: 'not_a_review', sourceCommentType: 'review_skipped' });
    expect(comments.upsert).toHaveBeenCalledWith({
      comment_id: commentId,
      pull_request_id: item.pull_request_id,
      url: ref.commentUrl,
      comment_type: 'review_limited',
      body: fetchBody,
      gh_created_at: ghCreatedAt,
      gh_updated_at: ghUpdatedAt,
      coderabbit_run_id: null,
    });
  });

  it('returns error result when fetchComment throws', async () => {
    const comments = createMockCoderabbitCommentRepo();
    const github = createMockCoderabbitGitHubClient();
    const ref = generateReviewRef();
    const commentId = getUniqueInt();
    const item = generateQueueItemHydrationData({ source_comment_id: commentId, repo_full_name: ref.repoFullName });
    const lastSeenAt = getUniqueDate();
    const ghUpdatedAt = new Date(lastSeenAt.getTime() + ONE_MINUTE_MS);

    comments.findByCommentId.mockResolvedValue({
      comment_id: commentId,
      gh_updated_at: ghUpdatedAt,
      last_seen_at: lastSeenAt,
      is_not_deleted: true,
    } as any);
    const fetchError = new Error('GitHub API error');
    github.fetchComment.mockRejectedValue(fetchError);

    const detector = new EditDetectorImpl(comments, github);
    const result = await detector.detectEdit(item);

    expect(result).toHaveDetailedError('EDIT_DETECTION_FAILED', {
      message: 'Edit detection failed',
      functionName: 'EditDetectorImpl.detectEdit',
      details: {
        queueItemId: item.id,
        sourceCommentId: item.source_comment_id,
        error: { message: fetchError.message, name: fetchError.name, stack: fetchError.stack },
      },
    });
  });

  it('returns adopted when re-edited skip comment carries a new run id', async () => {
    const comments = createMockCoderabbitCommentRepo();
    const github = createMockCoderabbitGitHubClient();
    const ref = generateReviewRef();
    const commentId = getUniqueInt();
    const item = generateQueueItemHydrationData({ source_comment_id: commentId, repo_full_name: ref.repoFullName });
    const ghCreatedAt = getUniqueDate();
    const lastSeenAt = getUniqueDate();
    const ghUpdatedAt = new Date(lastSeenAt.getTime() + ONE_MINUTE_MS);
    const storedRunId = getUuid();
    const coderabbitRunId = getUuid();
    const fetchBody = `skip review by coderabbit.ai\n\n**Run ID**: \`${coderabbitRunId}\``;

    comments.findByCommentId.mockResolvedValue({
      comment_id: commentId,
      url: ref.commentUrl,
      gh_created_at: ghCreatedAt,
      gh_updated_at: ghUpdatedAt,
      last_seen_at: lastSeenAt,
      coderabbit_run_id: storedRunId,
      is_not_deleted: true,
    } as any);
    github.fetchComment.mockResolvedValue({ body: fetchBody, createdAt: ghUpdatedAt.toISOString(), updatedAt: ghUpdatedAt.toISOString() });

    const detector = new EditDetectorImpl(comments, github);
    const result = await detector.detectEdit(item);

    expect(result).toBeSuccess({ action: 'adopted', runId: coderabbitRunId });
    expect(comments.findByCommentId).toHaveBeenCalledWith(item.pull_request_id, commentId);
    expect(github.fetchComment).toHaveBeenCalledWith(ref.owner, ref.repo, commentId);
    expect(comments.upsert).toHaveBeenCalledWith({
      comment_id: commentId,
      pull_request_id: item.pull_request_id,
      url: ref.commentUrl,
      comment_type: 'review_skipped',
      body: fetchBody,
      gh_created_at: ghCreatedAt,
      gh_updated_at: ghUpdatedAt,
      coderabbit_run_id: coderabbitRunId,
    });
  });

  it('returns skipped when re-edited skip comment run is unchanged', async () => {
    const comments = createMockCoderabbitCommentRepo();
    const github = createMockCoderabbitGitHubClient();
    const ref = generateReviewRef();
    const commentId = getUniqueInt();
    const item = generateQueueItemHydrationData({ source_comment_id: commentId, repo_full_name: ref.repoFullName });
    const ghCreatedAt = getUniqueDate();
    const lastSeenAt = getUniqueDate();
    const ghUpdatedAt = new Date(lastSeenAt.getTime() + ONE_MINUTE_MS);
    const coderabbitRunId = getUuid();
    const fetchBody = `skip review by coderabbit.ai\n\n**Run ID**: \`${coderabbitRunId}\``;

    comments.findByCommentId.mockResolvedValue({
      comment_id: commentId,
      url: ref.commentUrl,
      gh_created_at: ghCreatedAt,
      gh_updated_at: ghUpdatedAt,
      last_seen_at: lastSeenAt,
      coderabbit_run_id: coderabbitRunId,
      is_not_deleted: true,
    } as any);
    github.fetchComment.mockResolvedValue({ body: fetchBody, createdAt: ghUpdatedAt.toISOString(), updatedAt: ghUpdatedAt.toISOString() });

    const detector = new EditDetectorImpl(comments, github);
    const result = await detector.detectEdit(item);

    expect(result).toBeSuccess({ action: 'skipped', reviewUrl: ref.commentUrl });
    expect(comments.findByCommentId).toHaveBeenCalledWith(item.pull_request_id, commentId);
    expect(github.fetchComment).toHaveBeenCalledWith(ref.owner, ref.repo, commentId);
    expect(comments.upsert).toHaveBeenCalledWith({
      comment_id: commentId,
      pull_request_id: item.pull_request_id,
      url: ref.commentUrl,
      comment_type: 'review_skipped',
      body: fetchBody,
      gh_created_at: ghCreatedAt,
      gh_updated_at: ghUpdatedAt,
      coderabbit_run_id: coderabbitRunId,
    });
  });

  it('returns skipped when re-edited skip comment run is cleared', async () => {
    const comments = createMockCoderabbitCommentRepo();
    const github = createMockCoderabbitGitHubClient();
    const ref = generateReviewRef();
    const commentId = getUniqueInt();
    const item = generateQueueItemHydrationData({ source_comment_id: commentId, repo_full_name: ref.repoFullName });
    const ghCreatedAt = getUniqueDate();
    const lastSeenAt = getUniqueDate();
    const ghUpdatedAt = new Date(lastSeenAt.getTime() + ONE_MINUTE_MS);
    const storedRunId = getUuid();
    const fetchBody = 'skip review by coderabbit.ai';

    comments.findByCommentId.mockResolvedValue({
      comment_id: commentId,
      url: ref.commentUrl,
      gh_created_at: ghCreatedAt,
      gh_updated_at: ghUpdatedAt,
      last_seen_at: lastSeenAt,
      coderabbit_run_id: storedRunId,
      is_not_deleted: true,
    } as any);
    github.fetchComment.mockResolvedValue({ body: fetchBody, createdAt: ghUpdatedAt.toISOString(), updatedAt: ghUpdatedAt.toISOString() });

    const detector = new EditDetectorImpl(comments, github);
    const result = await detector.detectEdit(item);

    expect(result).toBeSuccess({ action: 'skipped', reviewUrl: ref.commentUrl });
    expect(comments.findByCommentId).toHaveBeenCalledWith(item.pull_request_id, commentId);
    expect(github.fetchComment).toHaveBeenCalledWith(ref.owner, ref.repo, commentId);
    expect(comments.upsert).toHaveBeenCalledWith({
      comment_id: commentId,
      pull_request_id: item.pull_request_id,
      url: ref.commentUrl,
      comment_type: 'review_skipped',
      body: fetchBody,
      gh_created_at: ghCreatedAt,
      gh_updated_at: ghUpdatedAt,
      coderabbit_run_id: null,
    });
  });
});
