import type { ReviewLimitComment } from './ReviewLimitComment.js';

export type OnDetectedCallback = (comment: ReviewLimitComment, waitSeconds: number) => Promise<void>;
