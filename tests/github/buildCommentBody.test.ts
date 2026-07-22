import pkg from '../../package.json' with { type: 'json' };
import { TriggerSource } from '../../src/domain.js';
import { buildCommentBody } from '../../src/github/index.js';

import { getUniqueDate, getUniqueGitHubRepoRef, getUniqueInt, getUniqueString } from '@couimet/dynamic-testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const VERSION = pkg.version;
const REPO_URL = pkg.repository.url;

describe('buildCommentBody', () => {
  let frozenDate: Date;

  beforeEach(() => {
    frozenDate = getUniqueDate();
    jest.useFakeTimers();
    jest.setSystemTime(frozenDate);
  });

  it('builds the retrigger comment with JSON metadata, footer, and trigger link for scheduler', () => {
    const { owner, repo } = getUniqueGitHubRepoRef();
    const prNumber = getUniqueInt();
    const commentId = getUniqueInt();
    const runId = getUniqueString({ prefix: 'run-' });

    const triggerUrl = `https://github.com/${owner}/${repo}/issues/${prNumber}#issuecomment-${commentId}`;
    const body = buildCommentBody(triggerUrl, runId, TriggerSource.scheduler);

    const lines = body.split('\n');
    expect(lines[0]).toBe('@coderabbitai full review');
    expect(lines[1]).toBe('');
    expect(lines[2]).toBe(`\u{21A9} Triggered by: ${triggerUrl}`);
    expect(lines[3]).toBe('');
    expect(lines[4]).toBe('---');
    expect(lines[5]).toBe('');
    expect(lines[6]).toBe(`\u{1F916} [rabbit-maximizer](${REPO_URL}) v${VERSION} — run=${runId}`);
    expect(lines[7]).toBe('');

    const jsonMatch = body.match(/<!-- rabbit-maximizer\n([\s\S]*?)\n-->/);
    expect(jsonMatch).not.toBeNull();
    expect(JSON.parse(jsonMatch![1])).toStrictEqual({
      version: VERSION,
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
    const body = buildCommentBody(triggerUrl, runId, TriggerSource.dashboard_retrigger_now);

    const lines = body.split('\n');
    expect(lines[0]).toBe('@coderabbitai full review');
    expect(lines[1]).toBe('');
    expect(lines[2]).toBe('\u{26A1} Triggered manually from dashboard');
    expect(lines[3]).toBe('');
    expect(lines[4]).toBe('---');
    expect(lines[5]).toBe('');
    expect(lines[6]).toBe(`\u{1F916} [rabbit-maximizer](${REPO_URL}) v${VERSION} — run=${runId}`);
    expect(lines[7]).toBe('');

    const jsonMatch = body.match(/<!-- rabbit-maximizer\n([\s\S]*?)\n-->/);
    expect(jsonMatch).not.toBeNull();
    expect(JSON.parse(jsonMatch![1])).toStrictEqual({
      version: VERSION,
      runId,
      triggerSource: 'dashboard_retrigger_now',
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
    const body = buildCommentBody(triggerUrl, runId, TriggerSource.scheduler);

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
    const invoke = () => buildCommentBody(triggerUrl, runId, 'bogus' as TriggerSource);

    expect(invoke).toThrowDetailedError('UNEXPECTED_SWITCH_VALUE', {
      message: 'Unexpected triggerSource: "bogus"',
      functionName: 'buildCommentBody',
      details: { unexpectedValue: 'bogus' },
    });
  });
});
