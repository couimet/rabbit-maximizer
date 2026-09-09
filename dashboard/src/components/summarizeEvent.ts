import { CommentDetectionMethod, DismissalReason, EventType } from '../../../src/domain.js';

/**
 * Plain-language reading of an event's payload, shown under the vocabulary
 * label on the timeline. Returns an empty token list when the payload carries
 * nothing to say (e.g. enqueued, whose payload is empty) so the entry renders
 * label-only. Comment ids come back as link tokens so the timeline can open
 * the comment in a new tab.
 */
type EventPayload = Readonly<Record<string, unknown>>;

export interface ReadingTextToken {
  readonly kind: 'text';
  readonly value: string;
}

export interface ReadingLinkToken {
  readonly kind: 'link';
  readonly value: string;
  readonly url: string;
}

export type ReadingToken = ReadingTextToken | ReadingLinkToken;

const TOKEN_SEPARATOR = ' · ';
const ARROW = ' → ';

const text = (value: string): ReadingTextToken => ({ kind: 'text', value });
const link = (value: string, url: string): ReadingLinkToken => ({ kind: 'link', value, url });

const readString = (payload: EventPayload, key: string): string | undefined => {
  const value = payload[key];
  return typeof value === 'string' && value !== '' ? value : undefined;
};

const commentLabel = (id: string): string => `comment ${id}`;
const sourceCommentLabel = (id: string): string => `source comment ${id}`;
const runLabel = (runId: string): string => `run ${runId}`;

/** Links a GitHub comment URL, taking the id from its trailing numeric segment (e.g. `…#issuecomment-227104133`). */
const commentTokenFromUrl = (value: unknown, label: (id: string) => string): ReadingToken | undefined => {
  if (typeof value !== 'string') return undefined;
  const match = value.match(/(\d+)$/);
  return match ? link(label(match[1]), value) : undefined;
};

const commentTokenFromPayload = (payload: EventPayload): ReadingToken | undefined => {
  const raw = payload.comment_id;
  if (typeof raw !== 'number') return commentTokenFromUrl(raw, commentLabel);
  const url = readString(payload, 'comment_url');
  return url !== undefined ? link(commentLabel(String(raw)), url) : text(commentLabel(String(raw)));
};

const joinTokens = (parts: ReadonlyArray<ReadingToken | undefined>): ReadingToken[] => {
  const present = parts.filter((part): part is ReadingToken => part !== undefined && part.value !== '');
  return present.flatMap((part, index) => (index === 0 ? [part] : [text(TOKEN_SEPARATOR), part]));
};

const detectedReading = (payload: EventPayload): ReadingToken[] => {
  // A recovered comment was deleted, so its recorded URL is the PR, not a comment; only the mechanism is meaningful.
  if (payload.detected_via === CommentDetectionMethod.StaleRecovery) return [text('recovered from deleted comment')];
  const mechanism =
    payload.detected_via === CommentDetectionMethod.Search
      ? text('via comment search')
      : payload.detected_via === CommentDetectionMethod.DirectScan
        ? text('via open-PR scan')
        : undefined;
  const runId = readString(payload, 'coderabbit_run_id');
  return joinTokens([mechanism, runId !== undefined ? text(runLabel(runId)) : undefined, commentTokenFromUrl(payload.source_comment_url, commentLabel)]);
};

const retriggeredReading = (payload: EventPayload): ReadingToken[] => {
  const source = commentTokenFromUrl(payload.source_comment_url, sourceCommentLabel);
  const retriggered = commentTokenFromUrl(payload.retriggered_comment_url, commentLabel);
  if (source !== undefined && retriggered !== undefined) return [source, text(ARROW), retriggered];
  if (source !== undefined) return [source];
  if (retriggered !== undefined) return [retriggered];
  return [];
};

const reviewVerdictReading = (payload: EventPayload): ReadingToken[] => {
  const runId = readString(payload, 'coderabbit_run_id');
  return joinTokens([commentTokenFromUrl(payload.coderabbit_comment_url, commentLabel), runId !== undefined ? text(runLabel(runId)) : undefined]);
};

const runIdBookkeepingReading = (payload: EventPayload, changed: 'seen' | 'changed' | 'cleared'): ReadingToken[] => {
  const comment = commentTokenFromPayload(payload);
  const runId = readString(payload, 'coderabbit_run_id');
  const previousRunId = readString(payload, 'previous_coderabbit_run_id');
  switch (changed) {
    case 'seen':
      return joinTokens([comment, runId !== undefined ? text(`new ${runLabel(runId)}`) : undefined]);
    case 'changed':
      return joinTokens([comment, previousRunId !== undefined && runId !== undefined ? text(`${runLabel(previousRunId)}${ARROW}${runId}`) : undefined]);
    case 'cleared':
      return joinTokens([comment, previousRunId !== undefined ? text(`previous ${runLabel(previousRunId)} removed`) : undefined]);
  }
};

const dismissedReading = (payload: EventPayload): ReadingToken[] => {
  const reason = readString(payload, 'reason');
  const phrase = reason !== undefined ? (DISMISSAL_REASON_PHRASE[reason as DismissalReason] ?? '') : '';
  return phrase !== '' ? [text(phrase)] : [];
};

const failedReading = (payload: EventPayload): ReadingToken[] => {
  const reason = readString(payload, 'reason');
  if (reason !== undefined) return [text(reason)];
  const count = payload.retrigger_count;
  const max = payload.max;
  if (typeof count === 'number' && typeof max === 'number') return [text(`after ${count} of ${max} retriggers`)];
  return [];
};

const DISMISSAL_REASON_PHRASE: Record<DismissalReason, string> = {
  [DismissalReason.other]: '',
  [DismissalReason.prClosedWithoutMerge]: 'PR closed without merge',
  [DismissalReason.prDeleted]: 'PR deleted',
  [DismissalReason.prMerged]: 'PR already merged',
  [DismissalReason.prNotRegistered]: 'PR not registered',
  [DismissalReason.staleComment]: 'Stale review-limit comment',
};

export const summarizeEvent = (type: EventType | string, payload: EventPayload): readonly ReadingToken[] => {
  if (type === EventType.detected) return detectedReading(payload);
  if (type === EventType.enqueued) return [];
  if (type === EventType.retriggered) return retriggeredReading(payload);
  if (type === EventType.coderabbit_review_approved) return reviewVerdictReading(payload);
  if (type === EventType.coderabbit_review_changes_suggested) return reviewVerdictReading(payload);
  if (type === EventType.coderabbit_review_skipped) {
    const skipReason = readString(payload, 'skip_reason');
    if (skipReason !== undefined) return [text(skipReason)];
    const comment = commentTokenFromUrl(payload.comment_url, commentLabel);
    return comment !== undefined ? [comment] : [];
  }
  if (type === EventType.coderabbit_run_id_first_seen) return runIdBookkeepingReading(payload, 'seen');
  if (type === EventType.coderabbit_run_id_changed) return runIdBookkeepingReading(payload, 'changed');
  if (type === EventType.coderabbit_run_id_cleared) return runIdBookkeepingReading(payload, 'cleared');
  if (type === EventType.dismissed) return dismissedReading(payload);
  if (type === EventType.failed) return failedReading(payload);
  return [];
};
