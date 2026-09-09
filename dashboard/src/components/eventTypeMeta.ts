import { EventType } from '../../../src/domain.js';

/**
 * One color class per semantic family, applied to the timeline node, the
 * legend dot, and the Summary tile. `unknown` is the neutral fallback for an
 * event type this build does not recognize.
 */
export type EventFamily = 'life' | 'fail' | 'verdict' | 'book' | 'unknown';

export interface EventTypeMeta {
  readonly label: string;
  readonly family: EventFamily;
}

export const EVENT_FAMILY_LABEL: Record<EventFamily, string> = {
  life: 'lifecycle',
  fail: 'failure',
  verdict: 'verdict',
  book: 'run-id bookkeeping',
  unknown: 'unknown',
};

/** The four semantic families in display order for the legend and foot-note. */
export const KNOWN_EVENT_FAMILIES: readonly EventFamily[] = ['life', 'fail', 'verdict', 'book'];

export const EVENT_TYPE_META: Record<EventType, EventTypeMeta> = {
  [EventType.detected]: { label: 'Review-limit detected', family: 'life' },
  [EventType.enqueued]: { label: 'Enqueued', family: 'life' },
  [EventType.retriggered]: { label: 'Retrigger posted', family: 'life' },
  [EventType.dismissed]: { label: 'Dismissed', family: 'life' },
  [EventType.failed]: { label: 'Failed', family: 'fail' },
  [EventType.coderabbit_review_approved]: { label: 'Review approved', family: 'verdict' },
  [EventType.coderabbit_review_changes_suggested]: { label: 'Changes suggested', family: 'verdict' },
  [EventType.coderabbit_review_skipped]: { label: 'Review skipped', family: 'verdict' },
  [EventType.coderabbit_run_id_first_seen]: { label: 'Run ID seen', family: 'book' },
  [EventType.coderabbit_run_id_changed]: { label: 'Run ID changed', family: 'book' },
  [EventType.coderabbit_run_id_cleared]: { label: 'Run ID cleared', family: 'book' },
};

/** Resolve a type to its vocabulary meta; unrecognized types keep their raw type visible on a neutral family. */
export const getEventTypeMeta = (type: EventType | string): EventTypeMeta => EVENT_TYPE_META[type as EventType] ?? { label: type, family: 'unknown' };
