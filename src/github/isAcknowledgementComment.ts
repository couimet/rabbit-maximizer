import { REVIEW_BOT_ACKNOWLEDGEMENT_MARKER } from '../types/coderabbit.js';

export function isAcknowledgementComment(body: string | null | undefined): boolean {
  return (body ?? '').includes(REVIEW_BOT_ACKNOWLEDGEMENT_MARKER);
}
