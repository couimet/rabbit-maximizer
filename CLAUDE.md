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
