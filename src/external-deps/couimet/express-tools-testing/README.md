# @couimet/express-tools-testing

Thin test helper wrapping `createExpressApp` for route-level integration tests. Creates an Express app on an ephemeral port, registers handlers via a callback, and returns the server and port in a single object.

## Install

```bash
pnpm add -D @couimet/express-tools-testing
```

## API

### `startTestServer(logger, register)`

Returns `TestServer`.

| Param      | Type                         | Description                                     |
| ---------- | ---------------------------- | ----------------------------------------------- |
| `logger`   | `Logger`                     | Logger passed to `createExpressApp`             |
| `register` | `(app: Application) => void` | Callback that registers route handlers on `app` |

### `TestServer`

| Key      | Type     | Description                     |
| -------- | -------- | ------------------------------- |
| `server` | `Server` | The HTTP server (for `close()`) |
| `port`   | `number` | The assigned ephemeral port     |

## License

MIT
