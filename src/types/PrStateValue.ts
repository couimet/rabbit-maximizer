export const PR_STATE = {
  OPEN: 'open',
  MERGED: 'merged',
  CLOSED: 'closed',
} as const;

export type PrStateValue = (typeof PR_STATE)[keyof typeof PR_STATE];
