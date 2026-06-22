import { REVIEW_BOT_SELF_MARKER_PREFIX } from '../types/coderabbit.js';

/** Check if a comment body contains this tool's own marker (prevents self-retriggering). */
export const hasOwnRetriggerMarker = (body: string): boolean => body.includes(REVIEW_BOT_SELF_MARKER_PREFIX);
