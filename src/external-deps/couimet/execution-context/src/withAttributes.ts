import { type ContextAttributes, ExecutionContext } from '@couimet/execution-context';

// Incubation for ts-npm-packages: this is meant to be ported as `ExecutionContext.withAttributes()`.
// A standalone wrapper is the simplest way to integrate it here in the meantime, because the published
// class has a private constructor (TS2675) and private store accessors, so no local subclass can reach
// the store and only its public statics are available to compose. Once the method ships upstream, this
// folder is deleted and the call site imports it from `@couimet/execution-context` directly.

/**
 * Layers `attrs` over the active execution context for the duration of `fn`, then removes them: the
 * surrounding context holds its own attributes again once `fn` settles, whether it returned or threw.
 *
 * The ids are read before entering the child scope, so the block keeps the ids it inherited. Work
 * started inside the block but finishing after it keeps the layered attributes, because that is what
 * an async context means. Attributes the block sets itself, including one that collides with a key
 * layered here, die with the block; a caller that needs an attribute to outlive the block sets it
 * outside the block. Throws NO_ACTIVE_CONTEXT outside any run, and the package's own
 * INVALID_CONTEXT_ATTRIBUTES when `attrs` is not a record of string keys.
 */
export const withAttributes = <T>(attrs: ContextAttributes, fn: () => T): T =>
  ExecutionContext.run(
    {
      correlationId: ExecutionContext.correlationId.toString(),
      requestId: ExecutionContext.requestId.toString(),
      attributes: { ...ExecutionContext.getAttributes() },
    },
    () => {
      // addAttributes carries the package's own parameter check, which a spread of the merged bag
      // would bypass, and it writes only into the store this call created.
      ExecutionContext.addAttributes(attrs);
      return fn();
    },
  );
