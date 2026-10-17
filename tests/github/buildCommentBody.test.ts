import pkg from '../../package.json' with { type: 'json' };
import { CodeRabbitCommentType, MatchedMarker, TriggerSource } from '../../src/domain.js';
import { buildCommentBody } from '../../src/github/index.js';
import type { CommentDiagnosis, RetriggerDiagnosis, RunIdentity } from '../../src/types/index.js';

import { getUniqueDate, getUniqueGitHubRepoRef, getUniqueInt, getUniqueString } from '@couimet/dynamic-testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const REPO_URL = pkg.repository.url;
const MS_PER_HOUR = 3_600_000;
const SOURCE_AGE_MS = 2 * MS_PER_HOUR;
const WAIT_SECONDS = 1800;

describe('buildCommentBody', () => {
  let frozenDate: Date;
  let version: string;
  let gitSha: string;
  let identity: RunIdentity;

  beforeEach(() => {
    frozenDate = getUniqueDate();
    version = getUniqueString({ prefix: 'v-' });
    gitSha = getUniqueString({ prefix: 'sha-' });
    identity = {
      version,
      gitSha,
      runKind: getUniqueString({ prefix: 'kind-' }),
      imageTags: getUniqueString({ prefix: 'tags-' }),
    };
    jest.useFakeTimers();
    jest.setSystemTime(frozenDate);
  });

  it('builds the retrigger comment with JSON metadata, footer, and trigger link for scheduler', () => {
    const { owner, repo } = getUniqueGitHubRepoRef();
    const prNumber = getUniqueInt();
    const commentId = getUniqueInt();
    const runId = getUniqueString({ prefix: 'run-' });

    const triggerUrl = `https://github.com/${owner}/${repo}/issues/${prNumber}#issuecomment-${commentId}`;
    const body = buildCommentBody(triggerUrl, runId, TriggerSource.scheduler, undefined, identity);

    const lines = body.split('\n');
    expect(lines[0]).toBe('@coderabbitai full review');
    expect(lines[1]).toBe('');
    expect(lines[2]).toBe(`\u{21A9} Triggered by: ${triggerUrl}`);
    expect(lines[3]).toBe('');
    expect(lines[4]).toBe('---');
    expect(lines[5]).toBe('');
    expect(lines[6]).toBe(`\u{1F916} [rabbit-maximizer](${REPO_URL}) v${version} (${gitSha}) — run=${runId}`);
    expect(lines[7]).toBe('');

    const jsonMatch = body.match(/<!-- rabbit-maximizer\n([\s\S]*?)\n-->/);
    expect(jsonMatch).not.toBeNull();
    expect(JSON.parse(jsonMatch![1])).toStrictEqual({
      version,
      gitSha,
      runId,
      triggerSource: 'scheduler',
      sourceCommentUrl: triggerUrl,
      timestamp: frozenDate.toISOString(),
    });
  });

  it('builds the retrigger comment with JSON metadata and manual trigger line for dashboard_retrigger_now', () => {
    const { owner, repo } = getUniqueGitHubRepoRef();
    const prNumber = getUniqueInt();
    const commentId = getUniqueInt();
    const runId = getUniqueString({ prefix: 'run-' });

    const triggerUrl = `https://github.com/${owner}/${repo}/issues/${prNumber}#issuecomment-${commentId}`;
    const body = buildCommentBody(triggerUrl, runId, TriggerSource.dashboard_retrigger_now, undefined, identity);

    const lines = body.split('\n');
    expect(lines[0]).toBe('@coderabbitai full review');
    expect(lines[1]).toBe('');
    expect(lines[2]).toBe('\u{26A1} Triggered manually from dashboard');
    expect(lines[3]).toBe('');
    expect(lines[4]).toBe('---');
    expect(lines[5]).toBe('');
    expect(lines[6]).toBe(`\u{1F916} [rabbit-maximizer](${REPO_URL}) v${version} (${gitSha}) — run=${runId}`);
    expect(lines[7]).toBe('');

    const jsonMatch = body.match(/<!-- rabbit-maximizer\n([\s\S]*?)\n-->/);
    expect(jsonMatch).not.toBeNull();
    expect(JSON.parse(jsonMatch![1])).toStrictEqual({
      version,
      gitSha,
      runId,
      triggerSource: 'dashboard_retrigger_now',
      sourceCommentUrl: null,
      timestamp: frozenDate.toISOString(),
    });
  });

  it('uses fallback text and null metadata when source comment URL is undefined for scheduler', () => {
    const runId = getUniqueString({ prefix: 'run-' });

    const body = buildCommentBody(undefined, runId, TriggerSource.scheduler, undefined, identity);

    const lines = body.split('\n');
    expect(lines[2]).toBe('\u{21A9} Triggered by scheduler');

    const jsonMatch = body.match(/<!-- rabbit-maximizer\n([\s\S]*?)\n-->/);
    expect(jsonMatch).not.toBeNull();
    expect(JSON.parse(jsonMatch![1])).toStrictEqual({
      version,
      gitSha,
      runId,
      triggerSource: 'scheduler',
      sourceCommentUrl: null,
      timestamp: frozenDate.toISOString(),
    });
  });

  it('sanitizes --> in metadata values to prevent HTML comment termination', () => {
    const { owner, repo } = getUniqueGitHubRepoRef();
    const prNumber = getUniqueInt();
    const commentId = getUniqueInt();
    const runId = getUniqueString({ prefix: 'run-' });

    const triggerUrl = `https://github.com/${owner}/-->${repo}/issues/${prNumber}#issuecomment-${commentId}`;
    const body = buildCommentBody(triggerUrl, runId, TriggerSource.scheduler, undefined, identity);

    const jsonMatch = body.match(/<!-- rabbit-maximizer\n([\s\S]*?)\n-->/);
    expect(jsonMatch).not.toBeNull();
    const parsed = JSON.parse(jsonMatch![1]);
    expect(parsed.sourceCommentUrl).toBe(triggerUrl);
  });

  it('throws for an unexpected triggerSource value', () => {
    const { owner, repo } = getUniqueGitHubRepoRef();
    const prNumber = getUniqueInt();
    const commentId = getUniqueInt();
    const runId = getUniqueString({ prefix: 'run-' });

    const triggerUrl = `https://github.com/${owner}/${repo}/issues/${prNumber}#issuecomment-${commentId}`;
    const invoke = () => buildCommentBody(triggerUrl, runId, 'bogus' as TriggerSource, undefined, identity);

    expect(invoke).toThrowDetailedError('UNEXPECTED_SWITCH_VALUE', {
      message: 'Unexpected triggerSource: "bogus"',
      functionName: 'buildCommentBody',
      details: { unexpectedValue: 'bogus' },
    });
  });

  it('includes visible diagnosis line and JSON diagnosis field for decision source', () => {
    const { owner, repo } = getUniqueGitHubRepoRef();
    const prNumber = getUniqueInt();
    const commentId = getUniqueInt();
    const runId = getUniqueString({ prefix: 'run-' });
    const sourceCreatedAt = new Date(frozenDate.getTime() - SOURCE_AGE_MS);

    const triggerUrl = `https://github.com/${owner}/${repo}/issues/${prNumber}#issuecomment-${commentId}`;

    const sourceComment: CommentDiagnosis = {
      url: triggerUrl,
      createdAt: sourceCreatedAt.toISOString(),
      updatedAt: sourceCreatedAt.toISOString(),
      classification: CodeRabbitCommentType.review_limited,
      matchedMarker: MatchedMarker.rate_limit,
    };

    const diagnosis: RetriggerDiagnosis = {
      sourceComment,
      waitSeconds: WAIT_SECONDS,
      decision: 'source',
    };

    const body = buildCommentBody(triggerUrl, runId, TriggerSource.scheduler, diagnosis, identity);

    const lines = body.split('\n');
    expect(lines[0]).toBe('@coderabbitai full review');
    expect(lines[1]).toBe('');
    expect(lines[2]).toBe(`\u{21A9} Triggered by: ${triggerUrl}`);
    expect(lines[3]).toBe('\u{1F50D} Source: review_limited comment from 2h ago, wait 1800s');
    expect(lines[4]).toBe('');
    expect(lines[5]).toBe('---');
    expect(lines[6]).toBe('');
    expect(lines[7]).toBe(`\u{1F916} [rabbit-maximizer](${REPO_URL}) v${version} (${gitSha}) — run=${runId}`);
    expect(lines[8]).toBe('');

    const jsonMatch = body.match(/<!-- rabbit-maximizer\n([\s\S]*?)\n-->/);
    expect(jsonMatch).not.toBeNull();
    expect(JSON.parse(jsonMatch![1])).toStrictEqual({
      version,
      gitSha,
      runId,
      triggerSource: 'scheduler',
      sourceCommentUrl: triggerUrl,
      timestamp: frozenDate.toISOString(),
      diagnosis: {
        sourceComment: {
          url: triggerUrl,
          createdAt: sourceCreatedAt.toISOString(),
          updatedAt: sourceCreatedAt.toISOString(),
          classification: 'review_limited',
          matchedMarker: 'rate limited by coderabbit.ai',
        },
        waitSeconds: WAIT_SECONDS,
        decision: 'source',
      },
    });
  });

  it('omits the wait suffix when waitSeconds is undefined', () => {
    const { owner, repo } = getUniqueGitHubRepoRef();
    const prNumber = getUniqueInt();
    const commentId = getUniqueInt();
    const runId = getUniqueString({ prefix: 'run-' });
    const sourceCreatedAt = new Date(frozenDate.getTime() - SOURCE_AGE_MS);

    const triggerUrl = `https://github.com/${owner}/${repo}/issues/${prNumber}#issuecomment-${commentId}`;

    const diagnosis: RetriggerDiagnosis = {
      sourceComment: {
        url: triggerUrl,
        createdAt: sourceCreatedAt.toISOString(),
        updatedAt: sourceCreatedAt.toISOString(),
        classification: CodeRabbitCommentType.review_limited,
        matchedMarker: MatchedMarker.rate_limit,
      },
      waitSeconds: undefined,
      decision: 'source',
    };

    const body = buildCommentBody(triggerUrl, runId, TriggerSource.scheduler, diagnosis, identity);

    expect(body.split('\n')[3]).toBe('\u{1F50D} Source: review_limited comment from 2h ago');
  });

  it('includes visible diagnosis line and JSON diagnosis field for decision direct', () => {
    const { owner, repo } = getUniqueGitHubRepoRef();
    const prNumber = getUniqueInt();
    const commentId = getUniqueInt();
    const runId = getUniqueString({ prefix: 'run-' });

    const triggerUrl = `https://github.com/${owner}/${repo}/issues/${prNumber}#issuecomment-${commentId}`;

    const sourceComment: CommentDiagnosis = {
      url: triggerUrl,
      createdAt: '',
      updatedAt: '',
      classification: CodeRabbitCommentType.unknown,
      matchedMarker: undefined,
    };

    const diagnosis: RetriggerDiagnosis = {
      sourceComment,
      waitSeconds: undefined,
      decision: 'direct',
    };

    const body = buildCommentBody(undefined, runId, TriggerSource.scheduler, diagnosis, identity);

    const lines = body.split('\n');
    expect(lines[2]).toBe('\u{21A9} Triggered by scheduler');
    expect(lines[3]).toBe('\u{1F50D} Posted directly; no rate-limit comment found');

    const jsonMatch = body.match(/<!-- rabbit-maximizer\n([\s\S]*?)\n-->/);
    expect(jsonMatch).not.toBeNull();
    expect(JSON.parse(jsonMatch![1])).toStrictEqual({
      version,
      gitSha,
      runId,
      triggerSource: 'scheduler',
      sourceCommentUrl: null,
      timestamp: frozenDate.toISOString(),
      diagnosis: {
        sourceComment: {
          url: triggerUrl,
          createdAt: '',
          updatedAt: '',
          classification: 'unknown',
        },
        decision: 'direct',
      },
    });
  });

  it('renders replacement diagnosis line when decision is replacement', () => {
    const { owner, repo } = getUniqueGitHubRepoRef();
    const prNumber = getUniqueInt();
    const commentId = getUniqueInt();
    const runId = getUniqueString({ prefix: 'run-' });
    const originalCreatedAt = new Date(frozenDate.getTime() - SOURCE_AGE_MS);

    const triggerUrl = `https://github.com/${owner}/${repo}/issues/${prNumber}#issuecomment-${commentId}`;

    const sourceComment: CommentDiagnosis = {
      url: triggerUrl,
      createdAt: originalCreatedAt.toISOString(),
      updatedAt: originalCreatedAt.toISOString(),
      classification: CodeRabbitCommentType.review_limited,
      matchedMarker: MatchedMarker.rate_limit,
    };

    const replacementComment: CommentDiagnosis = {
      url: `https://github.com/${owner}/${repo}/issues/${prNumber}#issuecomment-${getUniqueInt()}`,
      createdAt: frozenDate.toISOString(),
      updatedAt: frozenDate.toISOString(),
      classification: CodeRabbitCommentType.review_limited,
      matchedMarker: MatchedMarker.rate_limit,
    };

    const diagnosis: RetriggerDiagnosis = {
      sourceComment,
      replacementComment,
      waitSeconds: WAIT_SECONDS,
      decision: 'replacement',
    };

    const body = buildCommentBody(triggerUrl, runId, TriggerSource.scheduler, diagnosis, identity);

    const lines = body.split('\n');
    expect(lines[3]).toBe('\u{1F50D} Source: replacement of review_limited comment from 2h ago, wait 1800s');
  });

  it('renders time-unavailable fallback for replacement source comment with empty createdAt', () => {
    const { owner, repo } = getUniqueGitHubRepoRef();
    const prNumber = getUniqueInt();
    const commentId = getUniqueInt();
    const runId = getUniqueString({ prefix: 'run-' });

    const triggerUrl = `https://github.com/${owner}/${repo}/issues/${prNumber}#issuecomment-${commentId}`;

    const sourceComment: CommentDiagnosis = {
      url: triggerUrl,
      createdAt: '',
      updatedAt: '',
      classification: CodeRabbitCommentType.unknown,
      matchedMarker: undefined,
    };

    const replacementComment: CommentDiagnosis = {
      url: `https://github.com/${owner}/${repo}/issues/${prNumber}#issuecomment-${getUniqueInt()}`,
      createdAt: frozenDate.toISOString(),
      updatedAt: frozenDate.toISOString(),
      classification: CodeRabbitCommentType.review_limited,
      matchedMarker: MatchedMarker.rate_limit,
    };

    const diagnosis: RetriggerDiagnosis = {
      sourceComment,
      replacementComment,
      waitSeconds: WAIT_SECONDS,
      decision: 'replacement',
    };

    const body = buildCommentBody(triggerUrl, runId, TriggerSource.scheduler, diagnosis, identity);

    const lines = body.split('\n');
    expect(lines[3]).toBe('\u{1F50D} Source: replacement of unknown comment (time unavailable), wait 1800s');
    expect(lines[3]).not.toContain('undefined ago');
  });

  it('omits diagnosis line and JSON diagnosis field for dashboard trigger even when diagnosis is provided', () => {
    const { owner, repo } = getUniqueGitHubRepoRef();
    const prNumber = getUniqueInt();
    const commentId = getUniqueInt();
    const runId = getUniqueString({ prefix: 'run-' });

    const triggerUrl = `https://github.com/${owner}/${repo}/issues/${prNumber}#issuecomment-${commentId}`;
    const sourceCreatedAt = new Date(frozenDate.getTime() - SOURCE_AGE_MS);

    const diagnosis: RetriggerDiagnosis = {
      sourceComment: {
        url: triggerUrl,
        createdAt: sourceCreatedAt.toISOString(),
        updatedAt: sourceCreatedAt.toISOString(),
        classification: CodeRabbitCommentType.review_limited,
        matchedMarker: MatchedMarker.rate_limit,
      },
      waitSeconds: WAIT_SECONDS,
      decision: 'source',
    };

    const body = buildCommentBody(triggerUrl, runId, TriggerSource.dashboard_retrigger_now, diagnosis, identity);

    const lines = body.split('\n');
    expect(lines[2]).toBe('\u{26A1} Triggered manually from dashboard');

    const jsonMatch = body.match(/<!-- rabbit-maximizer\n([\s\S]*?)\n-->/);
    expect(jsonMatch).not.toBeNull();
    const parsed = JSON.parse(jsonMatch![1]);
    expect(parsed.diagnosis).toBeUndefined();
    expect(parsed.triggerSource).toBe('dashboard_retrigger_now');
  });

  it('omits diagnosis from JSON metadata when diagnosis is not provided (dashboard trigger)', () => {
    const runId = getUniqueString({ prefix: 'run-' });

    const body = buildCommentBody(undefined, runId, TriggerSource.dashboard_retrigger_now, undefined, identity);

    const jsonMatch = body.match(/<!-- rabbit-maximizer\n([\s\S]*?)\n-->/);
    expect(jsonMatch).not.toBeNull();
    const parsed = JSON.parse(jsonMatch![1]);
    expect(parsed.diagnosis).toBeUndefined();
    expect(Object.keys(parsed).sort()).toStrictEqual(['gitSha', 'runId', 'sourceCommentUrl', 'timestamp', 'triggerSource', 'version']);
  });
});
