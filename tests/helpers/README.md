# Test Helpers

## createMockOctokit

Returns `{ octokit, rest: { search, issues } }` where the `rest` handles are the same JavaScript objects wired into `octokit.rest`. Mutating a handle takes effect immediately — no reassignment needed.

```ts
const { octokit, rest: { search, issues } } = createMockOctokit();

// Default — all methods are jest.fn<any>(). Methods default to returning
// undefined; override with .mockResolvedValue() or .mockReturnValue().
issues.createComment.mockResolvedValue({ data: { html_url: "..." } });
search.issuesAndPullRequests.mockResolvedValue({ data: { items: [] } });

const client = new CoderabbitGitHubClientImpl(octokit, logger);
// ...
expect(issues.createComment).toHaveBeenCalledWith({...});
```

Callers that need custom defaults pass them through `options.rest`:

```ts
const {
  octokit,
  rest: { issues },
} = createMockOctokit({
  rest: { issues: { getComment: customMock } },
});
```

Add methods to `MockSearchRest` / `MockIssuesRest` and the factory body when the production code starts using new `rest.*` endpoints.

## createMockLogger

```ts
import { createMockLogger } from './helpers/index.js';
const logger = createMockLogger();
// logger.debug, logger.info, logger.warn, logger.error are all jest.fn()
```

Local stand-in for `@couimet/logger-contract-testing`'s `createMockLogger`, which cannot run under ESM Jest until https://github.com/couimet/ts-npm-packages/issues/29 ships.

## createResolvedMock

```ts
import { createResolvedMock } from './helpers/index.js';
const mock = createResolvedMock({ data: { html_url: '...' } });
// equivalent to jest.fn<any>().mockResolvedValue({ data: { html_url: "..." } })
```
