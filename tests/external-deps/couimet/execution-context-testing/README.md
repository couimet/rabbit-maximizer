# @couimet/execution-context-testing

Incubation of a testing companion for the published `@couimet/execution-context`.

This folder is not a copy of a package. It holds the two helpers this repo needs to test code that reads or adds execution-context attributes, plus the tests for those helpers. Every consumer imports it by relative path.

## Helpers

`withTestExecutionContext(params, fn)` runs `fn` inside a fresh context. Pass `undefined` for `params` to let the helper generate the trace ids, or pass a `RunParams` to pin the ids a test asserts against.

`spyOnAttributeAdditions()` replaces `ExecutionContext.addAttributes` with a spy that still calls through, so a test asserts exactly which additions the code made. `restoreMocks` removes the spy after each test.

## Promotion

This folder is one of two incubations that belong to the same centralization round between this repo and `ts-npm-packages`. The other is `withAttributes`, at `src/external-deps/couimet/execution-context/src/withAttributes.ts`, which is a proposed `ExecutionContext.withAttributes()` method for the same published package.

The day both ship, the two folders are deleted. The `withAttributes` call sites move to `@couimet/execution-context`, and the imports here move to `@couimet/execution-context-testing`.

The keys the helpers carry stay owned by the consumer: `correlation_id` and `request_id` come from `logger-enricher-execution-context`, and `run_id` and `version` come from the application. The package must not name them.
