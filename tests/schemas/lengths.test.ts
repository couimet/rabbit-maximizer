import {
  BODY_PREVIEW_MAX_LENGTH,
  COMMENT_URL_MAX_LENGTH,
  CORRELATION_ID_MAX_LENGTH,
  EVENT_TYPE_MAX_LENGTH,
  METADATA_MAX_LENGTH,
  PAYLOAD_MAX_LENGTH,
  REASON_MAX_LENGTH,
  REPO_FULL_NAME_MAX_LENGTH,
  REQUEST_ID_MAX_LENGTH,
  REVIEW_STATE_MAX_LENGTH,
  REVIEW_URL_MAX_LENGTH,
  SOURCE_COMMENT_URL_MAX_LENGTH,
  STATUS_MAX_LENGTH,
  UUID_MAX_LENGTH,
  VERSION_MAX_LENGTH,
} from '../../src/schemas/index.js';

import { describe, expect, it } from '@jest/globals';

describe('lengths', () => {
  describe('REVIEW_URL_MAX_LENGTH', () => {
    it('is 512, same as COMMENT_URL_MAX_LENGTH', () => {
      expect(REVIEW_URL_MAX_LENGTH).toBe(512);
      expect(REVIEW_URL_MAX_LENGTH).toBe(COMMENT_URL_MAX_LENGTH);
    });

    it('fits a realistic GitHub review URL', () => {
      const url = 'https://github.com/some-org/some-repo/pull/123456#pullrequestreview-987654321';
      expect(url.length).toBeLessThanOrEqual(REVIEW_URL_MAX_LENGTH);
    });
  });

  describe('REVIEW_STATE_MAX_LENGTH', () => {
    it('is 25, same as STATUS_MAX_LENGTH', () => {
      expect(REVIEW_STATE_MAX_LENGTH).toBe(25);
      expect(REVIEW_STATE_MAX_LENGTH).toBe(STATUS_MAX_LENGTH);
    });

    it('fits both valid review states', () => {
      expect('approved'.length).toBeLessThanOrEqual(REVIEW_STATE_MAX_LENGTH);
      expect('changes_suggested'.length).toBeLessThanOrEqual(REVIEW_STATE_MAX_LENGTH);
    });
  });

  describe('SOURCE_COMMENT_URL_MAX_LENGTH', () => {
    it('is 512, same as COMMENT_URL_MAX_LENGTH', () => {
      expect(SOURCE_COMMENT_URL_MAX_LENGTH).toBe(512);
      expect(SOURCE_COMMENT_URL_MAX_LENGTH).toBe(COMMENT_URL_MAX_LENGTH);
    });
  });

  describe('column limits', () => {
    it('UUID_MAX_LENGTH is 36', () => {
      expect(UUID_MAX_LENGTH).toBe(36);
    });

    it('STATUS_MAX_LENGTH is 25', () => {
      expect(STATUS_MAX_LENGTH).toBe(25);
    });

    it('EVENT_TYPE_MAX_LENGTH is 25', () => {
      expect(EVENT_TYPE_MAX_LENGTH).toBe(25);
    });

    it('CORRELATION_ID_MAX_LENGTH is 73', () => {
      expect(CORRELATION_ID_MAX_LENGTH).toBe(73);
    });

    it('REQUEST_ID_MAX_LENGTH is 73', () => {
      expect(REQUEST_ID_MAX_LENGTH).toBe(73);
    });

    it('VERSION_MAX_LENGTH is 32', () => {
      expect(VERSION_MAX_LENGTH).toBe(32);
    });

    it('PAYLOAD_MAX_LENGTH is 16384', () => {
      expect(PAYLOAD_MAX_LENGTH).toBe(16384);
    });

    it('METADATA_MAX_LENGTH is 2048', () => {
      expect(METADATA_MAX_LENGTH).toBe(2048);
    });

    it('REPO_FULL_NAME_MAX_LENGTH is 140', () => {
      expect(REPO_FULL_NAME_MAX_LENGTH).toBe(140);
    });

    it('BODY_PREVIEW_MAX_LENGTH is 1024', () => {
      expect(BODY_PREVIEW_MAX_LENGTH).toBe(1024);
    });
  });

  describe('payload-field limits', () => {
    it('COMMENT_URL_MAX_LENGTH is 512', () => {
      expect(COMMENT_URL_MAX_LENGTH).toBe(512);
    });

    it('REASON_MAX_LENGTH is 1024', () => {
      expect(REASON_MAX_LENGTH).toBe(1024);
    });
  });
});
