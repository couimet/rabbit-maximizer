import { summarizeEvent } from '../../dashboard/src/components/summarizeEvent.js';

import { getUniqueInt, getUniqueString, getUuid } from '@couimet/dynamic-testing';
import { beforeEach, describe, expect, it } from '@jest/globals';

const FULL_SHA_LENGTH = 40;
const SHORT_SHA_LENGTH = 7;

const textToken = (value: string) => ({ kind: 'text', value });
const linkToken = (value: string, url: string) => ({ kind: 'link', value, url });

const buildPrUrl = (): string => `https://github.com/${getUniqueString()}/${getUniqueString()}/pull/${getUniqueInt()}`;
const buildSha = (length: number): string => `${getUuid().replace(/-/g, '')}${getUuid().replace(/-/g, '')}`.slice(0, length);

describe('summarizeEvent', () => {
  let prUrl: string;
  let sourceCommentId: string;
  let retriggeredCommentId: string;
  let skippedCommentId: string;
  let refusedCommentId: string;
  let runIdCommentId: string;
  let verdictCommentId: string;
  let changesSuggestedCommentId: string;
  let sourceCommentUrl: string;
  let retriggeredCommentUrl: string;
  let skippedCommentUrl: string;
  let refusedCommentUrl: string;
  let runIdCommentUrl: string;
  let verdictCommentUrl: string;
  let changesSuggestedCommentUrl: string;
  let digitOnlyCommentId: string;
  let runId: string;
  let otherRunId: string;
  let previousRunId: string;
  let matchedOffset: number;
  let headSha: string;
  let reviewedHeadSha: string;
  let fullHeadSha: string;

  beforeEach(() => {
    prUrl = buildPrUrl();
    sourceCommentId = String(getUniqueInt());
    retriggeredCommentId = String(getUniqueInt());
    skippedCommentId = String(getUniqueInt());
    refusedCommentId = String(getUniqueInt());
    runIdCommentId = String(getUniqueInt());
    verdictCommentId = String(getUniqueInt());
    changesSuggestedCommentId = String(getUniqueInt());
    sourceCommentUrl = `${prUrl}#issuecomment-${sourceCommentId}`;
    retriggeredCommentUrl = `${prUrl}#issuecomment-${retriggeredCommentId}`;
    skippedCommentUrl = `${prUrl}#issuecomment-${skippedCommentId}`;
    refusedCommentUrl = `${prUrl}#issuecomment-${refusedCommentId}`;
    runIdCommentUrl = `${prUrl}#issuecomment-${runIdCommentId}`;
    verdictCommentUrl = `${buildPrUrl()}#issuecomment-${verdictCommentId}`;
    changesSuggestedCommentUrl = `${buildPrUrl()}#issuecomment-${changesSuggestedCommentId}`;
    digitOnlyCommentId = String(getUniqueInt());
    runId = getUniqueString({ prefix: 'run-' });
    otherRunId = getUniqueString({ prefix: 'run-' });
    previousRunId = getUniqueString({ prefix: 'run-' });
    matchedOffset = getUniqueInt();
    fullHeadSha = buildSha(FULL_SHA_LENGTH);
    headSha = fullHeadSha.slice(0, SHORT_SHA_LENGTH);
    reviewedHeadSha = buildSha(SHORT_SHA_LENGTH);
  });

  it('renders a detected event found via comment search with a run token and a comment link', () => {
    const reading = summarizeEvent('detected', {
      detected_via: 'search',
      coderabbit_run_id: runId,
      source_comment_url: sourceCommentUrl,
    });
    expect(reading).toStrictEqual([
      textToken('via comment search'),
      textToken(' · '),
      textToken(`run ${runId}`),
      textToken(' · '),
      linkToken(`comment ${sourceCommentId}`, sourceCommentUrl),
    ]);
  });

  it('renders a detected event found via open-PR scan with only a run token', () => {
    const reading = summarizeEvent('detected', {
      detected_via: 'direct_scan',
      coderabbit_run_id: otherRunId,
    });
    expect(reading).toStrictEqual([textToken('via open-PR scan'), textToken(' · '), textToken(`run ${otherRunId}`)]);
  });

  it('renders a detected event recovered from a deleted comment by mechanism only', () => {
    const reading = summarizeEvent('detected', {
      detected_via: 'stale_recovery',
      source_comment_url: prUrl,
    });
    expect(reading).toStrictEqual([textToken('recovered from deleted comment')]);
  });

  it('renders only the run token when detected_via is unrecognized but a run id exists', () => {
    const reading = summarizeEvent('detected', {
      detected_via: 'something_new',
      coderabbit_run_id: 'xyz',
    });
    expect(reading).toStrictEqual([textToken('run xyz')]);
  });

  it('returns an empty reading for a detected event with a non-string source URL and no other fields', () => {
    const reading = summarizeEvent('detected', {
      source_comment_url: 12,
    });
    expect(reading).toStrictEqual([]);
  });

  it('returns a mechanism-only reading for a detected event whose comment URL carries no trailing id', () => {
    const reading = summarizeEvent('detected', {
      detected_via: 'direct_scan',
      source_comment_url: `${prUrl}#pullrequestreview-note`,
    });
    expect(reading).toStrictEqual([textToken('via open-PR scan')]);
  });

  it('returns an empty reading for enqueued events, whose payload is empty', () => {
    expect(summarizeEvent('enqueued', {})).toStrictEqual([]);
  });

  it('renders linked source and retriggered comment ids for a retrigger', () => {
    const reading = summarizeEvent('retriggered', {
      source_comment_url: sourceCommentUrl,
      retriggered_comment_url: retriggeredCommentUrl,
    });
    expect(reading).toStrictEqual([
      linkToken(`source comment ${sourceCommentId}`, sourceCommentUrl),
      textToken(' → '),
      linkToken(`comment ${retriggeredCommentId}`, retriggeredCommentUrl),
    ]);
  });

  it('renders only the source comment when the retriggered comment is missing', () => {
    const reading = summarizeEvent('retriggered', {
      source_comment_url: sourceCommentUrl,
    });
    expect(reading).toStrictEqual([linkToken(`source comment ${sourceCommentId}`, sourceCommentUrl)]);
  });

  it('renders only the retriggered comment when the source comment is missing', () => {
    const reading = summarizeEvent('retriggered', {
      retriggered_comment_url: retriggeredCommentUrl,
    });
    expect(reading).toStrictEqual([linkToken(`comment ${retriggeredCommentId}`, retriggeredCommentUrl)]);
  });

  it('returns an empty reading for a retrigger with no comment urls', () => {
    expect(summarizeEvent('retriggered', {})).toStrictEqual([]);
  });

  it('renders a comment link and run token for an approved review verdict', () => {
    const reading = summarizeEvent('coderabbit_review_approved', {
      coderabbit_comment_url: verdictCommentUrl,
      coderabbit_run_id: '9b30c77d',
    });
    expect(reading).toStrictEqual([linkToken(`comment ${verdictCommentId}`, verdictCommentUrl), textToken(' · '), textToken('run 9b30c77d')]);
  });

  it('renders a comment link and run token for a changes-suggested review verdict', () => {
    const reading = summarizeEvent('coderabbit_review_changes_suggested', {
      coderabbit_comment_url: changesSuggestedCommentUrl,
      coderabbit_run_id: '9b30c77d',
    });
    expect(reading).toStrictEqual([linkToken(`comment ${changesSuggestedCommentId}`, changesSuggestedCommentUrl), textToken(' · '), textToken('run 9b30c77d')]);
  });

  it('returns an empty reading for a review verdict with no tokens', () => {
    expect(summarizeEvent('coderabbit_review_changes_suggested', {})).toStrictEqual([]);
  });

  it('renders the matched phrase and source comment link for a refused review', () => {
    const reading = summarizeEvent('coderabbit_review_refused', {
      matched_phrase: 'without an assigned CodeRabbit review seat',
      comment_url: refusedCommentUrl,
    });
    expect(reading).toStrictEqual([
      textToken('without an assigned CodeRabbit review seat'),
      textToken(' · '),
      linkToken(`source comment ${refusedCommentId}`, refusedCommentUrl),
    ]);
  });

  it('renders only the matched phrase for a refused review with no comment url', () => {
    const reading = summarizeEvent('coderabbit_review_refused', {
      matched_phrase: 'without an assigned CodeRabbit review seat',
    });
    expect(reading).toStrictEqual([textToken('without an assigned CodeRabbit review seat')]);
  });

  it('renders only the source comment link for a refused review with no matched phrase', () => {
    const reading = summarizeEvent('coderabbit_review_refused', {
      comment_url: refusedCommentUrl,
    });
    expect(reading).toStrictEqual([linkToken(`source comment ${refusedCommentId}`, refusedCommentUrl)]);
  });

  it('returns an empty reading for a refused review with neither phrase nor comment', () => {
    expect(summarizeEvent('coderabbit_review_refused', {})).toStrictEqual([]);
  });

  it('renders the matched rule and source comment link for an excluded event', () => {
    const reading = summarizeEvent('excluded', {
      matched_field: 'author',
      matched_pattern: 'renovate',
      comment_url: refusedCommentUrl,
    });
    expect(reading).toStrictEqual([
      textToken('matched the author rule renovate'),
      textToken(' · '),
      linkToken(`source comment ${refusedCommentId}`, refusedCommentUrl),
    ]);
  });

  it('renders only the matched rule for an excluded event with no comment url', () => {
    const reading = summarizeEvent('excluded', {
      matched_field: 'title',
      matched_pattern: 'WIP',
    });
    expect(reading).toStrictEqual([textToken('matched the title rule WIP')]);
  });

  it('renders only the source comment link for an excluded event with no matched rule', () => {
    const reading = summarizeEvent('excluded', {
      comment_url: refusedCommentUrl,
    });
    expect(reading).toStrictEqual([linkToken(`source comment ${refusedCommentId}`, refusedCommentUrl)]);
  });

  it('renders only the source comment link for an excluded event with one half of the rule', () => {
    const reading = summarizeEvent('excluded', {
      matched_field: 'author',
      comment_url: refusedCommentUrl,
    });
    expect(reading).toStrictEqual([linkToken(`source comment ${refusedCommentId}`, refusedCommentUrl)]);
  });

  it('returns an empty reading for an excluded event with no payload', () => {
    expect(summarizeEvent('excluded', {})).toStrictEqual([]);
  });

  it('renders the matched phrase for a skipped review', () => {
    const reading = summarizeEvent('coderabbit_review_skipped', {
      matched_phrase: 'review paused by coderabbit.ai',
      matched_offset: matchedOffset,
    });
    expect(reading).toStrictEqual([textToken('review paused by coderabbit.ai')]);
  });

  it('prefers the matched phrase over the legacy skip reason for a skipped review', () => {
    const reading = summarizeEvent('coderabbit_review_skipped', {
      matched_phrase: 'review paused by coderabbit.ai',
      skip_reason: 'walkthrough declined by author',
    });
    expect(reading).toStrictEqual([textToken('review paused by coderabbit.ai')]);
  });

  it('renders the legacy skip reason for a skipped review', () => {
    const reading = summarizeEvent('coderabbit_review_skipped', {
      skip_reason: 'walkthrough declined by author',
    });
    expect(reading).toStrictEqual([textToken('walkthrough declined by author')]);
  });

  it('renders a comment link for a skipped review with no skip reason', () => {
    const reading = summarizeEvent('coderabbit_review_skipped', {
      comment_url: skippedCommentUrl,
    });
    expect(reading).toStrictEqual([linkToken(`comment ${skippedCommentId}`, skippedCommentUrl)]);
  });

  it('returns an empty reading for a skipped review with neither reason nor comment', () => {
    expect(summarizeEvent('coderabbit_review_skipped', {})).toStrictEqual([]);
  });

  it('renders a comment link and new run token when a run id is first seen', () => {
    const reading = summarizeEvent('coderabbit_run_id_first_seen', {
      comment_id: 1,
      comment_url: runIdCommentUrl,
      coderabbit_run_id: runId,
    });
    expect(reading).toStrictEqual([linkToken('comment 1', runIdCommentUrl), textToken(' · '), textToken(`new run ${runId}`)]);
  });

  it('renders a plain comment token when a numeric comment id has no url', () => {
    const reading = summarizeEvent('coderabbit_run_id_first_seen', {
      comment_id: 1,
      coderabbit_run_id: runId,
    });
    expect(reading).toStrictEqual([textToken('comment 1'), textToken(' · '), textToken(`new run ${runId}`)]);
  });

  it('links a comment token derived from a string comment id', () => {
    const reading = summarizeEvent('coderabbit_run_id_first_seen', {
      comment_id: runIdCommentUrl,
    });
    expect(reading).toStrictEqual([linkToken(`comment ${runIdCommentId}`, runIdCommentUrl)]);
  });

  it('renders a linked comment token for a digit-only string comment id', () => {
    const reading = summarizeEvent('coderabbit_run_id_first_seen', {
      comment_id: digitOnlyCommentId,
      comment_url: runIdCommentUrl,
    });
    expect(reading).toStrictEqual([linkToken(`comment ${digitOnlyCommentId}`, runIdCommentUrl)]);
  });

  it('renders a plain comment token for a digit-only string comment id with no url', () => {
    const reading = summarizeEvent('coderabbit_run_id_first_seen', {
      comment_id: digitOnlyCommentId,
    });
    expect(reading).toStrictEqual([textToken(`comment ${digitOnlyCommentId}`)]);
  });

  it('renders previous and new run tokens when a run id changes', () => {
    const reading = summarizeEvent('coderabbit_run_id_changed', {
      previous_coderabbit_run_id: runId,
      coderabbit_run_id: '9b30c77d',
    });
    expect(reading).toStrictEqual([textToken(`run ${runId} → 9b30c77d`)]);
  });

  it('returns an empty reading when a run id change has no previous run id', () => {
    expect(summarizeEvent('coderabbit_run_id_changed', { coderabbit_run_id: '9b30c77d' })).toStrictEqual([]);
  });

  it('renders a comment link and removed previous run token when a run id is cleared', () => {
    const reading = summarizeEvent('coderabbit_run_id_cleared', {
      comment_id: 4,
      comment_url: runIdCommentUrl,
      previous_coderabbit_run_id: previousRunId,
    });
    expect(reading).toStrictEqual([linkToken('comment 4', runIdCommentUrl), textToken(' · '), textToken(`previous run ${previousRunId} removed`)]);
  });

  it('renders only the removed previous run when a run id is cleared without a comment', () => {
    const reading = summarizeEvent('coderabbit_run_id_cleared', {
      previous_coderabbit_run_id: previousRunId,
    });
    expect(reading).toStrictEqual([textToken(`previous run ${previousRunId} removed`)]);
  });

  it('returns an empty reading when a run id is cleared with no fields', () => {
    expect(summarizeEvent('coderabbit_run_id_cleared', {})).toStrictEqual([]);
  });

  it('renders the dismissal reason phrase for each known reason', () => {
    expect(summarizeEvent('dismissed', { reason: 'prMerged' })).toStrictEqual([textToken('PR already merged')]);
    expect(summarizeEvent('dismissed', { reason: 'prClosedWithoutMerge' })).toStrictEqual([textToken('PR closed without merge')]);
    expect(summarizeEvent('dismissed', { reason: 'prDeleted' })).toStrictEqual([textToken('PR deleted')]);
    expect(summarizeEvent('dismissed', { reason: 'prNotRegistered' })).toStrictEqual([textToken('PR not registered')]);
    expect(summarizeEvent('dismissed', { reason: 'staleComment' })).toStrictEqual([textToken('Stale review-limit comment')]);
  });

  it('returns an empty reading for a dismissal with no reason or an unrecognized one', () => {
    expect(summarizeEvent('dismissed', {})).toStrictEqual([]);
    expect(summarizeEvent('dismissed', { reason: 'unexpected_reason' })).toStrictEqual([]);
  });

  it('renders the reason for a failed event that carries one', () => {
    const reading = summarizeEvent('failed', {
      reason: 'rate limit still active after 10 attempts',
    });
    expect(reading).toStrictEqual([textToken('rate limit still active after 10 attempts')]);
  });

  it('renders the retrigger counts for a failed event without a reason', () => {
    const reading = summarizeEvent('failed', {
      reason: '',
      retrigger_count: 2,
      max: 5,
    });
    expect(reading).toStrictEqual([textToken('after 2 of 5 retriggers')]);
  });

  it('renders the retrigger counts for a failed event with no reason key', () => {
    const reading = summarizeEvent('failed', {
      retrigger_count: 10,
      max: 10,
    });
    expect(reading).toStrictEqual([textToken('after 10 of 10 retriggers')]);
  });

  it('returns an empty reading for a failed event with an empty payload', () => {
    expect(summarizeEvent('failed', {})).toStrictEqual([]);
  });

  it('renders the unreviewed head and the head the last review covered', () => {
    const reading = summarizeEvent('head_drift_recovered', {
      head_sha: headSha,
      reviewed_head_sha: reviewedHeadSha,
    });
    expect(reading).toStrictEqual([textToken(`head ${headSha} has no review`), textToken(' · '), textToken(`last review covered ${reviewedHeadSha}`)]);
  });

  it('renders only the unreviewed head when no reviewed head was recorded', () => {
    const reading = summarizeEvent('head_drift_recovered', {
      head_sha: headSha,
    });
    expect(reading).toStrictEqual([textToken(`head ${headSha} has no review`)]);
  });

  it('shortens a full head sha to the length of the image tag', () => {
    const reading = summarizeEvent('head_drift_recovered', {
      head_sha: fullHeadSha,
    });
    expect(reading).toStrictEqual([textToken(`head ${headSha} has no review`)]);
  });

  it('returns an empty reading for a head drift event with no head sha', () => {
    expect(summarizeEvent('head_drift_recovered', {})).toStrictEqual([]);
  });

  it('returns an empty reading for an unrecognized event type', () => {
    expect(summarizeEvent('future_event_type', {})).toStrictEqual([]);
  });
});
