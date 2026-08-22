# @couimet/execution-context

Execution context for async jobs: `ExecutionContext.run()` primes a correlation id, a request id, and arbitrary attributes; every log line and probe event emitted inside the run carries them. The three priming sites are the bootstrap (app startup), a request (one per HTTP request), and a timer run (one per scheduler tick).

## Package family

The package holds only the primitives: the runner, the id value objects (`CorrelationId`, `RequestId`), attributes, and error codes. Transport and framework concerns live in companion packages, with the integration named in the suffix:

- `@couimet/execution-context-http` holds the HTTP transport constants (`x-correlation-id`, `x-request-id`). It has no framework dependency.
- `@couimet/execution-context-http-express` holds the express integration: the request-context middleware (`executionContext`, plus the labeled `labeledExecutionContext` for the ordered middleware arrays), `createExpressAppWithExecutionContext` (which registers it as the first middleware), and `useExecutionContext(app)` for hand-built apps.
- `@couimet/logger-enricher-execution-context` enriches logger entries with the ids from the current execution context.

## Extending to other frameworks

Because the transport constants stay framework-free, an adapter for another framework slots in as its own `@couimet/execution-context-http-*` package: the middleware reads the header names from `@couimet/execution-context-http`, wraps `ExecutionContext.run()` with `attributes: ExecutionContext.getAttributes()` exactly like the express middleware, and lives in a package named after its framework (e.g. `@couimet/execution-context-http-middy`, `@couimet/execution-context-http-koa`). The core never learns about a framework.

## Usage

```typescript
import { ExecutionContext } from '@couimet/execution-context';

ExecutionContext.run({ correlationId: 'my-job', requestId: 'abc-123' }, () => {
  // logs and probes inside here carry correlation_id and request_id
});
```

Missing ids are generated (`fromStringOrCreate`); `fromString` rejects blank values with a `DetailedError` from `@couimet/detailed-error`, whose codes live in `ExecutionContextErrorCodes`.
