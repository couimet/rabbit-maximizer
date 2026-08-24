# @couimet/express-tools

Batteries-included Express application factory. Helmet, request-start logging, morgan completion logging, and ordered middleware arrays with optional labels out of the box.

## Install

```bash
pnpm add @couimet/express-tools
```

## Usage

```typescript
import { buildDefaultMiddlewares, createExpressApp, createMorganMiddleware } from '@couimet/express-tools';
import { getLogger } from '@couimet/logger-contract';

const logger = getLogger();

// Defaults: helmet on, request-start and morgan completion logging
const app = createExpressApp({ logger });

// Disable helmet
const app = createExpressApp({ logger, helmet: false });

// Replace or extend default middleware entries; labeled entries log their name at registration
const app = createExpressApp({
  logger,
  middlewares: [...buildDefaultMiddlewares({ logger }), { label: 'custom', handler: customMiddleware }],
});
```

## API

### `createExpressApp(options?)`

Returns a configured Express `Application`. Options:

| Option              | Default                 | Description                                                                                                                                                 |
| ------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `helmet`            | `true`                  | Helmet security headers                                                                                                                                     |
| `logger`            | `getLogger()`           | Logger for lifecycle and request events                                                                                                                     |
| `beforeMiddlewares` | `[]`                    | Ordered entries registered first, before helmet and `middlewares`. No default entries: omitted or empty registers nothing                                   |
| `middlewares`       | inbound logger + morgan | Ordered entries, each a handler or a `{ label, handler }` wrapper; labeled entries log their name at registration. Replaces defaults entirely when provided |

### `createMorganMiddleware(options?)`

Returns a morgan request-logging middleware wired to the given logger:

```typescript
import { createMorganMiddleware } from '@couimet/express-tools';
import { getLogger } from '@couimet/logger-contract';

const logger = getLogger();
app.use(createMorganMiddleware({ logger }));
app.use(createMorganMiddleware({ format: ':method :url', logger }));
```

### Execution-context integration

`createExpressApp` stays framework-generic and knows nothing about execution contexts. The execution-context middleware lives in `@couimet/execution-context-http-express`, which exports `createExpressAppWithExecutionContext` (the same factory with the context middleware registered first as a labeled `beforeMiddlewares` entry) and `useExecutionContext(app)` for hand-built apps.

### `useInboundRequestLogger(app, logger)`

Registers a middleware that logs the start of each request (`Request started: METHOD url`) with the method, `originalUrl`, and `url` as attributes. It complements morgan's completion line: the two share the request ids, so a slow or hanging request stays visible while in flight instead of appearing only when it finishes. `createExpressApp` includes it in the default middlewares; call it yourself only when building an app by hand. Place it after `useExecutionContext` so the started line carries the request ids.

## License

MIT
