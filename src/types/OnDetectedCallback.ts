import type { DetectedComment } from './index.js';

export type OnDetectedCallback = (comment: DetectedComment, pullRequestId: number) => Promise<void>;
