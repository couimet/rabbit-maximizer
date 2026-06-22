import pkg from '../../package.json' with { type: 'json' };
import { buildCommentBody } from '../../src/github/buildCommentBody.js';
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
    const body = buildCommentBody(triggerUrl, runId);

    const lines = body.split('\n');
    expect(lines[0]).toBe('@coderabbitai full review');
    expect(lines[1]).toBe('');
    expect(lines[2]).toBe(`🔧 rabbit-optimizer v${VERSION} run=${runId}`);
    expect(lines[3]).toBe('');
    expect(lines[4]).toBe('---');
    expect(lines[5]).toBe('');
    expect(lines[6]).toBe(`🤖 rabbit-optimizer | ${REPO_URL} | v${VERSION} | run=${runId}`);
    expect(lines[7]).toBe(`↩ Triggered by: ${triggerUrl}`);
  });
});
