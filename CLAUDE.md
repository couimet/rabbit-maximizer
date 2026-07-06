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
