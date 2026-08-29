import type { ScannedPR, StaleOpenPR } from '../../src/types/index.js';
import { mergeByPullRequestId } from '../../src/utils/mergeByPullRequestId.js';
import { generateReviewRef } from '../helpers/index.js';

import { getUniqueDate, getUniqueInt } from '@couimet/dynamic-testing';
import { describe, expect, it } from '@jest/globals';

describe('mergeByPullRequestId', () => {
  it('returns an empty array when both inputs are empty', () => {
    const result = mergeByPullRequestId([], []);

    expect(result).toStrictEqual([]);
  });

  it('includes scanned PRs in the result', () => {
    const ref = generateReviewRef();
    const pullRequestId = getUniqueInt();
    const scanned: ScannedPR[] = [{ repoFullName: ref.repoFullName, prNumber: ref.prNumber, pullRequestId, prTitle: ref.prTitle }];

    const result = mergeByPullRequestId(scanned, []);

    expect(result).toStrictEqual([{ repoFullName: ref.repoFullName, prNumber: ref.prNumber, pullRequestId, prTitle: ref.prTitle }]);
  });

  it('includes stale PRs mapped from id to pullRequestId', () => {
    const ref = generateReviewRef();
    const prId = getUniqueInt();
    const stale: StaleOpenPR[] = [
      { id: prId, repoFullName: ref.repoFullName, prNumber: ref.prNumber, title: ref.prTitle, lastReviewRequestedAt: getUniqueDate() },
    ];

    const result = mergeByPullRequestId([], stale);

    expect(result).toStrictEqual([{ repoFullName: ref.repoFullName, prNumber: ref.prNumber, pullRequestId: prId, prTitle: ref.prTitle }]);
  });

  it('deduplicates by pullRequestId when the same PR appears in both inputs', () => {
    const ref = generateReviewRef();
    const sharedId = getUniqueInt();
    const scanned: ScannedPR[] = [{ repoFullName: ref.repoFullName, prNumber: ref.prNumber, pullRequestId: sharedId, prTitle: ref.prTitle }];
    const stale: StaleOpenPR[] = [
      { id: sharedId, repoFullName: ref.repoFullName, prNumber: ref.prNumber, title: ref.prTitle, lastReviewRequestedAt: getUniqueDate() },
    ];

    const result = mergeByPullRequestId(scanned, stale);

    expect(result).toStrictEqual([{ repoFullName: ref.repoFullName, prNumber: ref.prNumber, pullRequestId: sharedId, prTitle: ref.prTitle }]);
  });

  it('merges distinct PRs from both sources', () => {
    const ref1 = generateReviewRef();
    const ref2 = generateReviewRef();
    const prId1 = getUniqueInt();
    const prId2 = getUniqueInt();
    const scanned: ScannedPR[] = [{ repoFullName: ref1.repoFullName, prNumber: ref1.prNumber, pullRequestId: prId1, prTitle: ref1.prTitle }];
    const stale: StaleOpenPR[] = [
      { id: prId2, repoFullName: ref2.repoFullName, prNumber: ref2.prNumber, title: ref2.prTitle, lastReviewRequestedAt: getUniqueDate() },
    ];

    const result = mergeByPullRequestId(scanned, stale);

    expect(result).toStrictEqual([
      { repoFullName: ref1.repoFullName, prNumber: ref1.prNumber, pullRequestId: prId1, prTitle: ref1.prTitle },
      { repoFullName: ref2.repoFullName, prNumber: ref2.prNumber, pullRequestId: prId2, prTitle: ref2.prTitle },
    ]);
  });
});
