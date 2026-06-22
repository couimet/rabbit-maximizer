# Locally incubating shared packages

Writing a shared library in its own repo before the API has been battle-tested is a grind. Every change needs a publish (or `npm link` gymnastics), a consumer update, and a deploy before you learn whether the interface feels right. The feedback loop is measured in days, and most of those days are waiting.

## The pattern: incubate inside your own repo

Build the module directly inside the service that needs it. Treat it as if it were already published under its eventual org and package name. The directory structure mirrors that future home:

```
src/external-deps/<org>/<package>/   ← e.g. couimet/express-tools
```

Consumer code imports from this path as though it were a real package:

```typescript
import { createExpressApp } from '../external-deps/couimet/express-tools/createExpressApp.js';
```

## Why this works

Real usage feedback lands immediately. The API is exercised by production code from day one. If a function signature is awkward, you feel it the moment you wire it up, not days later when someone opens a PR against the shared-package repo. Refactoring is cheap because the module and its only consumer share a working tree.

## The lifecycle

1. Build the smallest API surface the current use case needs. Keep it focused. Write tests alongside the production consumer.
2. Ship it as part of the parent service and let it run for a while. See whether the abstractions survive real traffic, messy logs, and edge cases you didn't think of.
3. Once the API has settled, contribute the module upstream through a PR. File paths, tests, and docs transfer as-is. If you are still making breaking changes, it is not ready.
4. After the shared package ships, add it to `package.json`, `pnpm install`, run a mechanical find-and-replace from `../external-deps/<org>/<package>/` (or `../../`, `../../../`, depending on depth) to `@<org>/<package>` across every import path, and delete the incubated copy.

## What this is not

This is not copy-paste, and it's not vendoring. Vendoring pins something that already exists. Incubation builds something that doesn't. The only reason the directory lives here is that its real home hasn't been built yet. The exit plan is part of it from the start.
