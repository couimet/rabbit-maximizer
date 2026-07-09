# @couimet/detailed-result

Functional `Result<T, E>` type for explicit error handling without try/catch. Pairs with `@couimet/detailed-error` for structured error information.

## Install

```bash
pnpm add @couimet/detailed-result
```

## Usage

```typescript
import { DetailedResult } from '@couimet/detailed-result';
import { DetailedError } from '@couimet/detailed-error';

function divide(a: number, b: number): DetailedResult<number, DetailedError> {
  if (b === 0) {
    return DetailedResult.err(new DetailedError({ code: 'DIVISION_BY_ZERO', message: 'Cannot divide by zero' }));
  }
  return DetailedResult.ok(a / b);
}

const result = divide(10, 2);
if (result.success) {
  console.log(result.value); // 5
} else {
  console.log(result.error.message);
}
```

## API

### `DetailedResult.ok(value)`

Creates a successful result wrapping `value`.

### `DetailedResult.err(error)`

Creates an error result wrapping `error`.

### `.success`

Returns `true` for ok results, `false` for err results. Check before accessing `.value` or `.error`.

### `.value`

Returns the wrapped value. Throws `DetailedError` with code `RESULT_VALUE_ACCESS_ON_ERROR` if called on an error result.

### `.error`

Returns the wrapped error. Throws `DetailedError` with code `RESULT_ERROR_ACCESS_ON_SUCCESS` if called on a success result.

## License

MIT
