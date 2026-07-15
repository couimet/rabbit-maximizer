---
name: finish-issue-hook
description: Additional verification for /finish-issue — build and check generated drift
user-invocable: false
---

# Finish-Issue Hook

Consulted automatically by `/finish-issue`.

## Additional Verification

1. **`pnpm build`** — catches TypeScript errors and stale Prisma types.
2. **`pnpm ci:check-generated-drift`** — ensures generated API types match the OpenAPI spec.
