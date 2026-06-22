import type { RateLimitComment } from './RateLimitComment.js';

export type OnDetectedCallback = (comment: RateLimitComment, waitSeconds: number) => Promise<void>;
