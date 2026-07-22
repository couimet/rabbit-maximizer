# CLAUDE.md

Project-specific guidance for Claude Code.

Rule IDs use `<category><number>`: **C** for code, **P** for practice (applies everywhere), **T** for tests. Numbered sequentially from 1 within each category.

<rule id="C001" priority="critical">
  <title>No narrating comments</title>
  <never>Add comments that simply describe what the code does (the code is self-documenting)</never>
  <do>Only add comments for non-obvious behavior, gotchas, or "why" explanations</do>
  <bad-examples>
    - `// Create mock objects`
    - `// Configure adapter with options`
    - `// First item should be X`
  </bad-examples>
  <good-examples>
    - `// Workaround for VSCode API limitation`
    - `// Using raw value 2 to test external contract (not enum reference)`
  </good-examples>
</rule>

<rule id="C002" priority="critical">
  <title>couimet/* GitHub Actions always use @main</title>
  <never>Pin a `couimet/*` GitHub Action to a commit SHA in CI workflows</never>
  <do>Always reference `couimet/*` actions with `@main` to get the latest version</do>
  <rationale>The author wants these actions to auto-update across all repos</rationale>
</rule>

<rule id="C003" priority="critical">
  <title>switch default blocks use forUnexpectedSwitchDefault() and are tested</title>
  <do>End every switch with a `default` that throws via `RabbitMaximizerError.forUnexpectedSwitchDefault()`. Test the default path. Only use `/* c8 ignore */` when the default is provably unreachable through the public API (e.g. all enum members exhaustively handled and mapped).</do>
  <do>Import `toBeDetailedError` or `toThrowDetailedError` from `@couimet/detailed-error-testing` to assert the thrown error's code, message, functionName, and details</do>
  <never>Use `/* c8 ignore */` on a switch default that can be reached by tests — write the test instead</never>
  <rationale>The default is a safety net for future values. `forUnexpectedSwitchDefault()` standardizes the error shape (code, message, unexpectedValue in details). Testing it verifies both the error factory and the call site.</rationale>
  <good-example>
    ```typescript
    switch (config.column) {
      case 'value_text':
        data = { ...base, value_text: value as string };
        break;
      case 'value_datetime':
        data = { ...base, value_datetime: (value as Date).toISOString() };
        break;
      /* c8 ignore next 3 — unreachable: every StateKey maps to a handled column */
      default:
        throw RabbitMaximizerError.forUnexpectedSwitchDefault('state column', config.column, 'SystemStateRepositoryImpl.setState');
    }
    ```
  </good-example>
</rule>

<rule id="C004" priority="critical">
  <title>Logger is always the last constructor parameter</title>
  <do>Place `@inject(TYPES.Logger) private readonly log: Logger` as the last parameter in every DI constructor</do>
  <never>Add Logger anywhere other than last in the constructor parameter list</never>
  <rationale>Consistent ordering makes constructors predictable and diffs cleaner</rationale>
</rule>

<rule id="C005" priority="critical">
  <title>Regenerate Prisma client after schema changes</title>
  <do>Run `prisma generate` after any change to `prisma/schema.prisma`, including branch switches that bring in schema changes from other PRs</do>
  <do>Run `prisma generate` before `tsc` — the build script (`pnpm build`) does this automatically</do>
  <never>Skip `prisma generate` after a schema change — stale generated types cause runtime `P2022` errors (column not found) that tests won't catch if the build itself fails silently</never>
  <rationale>The generated Prisma client in `node_modules/.pnpm/@prisma+client*/node_modules/.prisma/client/` must match the current schema. A branch switch or schema edit can desynchronize them. Running `prisma generate` is cheap (~50ms) and prevents hard-to-diagnose runtime crashes from stale column references.</rationale>
</rule>

<rule id="C006" priority="critical">
  <title>Use null for intentionally absent values in UI components, not undefined</title>
  <do>Use `null` as the initializer for `useState` (e.g., `useState<Foo | null>(null)`) and as the empty sentinel in nullable props in React components</do>
  <do>Guard with `!value` — it catches both `null` and `undefined` at runtime</do>
  <never>Use `undefined` as an explicit sentinel for "no value" — reserve it for "not provided" (omitted optional prop, missing map key)</never>
  <rationale>`null` is explicit — you wrote it, you meant it. `undefined` is ambient (missing prop, uninitialized variable). Using `null` for intentional absence makes the intent clear and keeps UI component code internally consistent.</rationale>
</rule>

<rule id="C007" priority="critical">
  <title>API layer uses UUIDs, not integer IDs</title>
  <do>Identify resources by UUID in all API route params, request bodies, and client calls</do>
  <do>Use `isValidUuid()` from `src/utils/uuidLookup.js` for request validation</do>
  <do>Resolve UUIDs to internal integer IDs at the repository boundary via `resolveUuidsToIds()` or `findByUuid()` from the same module</do>
  <never>Expose integer database IDs in API paths (e.g. `/queue/:id`), request bodies (e.g. `queueItemIds`), or API client function signatures</never>
  <rationale>Integer IDs are internal implementation details. UUIDs decouple API consumers from database internals and prevent enumeration attacks.</rationale>
</rule>

<rule id="C008" priority="critical">
  <title>No default parameter values</title>
  <never>Use default parameter values in function signatures (`paused = false`, `timeout = 5000`)</never>
  <do>Make every parameter required. Callers must pass every argument explicitly</do>
  <do>Combine with `?:` optional markers only when the caller genuinely may omit the value and the function handles `undefined` explicitly</do>
  <rationale>Default values create falsy traps (`''`, `0`, `false`, `null` all trigger the default, not just `undefined`). Required parameters force call sites to be explicit, making intent visible and contracts harder to accidentally break. Optional `?:` without defaults is acceptable when absence has a clear semantic meaning distinct from any falsy value.</rationale>
  <bad-example>
    ```typescript
    // BAD: falsy trap — paused={false} still gets defaulted
    const QueueOrder = ({ paused = false }: { paused?: boolean }) => { ... }
    ```
  </bad-example>
  <good-example>
    ```typescript
    // GOOD: required — every caller must think about paused
    const QueueOrder = ({ paused }: { paused: boolean }) => { ... }
    ```
  </good-example>
</rule>

<rule id="C009" priority="critical">
  <title>Log the full error from Result-based methods, not just its code</title>
  <do>Pass the full error object (e.g., `result.error`) as a log attribute when logging a failure from a Result-based method</do>
  <never>Log only `error.code` or `error.message` — the structured details (code, message, functionName, details) are lost</never>
  <rationale>A `DetailedError` carries code, message, functionName, and an arbitrary details object. Logging just the code drops everything else — the message explains what happened, functionName pinpoints the source, and details carries operation-specific context (notBefore, sourceComment, etc.). Passing the full error preserves all of it in structured log output.</rationale>
</rule>

<rule id="C010" priority="critical">
  <title>Migrations must carry forward all indexes and constraints on table rebuilds</title>
  <do>When a migration copies a table via `CREATE TABLE ..._new ... INSERT INTO ..._new SELECT ... FROM ... DROP TABLE ... ALTER TABLE ..._new RENAME TO ...`, recreate every index, unique constraint, and CHECK constraint that existed on the original table (unless the business rules intentionally changed)</do>
  <do>Audit the original table's indexes and constraints before writing the rebuild block. Compare the `CREATE INDEX` / constraint statements after the rename against the original schema's DDL or a prior migration that created the table</do>
  <never>Recreate only a subset of indexes after a table rebuild — missing constraints silently allow invalid data (duplicate UUIDs, duplicate pending PRs) that the application assumes cannot exist</never>
  <rationale>SQLite requires full table rebuilds for schema changes (CHECK constraint modifications, column additions). It is easy to recreate the explicitly-changed constraint and forget the unchanged ones. A missing `review_queue_pending_unique` partial unique index allowed duplicate pending entries for the same PR, silently breaking the scheduler's assumption of at most one pending item per PR. This has happened multiple times (20260716, 20260707).</rationale>
</rule>

<rule id="C011" priority="critical">
  <title>Probes own all observability for a business process</title>
  <do>Create exactly one probe per business process, at the top, via `ProbeFactory`</do>
  <do>Name probe methods as past-tense domain verbs describing what happened: `retriggered()`, `failed()`, `backedOff()`, `queueItemNotFound()`</do>
  <do>Put all event recording AND business-outcome logging inside the probe — even on branches that do not record an event</do>
  <do>Pass a domain object (`QueueItem`, `uuid`) to the factory method, never an `ObservationContext`</do>
  <do>Keep all entity mutations in the caller — the probe never touches the entity it observes. The caller updates state, then tells the probe what happened (see `MarkQueueItemReviewedProbe`)</do>
  <never>Create two probes for the same business process — merge them</never>
  <never>Prefix probe method names with `record` — the caller describes the outcome, not the mechanism</never>
  <never>Duplicate a business-outcome log in both the caller and the probe</never>
  <never>Pass `ObservationContext` into a factory method — the factory calls `this.observation.current()` internally</never>
  <exception>When the SAME observation context instance must be shared between a probe and other code in the same flow (e.g. both the probe and `createDetectedProbe()` receive `obs`), extract it once in the caller and pass to both. This is the only valid reason for a factory method to accept `ObservationContext`. See `EnqueueService.handle`: `obs` is shared with `createDetectedProbe(context, obs)` and the detection probe.</exception>
  <rationale>A probe represents one business process end-to-end. It owns every observable trace — events AND logs — so callers stay focused on control flow and their own entity. See `src/probes/README.md` for the full decision framework.</rationale>
  <see>src/probes/README.md</see>
</rule>

<rule id="C012" priority="critical">
  <title>Every import comes from the source file or a same-directory barrel</title>
  <do>Import symbols from the file that defines them, or from a same-directory barrel file that only re-exports its sibling files</do>
  <do>Use barrel files to aggregate exports within a single directory, providing a shorter import path for consumers</do>
  <do>Only re-export the directory's public API through the barrel — symbols exported solely for testing (e.g., internal lookup tables, column mappers) belong to the source file and must not appear in the barrel</do>
  <never>Re-export a symbol from one directory or package through a barrel file in a different directory (e.g., do not have `prisma-repo/index.ts` re-export `SoftDeleteConfig` from `prisma-extension-soft-delete`)</never>
  <never>Import a symbol through a barrel that lives outside the symbol's defining directory</never>
  <rationale>Cross-directory re-exports create invisible coupling, make refactoring harder (changing the source requires updating the shim), and mislead readers about where a symbol actually lives. Same-directory barrels are fine — they act as namespace indexes for their own directory's exports, reduce import path verbosity, and make future linting rules (removing redundant folder segments) possible. Barrels are the public API of a directory — testing-only exports are imported directly from the source file, keeping the barrel surface intentional.</rationale>
  <good-example>
    ```typescript
    // GOOD: test imports testing-only export directly from the source file
    import { VALUE_SETTER } from '../../src/db/systemStateRepository.js';
    ```
  </good-example>
  <bad-example>
    ```typescript
    // BAD: VALUE_SETTER is exported for testing only — not part of the public API
    export { VALUE_SETTER } from './systemStateRepository.js';
    ```
  </bad-example>
</rule>

<rule id="T001" priority="critical">
  <title>No .not.toThrow() for happy paths</title>
  <do>Call function directly — Jest fails automatically on unexpected exceptions</do>
  <never>Use `expect(() => fn()).not.toThrow()` for happy path tests</never>
  <good-example>
    ```typescript
    validateInputSelection(input); // Direct call — clearer intent
    ```
  </good-example>
  <bad-example>
    ```typescript
    expect(() => validateInputSelection(input)).not.toThrow(); // Unnecessary
    ```
  </bad-example>
</rule>

<rule id="T002" priority="critical">
  <title>Use .toStrictEqual() for objects and arrays</title>
  <do>Use `.toStrictEqual()` when asserting objects or arrays</do>
  <never>Use `.toEqual()` or `.toMatchObject()` for objects and arrays — they are lenient matchers that hide unexpected properties</never>
  <scope>Objects and arrays only — primitives (strings, booleans, numbers) don't need this</scope>
  <rationale>Catches undefined vs missing properties, stricter type checking</rationale>
</rule>

<rule id="T003" priority="critical">
  <title>Literal values for contract assertions</title>
  <scope>Applies to expect() assertions only, NOT test setup/mocks</scope>
  <do>Use string literals in assertions for our own enum values: `expect(x).toBe('Regular')`</do>
  <do>Use string literals in assertions for user-facing text: `expect(x).toBe('RangeLink Menu')`</do>
  <do>Use string literals in assertions for config keys: `expect(x).toBe('delimiterLine')`</do>
  <setup>Enum values ARE allowed in test setup (mocks, fixtures) for type safety</setup>
  <exception>External library enums in assertions: use actual constant</exception>
  <see>T009 — T009 takes precedence when a literal is shared between test setup and assertions. T003 is about freezing production contracts (enum values, user-facing text, config keys); T009 is about preventing drift in test-internal data plumbing between setup and assertions.</see>
  <rationale>Assertions freeze contracts — catches accidental enum/text changes. Setup code benefits from type safety.</rationale>
  <bad-example>
    ```typescript
    // BAD: enum in assertion — won't catch if enum value changes
    expect(result.linkType).toBe(LinkType.Regular);
    ```
  </bad-example>
  <good-example>
    ```typescript
    // GOOD: Setup uses enum for type safety
    const mockParsedLink: ParsedLink = { linkType: LinkType.Regular };

    // GOOD: Assertions use literals to freeze contract
    expect(result.linkType).toBe('regular');
    ```

  </good-example>
</rule>

<rule id="T004" priority="critical">
  <title>No partial matchers</title>
  <never>Use `expect.objectContaining()` or `expect.stringContaining()`</never>
  <do>Assert exact values — if the full object is too verbose, extract relevant fields first</do>
  <rationale>Partial matchers hide unexpected properties and make tests less precise</rationale>
</rule>

<rule id="T005" priority="critical">
  <title>No manual mock cleanup</title>
  <never>Use `afterEach(() => { jest.clearAllMocks(); })` or similar manual cleanup</never>
  <rationale>Jest config already has `clearMocks`, `resetMocks`, `restoreMocks` set to `true`</rationale>
  <see>jest.config.js</see>
</rule>

<rule id="T006" priority="critical">
  <title>Use toHaveBeenCalledWith for mock assertions</title>
  <do>Use `.toHaveBeenCalledWith(param1, param2, ...)` to verify mock call parameters</do>
  <never>Access `.mock.calls[0]` to extract and assert parameters separately</never>
  <bad-example>
    ```typescript
    const [items] = mockFn.mock.calls[0];
    expect(items[0]).toStrictEqual({ label: "foo" });
    ```
  </bad-example>
  <good-example>
    ```typescript
    expect(mockFn).toHaveBeenCalledWith(
      [{ label: "foo" }, { label: "bar" }],
      { option: "value" },
    );
    ```
  </good-example>
</rule>

<rule id="T007" priority="critical">
  <title>Always test logging behavior</title>
  <do>Include logger assertions in tests that verify method behavior — logging provides critical visibility for debugging</do>
  <never>Create separate tests just for logging — consolidate with behavior tests</never>
  <rationale>Log statements are part of the method contract; they provide visibility needed when bugs are reported</rationale>
  <good-example>
    ```typescript
    it("creates and configures component", () => {
      myComponent.initialize();

      expect(mockDependency.create).toHaveBeenCalledWith(config);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        { fn: "MyComponent.initialize" },
        "Component initialized",
      );
    });
    ```

  </good-example>
</rule>

<rule id="T008" priority="critical">
  <title>Import jest from @jest/globals</title>
  <do>Import `jest` from `@jest/globals` when using `jest.spyOn`, `jest.fn`, or `jest.mock` in ESM test files</do>
  <rationale>Jest 30 no longer provides global types; all Jest APIs must be explicitly imported</rationale>
</rule>

<rule id="T009" priority="critical">
  <title>Extract shared test literals into constants</title>
  <do>Extract any literal (string, number, date) used in a test setup block that is also referenced in assertions into a named SCREAMING_SNAKE_CASE constant</do>
  <do>For timestamps shared between setup (ISO format) and assertions (display format), define the ISO constant and derive the display constant via `formatDate(ISO_CONST, 'UTC')`</do>
  <never>Duplicate a literal in both a `beforeEach`/setup block and an assertion — extract it so the two stays are linked by a single source of truth</never>
  <rationale>Prevents "magic number" drift between setup data and expected values. When a test fails because the setup value changed, the assertion message shows the constant name rather than a stale literal.</rationale>
  <see>T003 — T009 takes precedence over T003 for test-internal plumbing values (mock props, fixture data). T003 governs assertions against production contract values (enums, user-facing text). Favor `getUniqueString()` or `getUniqueInt()` from `@couimet/dynamic-testing` over static literals for shared constants — dynamic values prove the value is passed through rather than matching a hardcoded default at the destination. Exception: UI component tests (React Testing Library) that look up elements by text content (`getByText`, `getByRole`) need static literal strings that match what the component renders.</see>
</rule>

<rule id="T010" priority="critical">
  <title>Schema validation tests go in tests/schemas/ — do not duplicate in tests/config.test.ts</title>
  <do>Test Zod schema behavior (field validation, `.default()` values, `.positive()` checks, `superRefine` rules) in `tests/schemas/config.test.ts` via `ConfigSchema.safeParse()`</do>
  <do>Test only what `parseConfig()` adds on top in `tests/config.test.ts`: env-var preprocessing (`emptyToUndefined`), repo-filter parsing (`parseRepoFilter`), and error message formatting (path + message joining)</do>
  <never>Duplicate schema-level validation tests in `tests/config.test.ts` — `parseConfig()` delegates to `ConfigSchema.safeParse()`, so schema behavior is already covered</never>
  <rationale>Schema tests are the source of truth for validation behavior. Duplicating them in the config parser test file creates maintenance burden (two places to update for one rule change) and blurs the boundary between "what the schema enforces" and "what the parser transforms."</rationale>
  <good-example>
    ```typescript
    // tests/schemas/config.test.ts — tests the schema directly
    it('rejects SCHEDULER_RETRIGGER_SPACING_SEC lower than POLL_INTERVAL_SEC', () => {
      const result = ConfigSchema.safeParse({ ...BASE, SCHEDULER_RETRIGGER_SPACING_SEC: 30, POLL_INTERVAL_SEC: 90 });
      expect(result.success).toBe(false);
    });
    ```
  </good-example>
  <bad-example>
    ```typescript
    // tests/config.test.ts — DO NOT do this; it duplicates the schema test
    it('fails when SCHEDULER_RETRIGGER_SPACING_SEC is lower than POLL_INTERVAL_SEC', () => {
      const result = parseConfig(env(BASE, { SCHEDULER_RETRIGGER_SPACING_SEC: '30', POLL_INTERVAL_SEC: '90' }));
      expect(result.success).toBe(false);
    });
    ```
  </bad-example>
</rule>

<rule id="T011" priority="critical">
  <title>Local variables use camelCase, not SCREAMING_SNAKE_CASE</title>
  <do>Use camelCase for `const` variables local to a test function (`const commentId = getUniqueInt()`)</do>
  <do>Reserve SCREAMING_SNAKE_CASE for module-level constants and values shared between `beforeEach`/setup blocks and assertions (see T009)</do>
  <never>Use SCREAMING_SNAKE_CASE for `const` variables declared inside `it()` blocks — they are regular local variables, not contract constants</never>
  <rationale>SCREAMING_SNAKE_CASE signals "this value is a frozen contract" (per T003, T009). Local test variables are plumbing, not contracts. Using the wrong case misleads the reader about the variable's role.</rationale>
  <bad-example>
    ```typescript
    it('returns the correct value', () => {
      const COMMENT_ID = getUniqueInt();
      const REPO_NAME = getUniqueGitHubRepoRef().fullName;
      // ...
    });
    ```
  </bad-example>
  <good-example>
    ```typescript
    it('returns the correct value', () => {
      const commentId = getUniqueInt();
      const repoName = getUniqueGitHubRepoRef().fullName;
      // ...
    });
    ```
  </good-example>
</rule>

<rule id="P001" priority="critical">
  <title>No magic numbers</title>
  <do>Define named constants for all numeric literals with semantic meaning</do>
  <do>Use SCREAMING_SNAKE_CASE for constant names</do>
</rule>

<rule id="P002" priority="critical">
  <title>Never stage without approval</title>
  <never>Run `git add` or `git stage` without explicit user approval</never>
  <rationale>The user stages files manually while reviewing changes</rationale>
</rule>

<rule id="P003" priority="critical">
  <title>API clients throw; callers catch and decide</title>
  <do>Let API client methods (Octokit wrappers, HTTP calls) propagate errors to callers without internal try/catch</do>
  <do>Catch errors at call sites and handle contextually — retry, skip the item and continue, fall back to a safe default, or rethrow if truly unrecoverable</do>
  <never>Swallow errors inside API client methods — callers cannot react to what they cannot see</never>
  <rationale>Thin clients are composable and testable. The caller knows the context: a scheduler tick should skip one bad item and continue; an enqueue should fall back to optimistic enqueue; a startup validation should fail fast. The client cannot know which context it runs in.</rationale>
  <good-example>
    ```typescript
    // Client: thin wrapper, no try/catch
    async getPRState(repo: string, pr: number): Promise<PRState> {
      const { owner, repo: repoName } = splitRepo(repo);
      const response = await this.octokit.rest.pulls.get({ owner, repo: repoName, pull_number: pr });
      return { state: response.data.state, merged_at: response.data.merged_at };
    }

    // Caller: catches and decides
    try {
      prState = await this.github.getPRState(repo, pr);
    } catch (err: unknown) {
      this.log.warn({ fn: 'handle', repo, pr, error: err }, 'Failed to fetch PR state; proceeding with enqueue');
    }
    ```

  </good-example>
  <bad-example>
    ```typescript
    // BAD: client swallows the error — callers can't distinguish "open" from "API error"
    async getPRState(repo: string, pr: number): Promise<PRState | null> {
      try {
        const response = await this.octokit.rest.pulls.get({ ... });
        return { state: response.data.state, merged_at: response.data.merged_at };
      } catch {
        return null;
      }
    }
    ```
  </bad-example>
</rule>

<rule id="P004" priority="critical">
  <title>Run pnpm fix after editing files</title>
  <do>Run `pnpm fix` after every set of file edits — it runs `eslint --fix` and `prettier --write` to normalize formatting and fix auto-fixable lint violations</do>
  <rationale>Keeps the diff clean of formatting noise. Linter auto-fixes handle import sorting, whitespace, and other mechanical concerns.</rationale>
</rule>

<rule id="P005" priority="critical">
  <title>Extract small functional utilities into standalone modules</title>
  <do>Extract pure functions (parsers, validators, extractors, formatters) into standalone utility modules under `src/utils/` with their own isolated unit tests</do>
  <do>Name the utility file after the function it exports (e.g., `src/utils/extractCommentId.ts` exports `extractCommentId`)</do>
  <do>Export from `src/utils/index.ts` barrel file</do>
  <never>Define utility functions inline inside repository classes or service files — these are harder to discover, test in isolation, and reuse</never>
  <rationale>Small functional utilities are the most reusable and testable units of code. Extracting them eliminates duplication, makes tests focused and fast (no DI/mocking needed), and signals intent clearly through the filename. This is the single most impactful habit for keeping the codebase composable.</rationale>
</rule>

<rule id="P006" priority="critical">
  <title>Resolve the database path via scripts/db/data-dir.sh, never guess it</title>
  <do>Use `bash scripts/db/data-dir.sh` to get the data directory before running any `sqlite3`, `prisma`, or other database command</do>
  <do>Construct the database path as `$(bash scripts/db/data-dir.sh)/rabbit-maximizer.db`</do>
  <never>Assume the database is at `data/rabbit-maximizer.db` relative to the current working directory — the repo uses git worktrees, and all worktrees share a single database in the main repository's `data/` directory</never>
  <rationale>The `local` script in `package.json` overrides `DATABASE_URL` at startup with `file:$(bash scripts/db/data-dir.sh)/rabbit-maximizer.db`, which resolves to the main repo's data directory (not the worktree's). The `.env` file's `DATABASE_URL=file:./data/rabbit-maximizer.db` is a relative fallback that may point to the wrong location when working from a worktree. Querying the wrong database leads to false conclusions — an empty database looks like a broken app when the real database is healthy.</rationale>
</rule>

<rule id="P007" priority="critical">
  <title>Constructors must not call new() on collaborators</title>
  <do>Inject a factory interface when a class needs to instantiate another class. The factory is registered in the DI container and injected via the constructor.</do>
  <do>Follow the existing `ProbeFactory` pattern: define a factory interface, bind it in `container.ts`, inject it in the consuming class's constructor, and call `factory.create()` at the point of use.</do>
  <never>Call `new` on a collaborator class inside a constructor or method of an @injectable() class</never>
  <rationale>Inlined `new()` calls couple the parent to a concrete implementation, making unit testing harder (can't mock the collaborator) and violating the Dependency Inversion Principle. Factory injection keeps the container as the single source of wiring while allowing instances to be created at runtime with their own DI-resolved dependencies.</rationale>
  <good-example>
    ```typescript
    @injectable()
    class PollDetector extends IntervalService {
      constructor(
        @inject(TYPES.ReviewCompletionGuardFactory) private readonly reviewCompletionGuardFactory: ReviewCompletionGuardFactory,
        @inject(TYPES.Logger) log: Logger,
      ) {
        super(log, POLL_INTERVAL_MS);
      }
      private async someMethod() {
        const guard = this.reviewCompletionGuardFactory.create();
        const hasReview = await guard.hasCompletedReview(prId);
      }
    }
    ```
  </good-example>
  <bad-example>
    ```typescript
    @injectable()
    class PollDetector extends IntervalService {
      private async someMethod() {
        const guard = new ReviewCompletionGuard(this.coderabbitCommentRepo); // BAD: inline new()
        const hasReview = await guard.hasCompletedReview(prId);
      }
    }
    ```
  </bad-example>
</rule>
