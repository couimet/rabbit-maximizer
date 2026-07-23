import type { DetectedComment } from './index.js';

export type OnDetectedCallback = (comment: DetectedComment, waitSeconds: number, pullRequestId: number) => Promise<void>;
