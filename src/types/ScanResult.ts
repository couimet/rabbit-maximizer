import type { ScannedPR } from './index.js';

export interface ScanResult {
  readonly opened: number;
  readonly updated: number;
  readonly scannedPRs: readonly ScannedPR[];
}
