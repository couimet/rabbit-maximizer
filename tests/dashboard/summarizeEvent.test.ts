import { summarizeEvent } from '../../dashboard/src/components/summarizeEvent.js';

import { describe, expect, it } from '@jest/globals';

const PR_URL = 'https://github.com/couimet/rabbit-maximizer/pull/343';
const SOURCE_COMMENT_ID = '227104133';
const RETRIGGERED_COMMENT_ID = '227104521';
const SKIPPED_COMMENT_ID = '227089120';
const RUN_ID_COMMENT_ID = '227081902';
const SOURCE_COMMENT_URL = `${PR_URL}#issuecomment-${SOURCE_COMMENT_ID}`;
const RETRIGGERED_COMMENT_URL = `${PR_URL}#issuecomment-${RETRIGGERED_COMMENT_ID}`;
const SKIPPED_COMMENT_URL = `${PR_URL}#issuecomment-${SKIPPED_COMMENT_ID}`;
const RUN_ID_COMMENT_URL = `${PR_URL}#issuecomment-${RUN_ID_COMMENT_ID}`;
const VERDICT_COMMENT_ID = '227098210';
const VERDICT_COMMENT_URL = `https://github.com/couimet/my-claude-skills/pull/263#issuecomment-${VERDICT_COMMENT_ID}`;
const CHANGES_SUGGESTED_COMMENT_ID = '227104521';
const CHANGES_SUGGESTED_COMMENT_URL = `https://github.com/couimet/my-claude-skills/pull/263#issuecomment-${CHANGES_SUGGESTED_COMMENT_ID}`;
const DIGIT_ONLY_COMMENT_ID = '227112900';
const RUN_ID = '4f2e91a2';
const OTHER_RUN_ID = 'ab12cd34';
const PREVIOUS_RUN_ID = '7ea41c92';

const textToken = (value: string) => ({ kind: 'text', value });
const linkToken = (value: string, url: string) => ({ kind: 'link', value, url });

describe('summarizeEvent', () => {
  it('renders a detected event found via comment search with a run token and a comment link', () => {
    const reading = summarizeEvent('detected', {
      detected_via: 'search',
      coderabbit_run_id: RUN_ID,
      source_comment_url: SOURCE_COMMENT_URL,
    });
    expect(reading).toStrictEqual([
      textToken('via comment search'),
      textToken(' · '),
      textToken(`run ${RUN_ID}`),
      textToken(' · '),
      linkToken(`comment ${SOURCE_COMMENT_ID}`, SOURCE_COMMENT_URL),
    ]);
  });

  it('renders a detected event found via open-PR scan with only a run token', () => {
    const reading = summarizeEvent('detected', {
      detected_via: 'direct_scan',
      coderabbit_run_id: OTHER_RUN_ID,
    });
    expect(reading).toStrictEqual([textToken('via open-PR scan'), textToken(' · '), textToken(`run ${OTHER_RUN_ID}`)]);
  });

  it('renders a detected event recovered from a deleted comment by mechanism only', () => {
    const reading = summarizeEvent('detected', {
      detected_via: 'stale_recovery',
      source_comment_url: PR_URL,
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
      source_comment_url: `${PR_URL}#pullrequestreview-note`,
    });
    expect(reading).toStrictEqual([textToken('via open-PR scan')]);
  });

  it('returns an empty reading for enqueued events, whose payload is empty', () => {
    expect(summarizeEvent('enqueued', {})).toStrictEqual([]);
  });

  it('renders linked source and retriggered comment ids for a retrigger', () => {
    const reading = summarizeEvent('retriggered', {
      source_comment_url: SOURCE_COMMENT_URL,
      retriggered_comment_url: RETRIGGERED_COMMENT_URL,
    });
    expect(reading).toStrictEqual([
      linkToken(`source comment ${SOURCE_COMMENT_ID}`, SOURCE_COMMENT_URL),
      textToken(' → '),
      linkToken(`comment ${RETRIGGERED_COMMENT_ID}`, RETRIGGERED_COMMENT_URL),
    ]);
  });

  it('renders only the source comment when the retriggered comment is missing', () => {
    const reading = summarizeEvent('retriggered', {
      source_comment_url: SOURCE_COMMENT_URL,
    });
    expect(reading).toStrictEqual([linkToken(`source comment ${SOURCE_COMMENT_ID}`, SOURCE_COMMENT_URL)]);
  });

  it('renders only the retriggered comment when the source comment is missing', () => {
    const reading = summarizeEvent('retriggered', {
      retriggered_comment_url: RETRIGGERED_COMMENT_URL,
    });
    expect(reading).toStrictEqual([linkToken(`comment ${RETRIGGERED_COMMENT_ID}`, RETRIGGERED_COMMENT_URL)]);
  });

  it('returns an empty reading for a retrigger with no comment urls', () => {
    expect(summarizeEvent('retriggered', {})).toStrictEqual([]);
  });

  it('renders a comment link and run token for an approved review verdict', () => {
    const reading = summarizeEvent('coderabbit_review_approved', {
      coderabbit_comment_url: VERDICT_COMMENT_URL,
      coderabbit_run_id: '9b30c77d',
    });
    expect(reading).toStrictEqual([linkToken(`comment ${VERDICT_COMMENT_ID}`, VERDICT_COMMENT_URL), textToken(' · '), textToken('run 9b30c77d')]);
  });

  it('renders a comment link and run token for a changes-suggested review verdict', () => {
    const reading = summarizeEvent('coderabbit_review_changes_suggested', {
      coderabbit_comment_url: CHANGES_SUGGESTED_COMMENT_URL,
      coderabbit_run_id: '9b30c77d',
    });
    expect(reading).toStrictEqual([
      linkToken(`comment ${CHANGES_SUGGESTED_COMMENT_ID}`, CHANGES_SUGGESTED_COMMENT_URL),
      textToken(' · '),
      textToken('run 9b30c77d'),
    ]);
  });

  it('returns an empty reading for a review verdict with no tokens', () => {
    expect(summarizeEvent('coderabbit_review_changes_suggested', {})).toStrictEqual([]);
  });

  it('renders the skip reason for a skipped review', () => {
    const reading = summarizeEvent('coderabbit_review_skipped', {
      skip_reason: 'walkthrough declined by author',
    });
    expect(reading).toStrictEqual([textToken('walkthrough declined by author')]);
  });

  it('renders a comment link for a skipped review with no skip reason', () => {
    const reading = summarizeEvent('coderabbit_review_skipped', {
      comment_url: SKIPPED_COMMENT_URL,
    });
    expect(reading).toStrictEqual([linkToken(`comment ${SKIPPED_COMMENT_ID}`, SKIPPED_COMMENT_URL)]);
  });

  it('returns an empty reading for a skipped review with neither reason nor comment', () => {
    expect(summarizeEvent('coderabbit_review_skipped', {})).toStrictEqual([]);
  });

  it('renders a comment link and new run token when a run id is first seen', () => {
    const reading = summarizeEvent('coderabbit_run_id_first_seen', {
      comment_id: 1,
      comment_url: RUN_ID_COMMENT_URL,
      coderabbit_run_id: RUN_ID,
    });
    expect(reading).toStrictEqual([linkToken('comment 1', RUN_ID_COMMENT_URL), textToken(' · '), textToken(`new run ${RUN_ID}`)]);
  });

  it('renders a plain comment token when a numeric comment id has no url', () => {
    const reading = summarizeEvent('coderabbit_run_id_first_seen', {
      comment_id: 1,
      coderabbit_run_id: RUN_ID,
    });
    expect(reading).toStrictEqual([textToken('comment 1'), textToken(' · '), textToken(`new run ${RUN_ID}`)]);
  });

  it('links a comment token derived from a string comment id', () => {
    const reading = summarizeEvent('coderabbit_run_id_first_seen', {
      comment_id: RUN_ID_COMMENT_URL,
    });
    expect(reading).toStrictEqual([linkToken(`comment ${RUN_ID_COMMENT_ID}`, RUN_ID_COMMENT_URL)]);
  });

  it('renders a linked comment token for a digit-only string comment id', () => {
    const reading = summarizeEvent('coderabbit_run_id_first_seen', {
      comment_id: DIGIT_ONLY_COMMENT_ID,
      comment_url: RUN_ID_COMMENT_URL,
    });
    expect(reading).toStrictEqual([linkToken(`comment ${DIGIT_ONLY_COMMENT_ID}`, RUN_ID_COMMENT_URL)]);
  });

  it('renders a plain comment token for a digit-only string comment id with no url', () => {
    const reading = summarizeEvent('coderabbit_run_id_first_seen', {
      comment_id: DIGIT_ONLY_COMMENT_ID,
    });
    expect(reading).toStrictEqual([textToken(`comment ${DIGIT_ONLY_COMMENT_ID}`)]);
  });

  it('renders previous and new run tokens when a run id changes', () => {
    const reading = summarizeEvent('coderabbit_run_id_changed', {
      previous_coderabbit_run_id: RUN_ID,
      coderabbit_run_id: '9b30c77d',
    });
    expect(reading).toStrictEqual([textToken(`run ${RUN_ID} → 9b30c77d`)]);
  });

  it('returns an empty reading when a run id change has no previous run id', () => {
    expect(summarizeEvent('coderabbit_run_id_changed', { coderabbit_run_id: '9b30c77d' })).toStrictEqual([]);
  });

  it('renders a comment link and removed previous run token when a run id is cleared', () => {
    const reading = summarizeEvent('coderabbit_run_id_cleared', {
      comment_id: 4,
      comment_url: RUN_ID_COMMENT_URL,
      previous_coderabbit_run_id: PREVIOUS_RUN_ID,
    });
    expect(reading).toStrictEqual([linkToken('comment 4', RUN_ID_COMMENT_URL), textToken(' · '), textToken(`previous run ${PREVIOUS_RUN_ID} removed`)]);
  });

  it('renders only the removed previous run when a run id is cleared without a comment', () => {
    const reading = summarizeEvent('coderabbit_run_id_cleared', {
      previous_coderabbit_run_id: PREVIOUS_RUN_ID,
    });
    expect(reading).toStrictEqual([textToken(`previous run ${PREVIOUS_RUN_ID} removed`)]);
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

  it('returns an empty reading for an unrecognized event type', () => {
    expect(summarizeEvent('future_event_type', {})).toStrictEqual([]);
  });
});
