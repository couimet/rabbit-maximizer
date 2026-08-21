import { CodeRabbitCommentType, PrState, QueueStatus, TriggerSource } from '../../src/domain.js';

import { describe, expect, it } from '@jest/globals';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS_ROOT = join(process.cwd(), 'prisma', 'migrations');
const VALUE_PATTERN = /'([^']+)'/g;

const CHECK_CONTRACTS: readonly [table: string, column: string, enumMembers: readonly string[]][] = [
  ['coderabbit_comment', 'comment_type', Object.values(CodeRabbitCommentType)],
  ['review_queue', 'status', Object.values(QueueStatus)],
  ['review_queue', 'trigger_source', Object.values(TriggerSource)],
  ['pull_request', 'pr_state', Object.values(PrState)],
];

// CHECK text names the column but not its table, so column names must be unique
// across tables for the newest-definition scan to stay unambiguous.
const newestCheckValues = (column: string): string[] | undefined => {
  const pattern = new RegExp(`CHECK\\s*\\(\\s*"${column}"\\s+IN \\(([^)]*)\\)`, 'g');
  let latest: string[] | undefined;
  for (const dir of readdirSync(MIGRATIONS_ROOT).sort()) {
    if (!statSync(join(MIGRATIONS_ROOT, dir)).isDirectory()) continue;
    const sql = readFileSync(join(MIGRATIONS_ROOT, dir, 'migration.sql'), 'utf8');
    const matches = [...sql.matchAll(pattern)];
    if (matches.length === 0) continue;
    const values = [...matches[matches.length - 1][1].matchAll(VALUE_PATTERN)].map((m) => m[1]);
    if (values.length > 0) latest = values.sort();
  }
  return latest;
};

describe('enum CHECK contract', () => {
  it.each(CHECK_CONTRACTS)('the newest migration CHECK on %s.%s covers exactly the enum members', (_table, column, enumMembers) => {
    expect(newestCheckValues(column)).toStrictEqual([...enumMembers].sort());
  });
});
