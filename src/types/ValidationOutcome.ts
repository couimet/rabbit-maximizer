import type { CommentDetails } from './CommentDetails.js';

export type ValidationOutcome = { action: 'proceed' } | { action: 'reschedule'; notBefore: Date; sourceComment: CommentDetails } | { action: 'skip' };
