import { CorrelationId } from './correlationId.js';
import { ExecutionContextErrorCodes } from './executionContextErrorCodes.js';
import { RequestId } from './requestId.js';

import { DetailedError } from '@couimet/detailed-error';
import { context, createContextKey } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';

export type ContextAttributes = Record<string, unknown>;

type ContextData = {
  correlationId: CorrelationId;
  requestId: RequestId;
  attributes: ContextAttributes;
};

export interface RunParams {
  readonly correlationId: string | undefined;
  readonly requestId: string | undefined;
  readonly attributes?: ContextAttributes;
}

const EXECUTION_CONTEXT_KEY = createContextKey('ExecutionContext');

export class ExecutionContext {
  private static contextInitialized = false;

  /* c8 ignore next 1 — uninstantiable: static-only class, constructor unreachable */
  private constructor() {}

  /**
   * Idempotent: the global context manager must be installed exactly once,
   * before any context is primed.
   */
  static ensureContextManagerInitialized(): void {
    if (!ExecutionContext.contextInitialized) {
      const manager = new AsyncLocalStorageContextManager().enable();
      context.setGlobalContextManager(manager);
      ExecutionContext.contextInitialized = true;
    }
  }

  private static getStore(): ContextData | undefined {
    return context.active().getValue(EXECUTION_CONTEXT_KEY) as ContextData | undefined;
  }

  /**
   * Primes the execution context; anything previously set gets wiped.
   * Call sites are the app bootstrap, middleware priming the context from a
   * request, and timer runs scoping a single execution.
   */
  static run<T>(data: RunParams, fn: () => T): T {
    this.ensureContextManagerInitialized();

    const newContext: ContextData = {
      correlationId: CorrelationId.fromStringOrCreate(data.correlationId),
      requestId: RequestId.fromStringOrCreate(data.requestId),
      attributes: data.attributes ?? {},
    };

    const ctx = context.active().setValue(EXECUTION_CONTEXT_KEY, newContext);
    return context.with(ctx, fn);
  }

  static isActive(): boolean {
    return this.getStore() !== undefined;
  }

  // The ids are guaranteed when the context is active; a missing store is a programming error.
  private static requireStore(): ContextData {
    const store = this.getStore();
    if (store === undefined) {
      throw new DetailedError({
        code: ExecutionContextErrorCodes.NO_ACTIVE_CONTEXT,
        message: 'execution context is not active',
        functionName: 'ExecutionContext.requireStore',
        details: {},
      });
    }
    return store;
  }

  static get correlationId(): CorrelationId {
    return this.requireStore().correlationId;
  }

  static get requestId(): RequestId {
    return this.requireStore().requestId;
  }

  static getAttribute(key: string): unknown {
    return this.getStore()?.attributes?.[key];
  }

  static addAttributes(attrs: ContextAttributes): void {
    const store = this.getStore();
    if (!store) return;

    store.attributes = {
      ...store.attributes,
      ...attrs,
    };
  }

  static getAttributes(): ContextAttributes {
    return this.getStore()?.attributes ?? {};
  }
}
