import type { CoderabbitGitHubClient } from '../src/github/coderabbitGitHubClient.js';
import { ProbeFactory } from '../src/probes/ProbeFactory.js';
import { ReviewTrigger } from '../src/ReviewTrigger.js';
import { QueueStatus, TriggerSource } from '../src/types/index.js';

import { getUniqueDate, getUniqueInt, getUniqueString } from '@couimet/dynamic-testing';
import { createMockLogger } from '@couimet/logger-contract-testing';
import { describe, expect, it, jest } from '@jest/globals';
import type { Prisma, PrismaClient } from '@prisma/client';

const POST_COOLDOWN_SEC = 3600;
const COMMENT_URL = 'https://gh/c/retriggered';
const STALE_COMMENT_ID = 123;
const NEW_COMMENT_ID = 456;
const NEW_COMMENT_URL = 'https://gh/c/new-comment';

const makeItem = () => ({
  id: getUniqueInt(),
  uuid: getUniqueString({ prefix: 'uuid-' }),
  repo_full_name: `${getUniqueString({ prefix: 'o' })}/${getUniqueString({ prefix: 'r' })}`,
  pr_number: getUniqueInt(),
  status: QueueStatus.pending,
  not_before: getUniqueDate(),
  attempts: 0,
  pr_title: getUniqueString({ prefix: 'PR title ' }),
  source_comment_url: getUniqueString({ prefix: 'https://gh/c/' }),
  source_comment_id: STALE_COMMENT_ID,
  trigger_source: TriggerSource.scheduler,
  created_at: getUniqueDate(),
  updated_at: getUniqueDate(),
});

const setup = () => {
  const github = {
    fetchComment: jest.fn(),
    findLatestReviewLimitComment: jest.fn(),
    postRetrigger: jest.fn(),
  } as unknown as jest.Mocked<CoderabbitGitHubClient>;
  const probeFactory = { createReviewRetriggerProbe: jest.fn() } as unknown as jest.Mocked<ProbeFactory>;
  const queue = {} as any;
  const tx = {} as Prisma.TransactionClient;
  const prisma = { $transaction: jest.fn<any>().mockImplementation((fn: any) => fn(tx)) } as unknown as PrismaClient;
  const logger = createMockLogger();
  const cfg = { SCHEDULER_POST_COOLDOWN: POST_COOLDOWN_SEC, REVIEW_LIMIT_FALLBACK_WAIT_SECONDS: 3600, REVIEW_LIMIT_BUFFER_SECONDS: 60 } as any;

  const reviewTrigger = new ReviewTrigger(github, probeFactory, queue, prisma, cfg, logger);

  return { github, probeFactory, prisma, tx, logger, reviewTrigger };
};

describe('ReviewTrigger', () => {
  it('returns ok with retriggeredCommentUrl when source comment is valid', async () => {
    const { github, probeFactory, reviewTrigger } = setup();
    const item = makeItem();
    github.fetchComment.mockResolvedValue('rate limited by coderabbit.ai');
    github.postRetrigger.mockResolvedValue({ htmlUrl: COMMENT_URL });
    const probe = {
      reviewRetriggered: jest.fn(),
      staleCommentRescheduled: jest.fn(),
      staleCommentSkipped: jest.fn(),
      staleCommentReplacementDeleted: jest.fn(),
    };
    probeFactory.createReviewRetriggerProbe.mockReturnValue(probe as any);

    const result = await reviewTrigger.trigger(item, TriggerSource.dashboard_retrigger_now);

    expect(result.success).toBe(true);
    expect(result.value).toStrictEqual({ retriggeredCommentUrl: COMMENT_URL });
  });

  it('returns err with RETRIGGER_STALE_COMMENT_SKIP when no replacement found', async () => {
    const { github, probeFactory, reviewTrigger } = setup();
    const item = makeItem();
    github.fetchComment.mockResolvedValue('stale body without rate-limit marker');
    github.findLatestReviewLimitComment.mockResolvedValue(undefined);
    const probe = {
      reviewRetriggered: jest.fn(),
      staleCommentRescheduled: jest.fn(),
      staleCommentSkipped: jest.fn(),
      staleCommentReplacementDeleted: jest.fn(),
    };
    probeFactory.createReviewRetriggerProbe.mockReturnValue(probe as any);

    const result = await reviewTrigger.trigger(item, TriggerSource.scheduler);

    expect(result.success).toBe(false);
    expect(probe.staleCommentSkipped).toHaveBeenCalled();
    expect(result.error.code).toBe('RETRIGGER_STALE_COMMENT_SKIP');
  });

  it('returns err with RETRIGGER_STALE_COMMENT_REPLACEMENT_DELETED when replacement is deleted', async () => {
    const { github, probeFactory, reviewTrigger } = setup();
    const item = makeItem();
    github.fetchComment.mockResolvedValueOnce('stale body');
    github.findLatestReviewLimitComment.mockResolvedValue({
      comment_id: NEW_COMMENT_ID,
      url: NEW_COMMENT_URL,
      repo_full_name: 'o/r',
      pr_number: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    github.fetchComment.mockRejectedValueOnce({ status: 404 });
    const probe = {
      reviewRetriggered: jest.fn(),
      staleCommentRescheduled: jest.fn(),
      staleCommentSkipped: jest.fn(),
      staleCommentReplacementDeleted: jest.fn(),
    };
    probeFactory.createReviewRetriggerProbe.mockReturnValue(probe as any);

    const result = await reviewTrigger.trigger(item, TriggerSource.scheduler);

    expect(result.success).toBe(false);
    expect(probe.staleCommentReplacementDeleted).toHaveBeenCalledWith(NEW_COMMENT_ID);
    expect(result.error.code).toBe('RETRIGGER_STALE_COMMENT_REPLACEMENT_DELETED');
  });

  it('returns err with RETRIGGER_STALE_COMMENT_RESCHEDULE when source comment was replaced', async () => {
    const { github, probeFactory, reviewTrigger } = setup();
    const item = makeItem();
    github.fetchComment.mockResolvedValueOnce('stale body');
    github.findLatestReviewLimitComment.mockResolvedValue({
      comment_id: NEW_COMMENT_ID,
      url: NEW_COMMENT_URL,
      repo_full_name: 'o/r',
      pr_number: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    github.fetchComment.mockResolvedValueOnce('[rate limit](...) wait 3600 seconds');
    const probe = {
      reviewRetriggered: jest.fn(),
      staleCommentRescheduled: jest.fn(),
      staleCommentSkipped: jest.fn(),
      staleCommentReplacementDeleted: jest.fn(),
    };
    probeFactory.createReviewRetriggerProbe.mockReturnValue(probe as any);

    const result = await reviewTrigger.trigger(item, TriggerSource.scheduler);

    expect(result.success).toBe(false);
    expect(probe.staleCommentRescheduled).toHaveBeenCalledWith(expect.any(Date));
    expect(result.error.code).toBe('RETRIGGER_STALE_COMMENT_RESCHEDULE');
  });

  it('returns err when stored comment was deleted (404)', async () => {
    const { github, probeFactory, reviewTrigger } = setup();
    const item = makeItem();
    github.fetchComment.mockRejectedValueOnce({ status: 404 });
    github.findLatestReviewLimitComment.mockResolvedValue(undefined);
    const probe = {
      reviewRetriggered: jest.fn(),
      staleCommentRescheduled: jest.fn(),
      staleCommentSkipped: jest.fn(),
      staleCommentReplacementDeleted: jest.fn(),
    };
    probeFactory.createReviewRetriggerProbe.mockReturnValue(probe as any);

    const result = await reviewTrigger.trigger(item, TriggerSource.scheduler);

    expect(result.success).toBe(false);
    expect(result.error.code).toBe('RETRIGGER_STALE_COMMENT_SKIP');
  });

  it('throws when fetchComment fails with non-terminal error', async () => {
    const { github, reviewTrigger } = setup();
    const item = makeItem();
    github.fetchComment.mockRejectedValue({ status: 500 });

    await expect(reviewTrigger.trigger(item, TriggerSource.scheduler)).rejects.toStrictEqual({ status: 500 });
  });

  it('throws when replacement comment fetch fails with non-terminal error', async () => {
    const { github, reviewTrigger } = setup();
    const item = makeItem();
    github.fetchComment.mockResolvedValueOnce('stale body');
    github.findLatestReviewLimitComment.mockResolvedValue({
      comment_id: NEW_COMMENT_ID,
      url: NEW_COMMENT_URL,
      repo_full_name: 'o/r',
      pr_number: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    github.fetchComment.mockRejectedValueOnce({ status: 500 });

    await expect(reviewTrigger.trigger(item, TriggerSource.scheduler)).rejects.toStrictEqual({ status: 500 });
  });
});
