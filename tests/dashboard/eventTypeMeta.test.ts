import { EVENT_FAMILY_LABEL, EVENT_TYPE_META, getEventTypeMeta, KNOWN_EVENT_FAMILIES } from '../../dashboard/src/components/eventTypeMeta.js';

import { describe, expect, it } from '@jest/globals';

describe('eventTypeMeta', () => {
  it('freezes the family labels and ordering', () => {
    expect(KNOWN_EVENT_FAMILIES).toStrictEqual(['life', 'fail', 'verdict', 'book']);
    expect(EVENT_FAMILY_LABEL).toStrictEqual({
      life: 'lifecycle',
      fail: 'failure',
      verdict: 'verdict',
      book: 'run-id bookkeeping',
      unknown: 'unknown',
    });
  });

  it('freezes the label and family for every known event type', () => {
    expect(EVENT_TYPE_META).toStrictEqual({
      detected: { label: 'Review-limit detected', family: 'life' },
      enqueued: { label: 'Enqueued', family: 'life' },
      retriggered: { label: 'Retrigger posted', family: 'life' },
      dismissed: { label: 'Dismissed', family: 'life' },
      failed: { label: 'Failed', family: 'fail' },
      coderabbit_review_approved: { label: 'Review approved', family: 'verdict' },
      coderabbit_review_changes_suggested: { label: 'Changes suggested', family: 'verdict' },
      coderabbit_review_skipped: { label: 'Review skipped', family: 'verdict' },
      coderabbit_run_id_first_seen: { label: 'Run ID seen', family: 'book' },
      coderabbit_run_id_changed: { label: 'Run ID changed', family: 'book' },
      coderabbit_run_id_cleared: { label: 'Run ID cleared', family: 'book' },
    });
  });

  it('returns the metadata for a known event type', () => {
    expect(getEventTypeMeta('detected')).toStrictEqual({ label: 'Review-limit detected', family: 'life' });
    expect(getEventTypeMeta('failed')).toStrictEqual({ label: 'Failed', family: 'fail' });
  });

  it('falls back to an unknown family for an unrecognized type, keeping the raw type as label', () => {
    expect(getEventTypeMeta('future_event_type')).toStrictEqual({ label: 'future_event_type', family: 'unknown' });
  });
});
