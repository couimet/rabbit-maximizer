/**
 * Barrel for standalone domain types, constants, and utilities at the src/ root.
 * These files have no circular dependencies on each other through this barrel,
 * so ESM initialization is safe.
 *
 * Files with internal dependencies (config, container, express, etc.) belong in
 * services.ts or are imported directly from their source files.
 */
export { ActivityState } from './ActivityState.js';
export { CodeRabbitCommentType } from './CodeRabbitCommentType.js';
export { DismissalReason } from './DismissalReason.js';
export { EventType } from './EventType.js';
export { FallbackReason } from './FallbackReason.js';
export { IntervalService } from './IntervalService.js';
export { TYPES } from './inversify-types.js';
export { isProduction } from './isProduction.js';
export { MatchedMarker } from './MatchedMarker.js';
export { getPrStateFromGitHubValue, PrState } from './PrState.js';
export { QueueStatus } from './QueueStatus.js';
export { RabbitResult } from './RabbitResult.js';
export { Resolution } from './Resolution.js';
export { ReviewDetectionMethod } from './ReviewDetectionMethod.js';
export { SchedulerStatus } from './SchedulerStatus.js';
export { SkipReason } from './SkipReason.js';
export { TriggerSource } from './TriggerSource.js';
