import pkg from '../../package.json' with { type: 'json' };
import { buildCommentBody } from '../../src/github/buildCommentBody.js';
import { TriggerSource } from '../../src/types/index.js';
import { makeUniqueRepoName } from '../helpers/index.js';

import { getUniqueInt, getUniqueString } from '@couimet/dynamic-testing';
import { describe, expect, it } from '@jest/globals';

const VERSION = pkg.version;
const REPO_URL = pkg.repository.url;

describe('buildCommentBody', () => {
  it('builds the retrigger comment with run marker, repo link, and trigger source', () => {
    const { owner, repo } = makeUniqueRepoName();
    const prNumber = getUniqueInt();
    const commentId = getUniqueInt();
    const runId = getUniqueString({ prefix: 'run-' });

    const triggerUrl = `https://github.com/${owner}/${repo}/issues/${prNumber}#issuecomment-${commentId}`;
    const body = buildCommentBody(triggerUrl, runId, TriggerSource.scheduler);

    const lines = body.split('\n');
    expect(lines[0]).toBe('@coderabbitai full review');
    expect(lines[1]).toBe('');
    expect(lines[2]).toBe(`🔧 rabbit-maximizer v${VERSION} run=${runId}`);
    expect(lines[3]).toBe('');
    expect(lines[4]).toBe('---');
    expect(lines[5]).toBe('');
    expect(lines[6]).toBe(`🤖 rabbit-maximizer | ${REPO_URL} | v${VERSION} | run=${runId}`);
    expect(lines[7]).toBe(`↩ Triggered by: ${triggerUrl}`);
  });

  it('uses manual marker and footer when triggerSource is dashboard_retrigger_now', () => {
    const { owner, repo } = makeUniqueRepoName();
    const prNumber = getUniqueInt();
    const commentId = getUniqueInt();
    const runId = getUniqueString({ prefix: 'run-' });

    const triggerUrl = `https://github.com/${owner}/${repo}/issues/${prNumber}#issuecomment-${commentId}`;
    const body = buildCommentBody(triggerUrl, runId, TriggerSource.dashboard_retrigger_now);

    const lines = body.split('\n');
    expect(lines[0]).toBe('@coderabbitai full review');
    expect(lines[1]).toBe('');
    expect(lines[2]).toBe(`🔧 rabbit-maximizer v${VERSION} run=${runId} [manual]`);
    expect(lines[3]).toBe('');
    expect(lines[4]).toBe('---');
    expect(lines[5]).toBe('');
    expect(lines[6]).toBe(`🤖 rabbit-maximizer | ${REPO_URL} | v${VERSION} | run=${runId}`);
    expect(lines[7]).toBe('⚡ Triggered manually from dashboard');
  });

  it('produces the default footer when triggerSource is scheduler', () => {
    const { owner, repo } = makeUniqueRepoName();
    const prNumber = getUniqueInt();
    const commentId = getUniqueInt();
    const runId = getUniqueString({ prefix: 'run-' });

    const triggerUrl = `https://github.com/${owner}/${repo}/issues/${prNumber}#issuecomment-${commentId}`;
    const body = buildCommentBody(triggerUrl, runId, TriggerSource.scheduler);

    const lines = body.split('\n');
    expect(lines[0]).toBe('@coderabbitai full review');
    expect(lines[1]).toBe('');
    expect(lines[2]).toBe(`🔧 rabbit-maximizer v${VERSION} run=${runId}`);
    expect(lines[3]).toBe('');
    expect(lines[4]).toBe('---');
    expect(lines[5]).toBe('');
    expect(lines[6]).toBe(`🤖 rabbit-maximizer | ${REPO_URL} | v${VERSION} | run=${runId}`);
    expect(lines[7]).toBe(`↩ Triggered by: ${triggerUrl}`);
  });

  it('throws for an unexpected triggerSource value', () => {
    const { owner, repo } = makeUniqueRepoName();
    const prNumber = getUniqueInt();
    const commentId = getUniqueInt();
    const runId = getUniqueString({ prefix: 'run-' });

    const triggerUrl = `https://github.com/${owner}/${repo}/issues/${prNumber}#issuecomment-${commentId}`;
    const invoke = () => buildCommentBody(triggerUrl, runId, 'bogus' as TriggerSource);

    expect(invoke).toThrowDetailedError('UNEXPECTED_CODE_PATH', {
      message: 'Unexpected triggerSource: "bogus"',
      functionName: 'buildCommentBody',
      details: { unexpectedValue: 'bogus' },
    });
  });
});
