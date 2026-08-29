import type { QueueItemResponse } from '../../src/types/index.js';
import { deriveActivityStatus } from '../../src/utils/index.js';
import { generateQueueItemResponseData, generateReviewRef } from '../helpers/index.js';

import { getUniqueDate } from '@couimet/dynamic-testing';
import { beforeEach, describe, expect, it } from '@jest/globals';

describe('deriveActivityStatus', () => {
  let retriggerCommentUrl: string;
  let reviewUrl: string;
  let sourceCommentUrl: string;
  let acknowledgedAtIso: string;

  beforeEach(() => {
    retriggerCommentUrl = generateReviewRef().commentUrl;
    reviewUrl = generateReviewRef().commentUrl;
    sourceCommentUrl = generateReviewRef().commentUrl;
    acknowledgedAtIso = getUniqueDate().toISOString();
  });

  describe('resolved status', () => {
    describe('review_completed resolution', () => {
      let reviewedItem: QueueItemResponse;

      beforeEach(() => {
        reviewedItem = generateQueueItemResponseData({ status: 'resolved', resolution: 'review_completed' });
      });

      it('returns completed analysis with approved subState when review state is approved', () => {
        const item = { ...reviewedItem, coderabbit_review_state: 'review_approved', coderabbit_review_url: reviewUrl } as QueueItemResponse;

        const result = deriveActivityStatus(item);

        expect(result).toStrictEqual({
          state: 'review_completed',
          linkUrl: reviewUrl,
          subState: 'review_approved',
        });
      });

      it('returns completed analysis with changes_suggested subState when review state is review_changes_suggested', () => {
        const item = { ...reviewedItem, coderabbit_review_state: 'review_changes_suggested', coderabbit_review_url: reviewUrl } as QueueItemResponse;

        const result = deriveActivityStatus(item);

        expect(result).toStrictEqual({
          state: 'review_completed',
          linkUrl: reviewUrl,
          subState: 'review_changes_suggested',
        });
      });

      it('returns completed analysis without subState when review state is null', () => {
        const item = { ...reviewedItem, coderabbit_review_state: null, coderabbit_review_url: reviewUrl } as QueueItemResponse;

        const result = deriveActivityStatus(item);

        expect(result).toStrictEqual({
          state: 'review_completed',
          linkUrl: reviewUrl,
        });
      });

      it('returns completed analysis without subState when review state is undefined', () => {
        const item = { ...reviewedItem, coderabbit_review_url: reviewUrl } as QueueItemResponse;

        const result = deriveActivityStatus(item);

        expect(result).toStrictEqual({
          state: 'review_completed',
          linkUrl: reviewUrl,
        });
      });

      it('returns completed analysis with undefined link when review URL is null', () => {
        const item = { ...reviewedItem, coderabbit_review_state: 'review_approved', coderabbit_review_url: null } as QueueItemResponse;

        const result = deriveActivityStatus(item);

        expect(result).toStrictEqual({
          state: 'review_completed',
          linkUrl: undefined,
          subState: 'review_approved',
        });
      });
    });

    it('returns failed state with undefined link for failed resolution', () => {
      const item = generateQueueItemResponseData({ status: 'resolved', resolution: 'failed' });

      const result = deriveActivityStatus(item);

      expect(result).toStrictEqual({ state: 'failed', linkUrl: undefined });
    });

    it('returns pr_merged state with undefined link for pr_merged resolution', () => {
      const item = generateQueueItemResponseData({ status: 'resolved', resolution: 'pr_merged' });

      const result = deriveActivityStatus(item);

      expect(result).toStrictEqual({ state: 'pr_merged', linkUrl: undefined });
    });

    it('returns pr_closed state with undefined link for pr_closed_without_merge resolution', () => {
      const item = generateQueueItemResponseData({ status: 'resolved', resolution: 'pr_closed_without_merge' });

      const result = deriveActivityStatus(item);

      expect(result).toStrictEqual({ state: 'pr_closed', linkUrl: undefined });
    });

    it('returns skipped state with source comment URL for skipped resolution', () => {
      const item = generateQueueItemResponseData({ status: 'resolved', resolution: 'skipped', source_comment_url: sourceCommentUrl });

      const result = deriveActivityStatus(item);

      expect(result).toStrictEqual({ state: 'skipped', linkUrl: sourceCommentUrl });
    });

    it('returns skipped state with undefined link when source_comment_url is absent for skipped resolution', () => {
      const item = generateQueueItemResponseData({ status: 'resolved', resolution: 'skipped', source_comment_url: undefined });

      const result = deriveActivityStatus(item);

      expect(result).toStrictEqual({ state: 'skipped', linkUrl: undefined });
    });

    it('returns manual_review state for manual_review resolution', () => {
      const item = generateQueueItemResponseData({ status: 'resolved', resolution: 'manual_review' });

      const result = deriveActivityStatus(item);

      expect(result).toStrictEqual({ state: 'manual_review', linkUrl: undefined });
    });

    it('returns review_completed state with undefined link when resolution is null (legacy data)', () => {
      const item = generateQueueItemResponseData({ status: 'resolved', resolution: null as unknown as QueueItemResponse['resolution'] });

      const result = deriveActivityStatus(item);

      expect(result).toStrictEqual({ state: 'review_completed', linkUrl: undefined });
    });

    it('throws DetailedError for unrecognized resolution', () => {
      const item = generateQueueItemResponseData({ status: 'resolved', resolution: 'future_resolution' as QueueItemResponse['resolution'] });

      expect(() => deriveActivityStatus(item)).toThrowDetailedError('UNEXPECTED_SWITCH_VALUE', {
        message: 'Unexpected resolution: "future_resolution"',
        functionName: 'resolvedStatus',
        details: { unexpectedValue: 'future_resolution' },
      });
    });
  });

  describe('retriggered status', () => {
    it('returns awaiting_review state when last_coderabbit_acknowledged_at is null', () => {
      const item = generateQueueItemResponseData({
        status: 'retriggered',
        last_coderabbit_acknowledged_at: null,
        retrigger_comment_url: retriggerCommentUrl,
        source_comment_url: undefined,
      });

      const result = deriveActivityStatus(item);

      expect(result).toStrictEqual({
        state: 'awaiting_review',
        linkUrl: retriggerCommentUrl,
      });
    });

    it('returns awaiting_review state with undefined link when retrigger_comment_url is null', () => {
      const item = generateQueueItemResponseData({
        status: 'retriggered',
        last_coderabbit_acknowledged_at: null,
        retrigger_comment_url: null,
        source_comment_url: undefined,
      });

      const result = deriveActivityStatus(item);

      expect(result).toStrictEqual({
        state: 'awaiting_review',
        linkUrl: undefined,
      });
    });

    it('returns review_in_progress state when last_coderabbit_acknowledged_at is present and no source_comment_url', () => {
      const item = generateQueueItemResponseData({
        status: 'retriggered',
        last_coderabbit_acknowledged_at: acknowledgedAtIso,
        source_comment_url: undefined,
        retrigger_comment_url: retriggerCommentUrl,
      });

      const result = deriveActivityStatus(item);

      expect(result).toStrictEqual({
        state: 'review_in_progress',
        linkUrl: retriggerCommentUrl,
      });
    });

    it('returns undefined link when review in progress and retrigger_comment_url is null', () => {
      const item = generateQueueItemResponseData({
        status: 'retriggered',
        last_coderabbit_acknowledged_at: acknowledgedAtIso,
        source_comment_url: undefined,
        retrigger_comment_url: null,
      });

      const result = deriveActivityStatus(item);

      expect(result).toStrictEqual({
        state: 'review_in_progress',
        linkUrl: undefined,
      });
    });

    it('review_limited takes priority over review_in_progress when both ack and source_comment_url exist', () => {
      const item = generateQueueItemResponseData({
        status: 'retriggered',
        last_coderabbit_acknowledged_at: acknowledgedAtIso,
        source_comment_url: sourceCommentUrl,
        retrigger_comment_url: retriggerCommentUrl,
      });

      const result = deriveActivityStatus(item);

      expect(result).toStrictEqual({
        state: 'review_limited',
        linkUrl: sourceCommentUrl,
      });
    });

    it('returns review_limited state when ack is absent but source_comment_url is present', () => {
      const item = generateQueueItemResponseData({
        status: 'retriggered',
        last_coderabbit_acknowledged_at: null,
        source_comment_url: sourceCommentUrl,
        retrigger_comment_url: retriggerCommentUrl,
      });

      const result = deriveActivityStatus(item);

      expect(result).toStrictEqual({
        state: 'review_limited',
        linkUrl: sourceCommentUrl,
      });
    });

    it('returns awaiting_review state when both ack and source_comment_url are absent', () => {
      const item = generateQueueItemResponseData({
        status: 'retriggered',
        last_coderabbit_acknowledged_at: null,
        retrigger_comment_url: retriggerCommentUrl,
        source_comment_url: undefined,
      });

      const result = deriveActivityStatus(item);

      expect(result).toStrictEqual({
        state: 'awaiting_review',
        linkUrl: retriggerCommentUrl,
      });
    });
  });

  describe('pending status', () => {
    it('returns review_limited state when source_comment_url is present', () => {
      const item = generateQueueItemResponseData({ status: 'pending', source_comment_url: sourceCommentUrl });

      const result = deriveActivityStatus(item);

      expect(result).toStrictEqual({
        state: 'review_limited',
        linkUrl: sourceCommentUrl,
      });
    });

    it('falls back to pending state when source_comment_url is absent', () => {
      const item = generateQueueItemResponseData({ status: 'pending', source_comment_url: undefined });

      const result = deriveActivityStatus(item);

      expect(result).toStrictEqual({ state: 'pending', linkUrl: undefined });
    });
  });

  describe('unexpected status', () => {
    it('throws DetailedError for unrecognized status', () => {
      const item = generateQueueItemResponseData({ status: 'unexpected_value' as QueueItemResponse['status'] });

      expect(() => deriveActivityStatus(item)).toThrowDetailedError('UNEXPECTED_SWITCH_VALUE', {
        message: 'Unexpected queue item status: "unexpected_value"',
        functionName: 'deriveActivityStatus',
        details: { unexpectedValue: 'unexpected_value' },
      });
    });
  });
});
