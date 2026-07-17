/** Strip `undefined` values via JSON round-trip to match Express's `res.json()` behavior. */
export const apiJson = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
