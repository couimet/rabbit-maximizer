import type { DetectedComment } from './DetectedComment.js';

export type OnDetectedCallback = (comment: DetectedComment, waitSeconds: number) => Promise<void>;
