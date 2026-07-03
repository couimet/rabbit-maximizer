# @couimet/express-tools

Batteries-included Express application factory. Helmet, request logging, and a composable middleware map out of the box.

## Install

```bash
pnpm add @couimet/express-tools
```

## Usage

```typescript
import { buildDefaultMiddlewares, createExpressApp, createMorganMiddleware, MiddlewareIdentifier } from '@couimet/express-tools';
import { getLogger } from '@couimet/logger-contract';

const logger = getLogger();

// Defaults: helmet on, request logging via morgan
const app = createExpressApp({ logger });

// Disable helmet
const app = createExpressApp({ logger, helmet: false });

// Replace or extend default middleware
const app = createExpressApp({
  logger,
  middlewares: {
    ...buildDefaultMiddlewares({ logger }),
    [MiddlewareIdentifier.MORGAN]: createMorganMiddleware({ format: ':method :url', logger }),
  },
});
```

## API

### `createExpressApp(options?)`

Returns a configured Express `Application`. Options:

| Option        | Default        | Description                                            |
| ------------- | -------------- | ------------------------------------------------------ |
| `helmet`      | `true`         | Helmet security headers                                |
| `logger`      | `getLogger()`  | Logger for lifecycle and request events                |
| `middlewares` | built defaults | Keyed middleware map. Replaces defaults when provided. |

### `createMorganMiddleware(options?)`

Returns a morgan request-logging middleware wired to the given logger:

```typescript
import { createMorganMiddleware } from '@couimet/express-tools';
import { getLogger } from '@couimet/logger-contract';

const logger = getLogger();
app.use(createMorganMiddleware({ logger }));
app.use(createMorganMiddleware({ format: ':method :url', logger }));
```

## License

MIT
