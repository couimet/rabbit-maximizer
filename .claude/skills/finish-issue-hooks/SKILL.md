---
name: finish-issue-hooks
description: Additional verification for /finish-issue — lint before format
user-invocable: false
---

# Finish-Issue Hooks

Consulted automatically by `/finish-issue`.

## Additional Verification

Before the standard format step, run **`pnpm fix`** (`pnpm lint:fix && pnpm format:fix`). The parent skill runs `pnpm format:fix` alone — this adds lint checking. Fix any lint errors before proceeding.
