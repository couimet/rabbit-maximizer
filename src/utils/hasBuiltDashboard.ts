import { existsSync } from 'node:fs';
import path from 'node:path';

/**
 * Reports whether a directory holds the built dashboard. The production mount
 * serves that directory, and a missing `index.html` leaves every page at 404
 * with no other signal.
 */
export const hasBuiltDashboard = (servedDir: string): boolean => existsSync(path.join(servedDir, 'index.html'));
