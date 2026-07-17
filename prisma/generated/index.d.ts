/**
 * Client
 **/

import * as runtime from '@prisma/client/runtime/client.js';
import $Types = runtime.Types; // general types
import $Public = runtime.Types.Public;
import $Utils = runtime.Types.Utils;
import $Extensions = runtime.Types.Extensions;
import $Result = runtime.Types.Result;

export type PrismaPromise<T> = $Public.PrismaPromise<T>;

/**
 * Model PullRequest
 *
 */
export type PullRequest = $Result.DefaultSelection<Prisma.$PullRequestPayload>;
/**
 * Model ReviewQueue
 * Tracks a PR that needs (or has received) a review retrigger.
 */
export type ReviewQueue = $Result.DefaultSelection<Prisma.$ReviewQueuePayload>;
/**
 * Model Event
 * Append-only record of every lifecycle event (detected, enqueued, posted, etc.).
 */
export type Event = $Result.DefaultSelection<Prisma.$EventPayload>;
/**
 * Model QueueOrder
 * Determines the effective processing order of the pending queue.
 */
export type QueueOrder = $Result.DefaultSelection<Prisma.$QueueOrderPayload>;
/**
 * Model SystemState
 * Operational state values (poll health, scheduler status, countdown).
 */
export type SystemState = $Result.DefaultSelection<Prisma.$SystemStatePayload>;

/**
 * ##  Prisma Client ʲˢ
 *
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```
 * const prisma = new PrismaClient({
 *   adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
 * })
 * // Fetch zero or more PullRequests
 * const pullRequests = await prisma.pullRequest.findMany()
 * ```
 *
 *
 * Read more in our [docs](https://pris.ly/d/client).
 */
export class PrismaClient<
  ClientOptions extends Prisma.PrismaClientOptions = Prisma.PrismaClientOptions,
  const U = 'log' extends keyof ClientOptions
    ? ClientOptions['log'] extends Array<Prisma.LogLevel | Prisma.LogDefinition>
      ? Prisma.GetEvents<ClientOptions['log']>
      : never
    : never,
  ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
> {
  [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['other'] };

  /**
   * ##  Prisma Client ʲˢ
   *
   * Type-safe database client for TypeScript & Node.js
   * @example
   * ```
   * const prisma = new PrismaClient({
   *   adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
   * })
   * // Fetch zero or more PullRequests
   * const pullRequests = await prisma.pullRequest.findMany()
   * ```
   *
   *
   * Read more in our [docs](https://pris.ly/d/client).
   */

  constructor(optionsArg?: Prisma.Subset<ClientOptions, Prisma.PrismaClientOptions>);
  $on<V extends U>(eventType: V, callback: (event: V extends 'query' ? Prisma.QueryEvent : Prisma.LogEvent) => void): PrismaClient;

  /**
   * Connect with the database
   */
  $connect(): $Utils.JsPromise<void>;

  /**
   * Disconnect from the database
   */
  $disconnect(): $Utils.JsPromise<void>;

  /**
   * Executes a prepared raw query and returns the number of affected rows.
   * @example
   * ```
   * const result = await prisma.$executeRaw`UPDATE User SET cool = ${true} WHERE email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://pris.ly/d/raw-queries).
   */
  $executeRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Executes a raw query and returns the number of affected rows.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$executeRawUnsafe('UPDATE User SET cool = $1 WHERE email = $2 ;', true, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://pris.ly/d/raw-queries).
   */
  $executeRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Performs a prepared raw query and returns the `SELECT` data.
   * @example
   * ```
   * const result = await prisma.$queryRaw`SELECT * FROM User WHERE id = ${1} OR email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://pris.ly/d/raw-queries).
   */
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<T>;

  /**
   * Performs a raw query and returns the `SELECT` data.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$queryRawUnsafe('SELECT * FROM User WHERE id = $1 OR email = $2;', 1, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://pris.ly/d/raw-queries).
   */
  $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<T>;

  /**
   * Allows the running of a sequence of read/write operations that are guaranteed to either succeed or fail as a whole.
   * @example
   * ```
   * const [george, bob, alice] = await prisma.$transaction([
   *   prisma.user.create({ data: { name: 'George' } }),
   *   prisma.user.create({ data: { name: 'Bob' } }),
   *   prisma.user.create({ data: { name: 'Alice' } }),
   * ])
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/orm/prisma-client/queries/transactions).
   */
  $transaction<P extends Prisma.PrismaPromise<any>[]>(
    arg: [...P],
    options?: { maxWait?: number; timeout?: number; isolationLevel?: Prisma.TransactionIsolationLevel },
  ): $Utils.JsPromise<runtime.Types.Utils.UnwrapTuple<P>>;

  $transaction<R>(
    fn: (prisma: Omit<PrismaClient, runtime.ITXClientDenyList>) => $Utils.JsPromise<R>,
    options?: { maxWait?: number; timeout?: number; isolationLevel?: Prisma.TransactionIsolationLevel },
  ): $Utils.JsPromise<R>;

  $extends: $Extensions.ExtendsHook<
    'extends',
    Prisma.TypeMapCb<ClientOptions>,
    ExtArgs,
    $Utils.Call<
      Prisma.TypeMapCb<ClientOptions>,
      {
        extArgs: ExtArgs;
      }
    >
  >;

  /**
   * `prisma.pullRequest`: Exposes CRUD operations for the **PullRequest** model.
   * Example usage:
   * ```ts
   * // Fetch zero or more PullRequests
   * const pullRequests = await prisma.pullRequest.findMany()
   * ```
   */
  get pullRequest(): Prisma.PullRequestDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.reviewQueue`: Exposes CRUD operations for the **ReviewQueue** model.
   * Example usage:
   * ```ts
   * // Fetch zero or more ReviewQueues
   * const reviewQueues = await prisma.reviewQueue.findMany()
   * ```
   */
  get reviewQueue(): Prisma.ReviewQueueDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.event`: Exposes CRUD operations for the **Event** model.
   * Example usage:
   * ```ts
   * // Fetch zero or more Events
   * const events = await prisma.event.findMany()
   * ```
   */
  get event(): Prisma.EventDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.queueOrder`: Exposes CRUD operations for the **QueueOrder** model.
   * Example usage:
   * ```ts
   * // Fetch zero or more QueueOrders
   * const queueOrders = await prisma.queueOrder.findMany()
   * ```
   */
  get queueOrder(): Prisma.QueueOrderDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.systemState`: Exposes CRUD operations for the **SystemState** model.
   * Example usage:
   * ```ts
   * // Fetch zero or more SystemStates
   * const systemStates = await prisma.systemState.findMany()
   * ```
   */
  get systemState(): Prisma.SystemStateDelegate<ExtArgs, ClientOptions>;
}

export namespace Prisma {
  export import DMMF = runtime.DMMF;

  export type PrismaPromise<T> = $Public.PrismaPromise<T>;

  /**
   * Validator
   */
  export import validator = runtime.Public.validator;

  /**
   * Prisma Errors
   */
  export import PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError;
  export import PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError;
  export import PrismaClientRustPanicError = runtime.PrismaClientRustPanicError;
  export import PrismaClientInitializationError = runtime.PrismaClientInitializationError;
  export import PrismaClientValidationError = runtime.PrismaClientValidationError;

  /**
   * Re-export of sql-template-tag
   */
  export import sql = runtime.sqltag;
  export import empty = runtime.empty;
  export import join = runtime.join;
  export import raw = runtime.raw;
  export import Sql = runtime.Sql;

  /**
   * Decimal.js
   */
  export import Decimal = runtime.Decimal;

  export type DecimalJsLike = runtime.DecimalJsLike;

  /**
   * Extensions
   */
  export import Extension = $Extensions.UserArgs;
  export import getExtensionContext = runtime.Extensions.getExtensionContext;
  export import Args = $Public.Args;
  export import Payload = $Public.Payload;
  export import Result = $Public.Result;
  export import Exact = $Public.Exact;

  /**
   * Prisma Client JS version: 7.8.0
   * Query Engine version: 3c6e192761c0362d496ed980de936e2f3cebcd3a
   */
  export type PrismaVersion = {
    client: string;
    engine: string;
  };

  export const prismaVersion: PrismaVersion;

  /**
   * Utility Types
   */

  export import Bytes = runtime.Bytes;
  export import JsonObject = runtime.JsonObject;
  export import JsonArray = runtime.JsonArray;
  export import JsonValue = runtime.JsonValue;
  export import InputJsonObject = runtime.InputJsonObject;
  export import InputJsonArray = runtime.InputJsonArray;
  export import InputJsonValue = runtime.InputJsonValue;

  /**
   * Types of the values used to represent different kinds of `null` values when working with JSON fields.
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  namespace NullTypes {
    /**
     * Type of `Prisma.DbNull`.
     *
     * You cannot use other instances of this class. Please use the `Prisma.DbNull` value.
     *
     * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
     */
    class DbNull {
      private DbNull: never;
      private constructor();
    }

    /**
     * Type of `Prisma.JsonNull`.
     *
     * You cannot use other instances of this class. Please use the `Prisma.JsonNull` value.
     *
     * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
     */
    class JsonNull {
      private JsonNull: never;
      private constructor();
    }

    /**
     * Type of `Prisma.AnyNull`.
     *
     * You cannot use other instances of this class. Please use the `Prisma.AnyNull` value.
     *
     * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
     */
    class AnyNull {
      private AnyNull: never;
      private constructor();
    }
  }

  /**
   * Helper for filtering JSON entries that have `null` on the database (empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const DbNull: NullTypes.DbNull;

  /**
   * Helper for filtering JSON entries that have JSON `null` values (not empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const JsonNull: NullTypes.JsonNull;

  /**
   * Helper for filtering JSON entries that are `Prisma.DbNull` or `Prisma.JsonNull`
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const AnyNull: NullTypes.AnyNull;

  type SelectAndInclude = {
    select: any;
    include: any;
  };

  type SelectAndOmit = {
    select: any;
    omit: any;
  };

  /**
   * Get the type of the value, that the Promise holds.
   */
  export type PromiseType<T extends PromiseLike<any>> = T extends PromiseLike<infer U> ? U : T;

  /**
   * Get the return type of a function which returns a Promise.
   */
  export type PromiseReturnType<T extends (...args: any) => $Utils.JsPromise<any>> = PromiseType<ReturnType<T>>;

  /**
   * From T, pick a set of properties whose keys are in the union K
   */
  type Prisma__Pick<T, K extends keyof T> = {
    [P in K]: T[P];
  };

  export type Enumerable<T> = T | Array<T>;

  export type RequiredKeys<T> = {
    [K in keyof T]-?: {} extends Prisma__Pick<T, K> ? never : K;
  }[keyof T];

  export type TruthyKeys<T> = keyof {
    [K in keyof T as T[K] extends false | undefined | null ? never : K]: K;
  };

  export type TrueKeys<T> = TruthyKeys<Prisma__Pick<T, RequiredKeys<T>>>;

  /**
   * Subset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection
   */
  export type Subset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  };

  /**
   * SelectSubset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection.
   * Additionally, it validates, if both select and include are present. If the case, it errors.
   */
  export type SelectSubset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  } & (T extends SelectAndInclude ? 'Please either choose `select` or `include`.' : T extends SelectAndOmit ? 'Please either choose `select` or `omit`.' : {});

  /**
   * Subset + Intersection
   * @desc From `T` pick properties that exist in `U` and intersect `K`
   */
  export type SubsetIntersection<T, U, K> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  } & K;

  type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

  /**
   * XOR is needed to have a real mutually exclusive union type
   * https://stackoverflow.com/questions/42123407/does-typescript-support-mutually-exclusive-types
   */
  type XOR<T, U> = T extends object ? (U extends object ? (Without<T, U> & U) | (Without<U, T> & T) : U) : T;

  /**
   * Is T a Record?
   */
  type IsObject<T extends any> =
    T extends Array<any> ? False : T extends Date ? False : T extends Uint8Array ? False : T extends BigInt ? False : T extends object ? True : False;

  /**
   * If it's T[], return T
   */
  export type UnEnumerate<T extends unknown> = T extends Array<infer U> ? U : T;

  /**
   * From ts-toolbelt
   */

  type __Either<O extends object, K extends Key> = Omit<O, K> &
    {
      // Merge all but K
      [P in K]: Prisma__Pick<O, P & keyof O>; // With K possibilities
    }[K];

  type EitherStrict<O extends object, K extends Key> = Strict<__Either<O, K>>;

  type EitherLoose<O extends object, K extends Key> = ComputeRaw<__Either<O, K>>;

  type _Either<O extends object, K extends Key, strict extends Boolean> = {
    1: EitherStrict<O, K>;
    0: EitherLoose<O, K>;
  }[strict];

  type Either<O extends object, K extends Key, strict extends Boolean = 1> = O extends unknown ? _Either<O, K, strict> : never;

  export type Union = any;

  type PatchUndefined<O extends object, O1 extends object> = {
    [K in keyof O]: O[K] extends undefined ? At<O1, K> : O[K];
  } & {};

  /** Helper Types for "Merge" **/
  export type IntersectOf<U extends Union> = (U extends unknown ? (k: U) => void : never) extends (k: infer I) => void ? I : never;

  export type Overwrite<O extends object, O1 extends object> = {
    [K in keyof O]: K extends keyof O1 ? O1[K] : O[K];
  } & {};

  type _Merge<U extends object> = IntersectOf<
    Overwrite<
      U,
      {
        [K in keyof U]-?: At<U, K>;
      }
    >
  >;

  type Key = string | number | symbol;
  type AtBasic<O extends object, K extends Key> = K extends keyof O ? O[K] : never;
  type AtStrict<O extends object, K extends Key> = O[K & keyof O];
  type AtLoose<O extends object, K extends Key> = O extends unknown ? AtStrict<O, K> : never;
  export type At<O extends object, K extends Key, strict extends Boolean = 1> = {
    1: AtStrict<O, K>;
    0: AtLoose<O, K>;
  }[strict];

  export type ComputeRaw<A extends any> = A extends Function
    ? A
    : {
        [K in keyof A]: A[K];
      } & {};

  export type OptionalFlat<O> = {
    [K in keyof O]?: O[K];
  } & {};

  type _Record<K extends keyof any, T> = {
    [P in K]: T;
  };

  // cause typescript not to expand types and preserve names
  type NoExpand<T> = T extends unknown ? T : never;

  // this type assumes the passed object is entirely optional
  type AtLeast<O extends object, K extends string> = NoExpand<
    O extends unknown ? (K extends keyof O ? { [P in K]: O[P] } & O : O) | ({ [P in keyof O as P extends K ? P : never]-?: O[P] } & O) : never
  >;

  type _Strict<U, _U = U> = U extends unknown ? U & OptionalFlat<_Record<Exclude<Keys<_U>, keyof U>, never>> : never;

  export type Strict<U extends object> = ComputeRaw<_Strict<U>>;
  /** End Helper Types for "Merge" **/

  export type Merge<U extends object> = ComputeRaw<_Merge<Strict<U>>>;

  /**
  A [[Boolean]]
  */
  export type Boolean = True | False;

  // /**
  // 1
  // */
  export type True = 1;

  /**
  0
  */
  export type False = 0;

  export type Not<B extends Boolean> = {
    0: 1;
    1: 0;
  }[B];

  export type Extends<A1 extends any, A2 extends any> = [A1] extends [never]
    ? 0 // anything `never` is false
    : A1 extends A2
      ? 1
      : 0;

  export type Has<U extends Union, U1 extends Union> = Not<Extends<Exclude<U1, U>, U1>>;

  export type Or<B1 extends Boolean, B2 extends Boolean> = {
    0: {
      0: 0;
      1: 1;
    };
    1: {
      0: 1;
      1: 1;
    };
  }[B1][B2];

  export type Keys<U extends Union> = U extends unknown ? keyof U : never;

  type Cast<A, B> = A extends B ? A : B;

  export const type: unique symbol;

  /**
   * Used by group by
   */

  export type GetScalarType<T, O> = O extends object
    ? {
        [P in keyof T]: P extends keyof O ? O[P] : never;
      }
    : never;

  type FieldPaths<T, U = Omit<T, '_avg' | '_sum' | '_count' | '_min' | '_max'>> = IsObject<T> extends True ? U : T;

  type GetHavingFields<T> = {
    [K in keyof T]: Or<Or<Extends<'OR', K>, Extends<'AND', K>>, Extends<'NOT', K>> extends True
      ? // infer is only needed to not hit TS limit
        // based on the brilliant idea of Pierre-Antoine Mills
        // https://github.com/microsoft/TypeScript/issues/30188#issuecomment-478938437
        T[K] extends infer TK
        ? GetHavingFields<UnEnumerate<TK> extends object ? Merge<UnEnumerate<TK>> : never>
        : never
      : {} extends FieldPaths<T[K]>
        ? never
        : K;
  }[keyof T];

  /**
   * Convert tuple to union
   */
  type _TupleToUnion<T> = T extends (infer E)[] ? E : never;
  type TupleToUnion<K extends readonly any[]> = _TupleToUnion<K>;
  type MaybeTupleToUnion<T> = T extends any[] ? TupleToUnion<T> : T;

  /**
   * Like `Pick`, but additionally can also accept an array of keys
   */
  type PickEnumerable<T, K extends Enumerable<keyof T> | keyof T> = Prisma__Pick<T, MaybeTupleToUnion<K>>;

  /**
   * Exclude all keys with underscores
   */
  type ExcludeUnderscoreKeys<T extends string> = T extends `_${string}` ? never : T;

  export type FieldRef<Model, FieldType> = runtime.FieldRef<Model, FieldType>;

  type FieldRefInputType<Model, FieldType> = Model extends never ? never : FieldRef<Model, FieldType>;

  export const ModelName: {
    PullRequest: 'PullRequest';
    ReviewQueue: 'ReviewQueue';
    Event: 'Event';
    QueueOrder: 'QueueOrder';
    SystemState: 'SystemState';
  };

  export type ModelName = (typeof ModelName)[keyof typeof ModelName];

  interface TypeMapCb<ClientOptions = {}> extends $Utils.Fn<{ extArgs: $Extensions.InternalArgs }, $Utils.Record<string, any>> {
    returns: Prisma.TypeMap<this['params']['extArgs'], ClientOptions extends { omit: infer OmitOptions } ? OmitOptions : {}>;
  }

  export type TypeMap<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> = {
    globalOmitOptions: {
      omit: GlobalOmitOptions;
    };
    meta: {
      modelProps: 'pullRequest' | 'reviewQueue' | 'event' | 'queueOrder' | 'systemState';
      txIsolationLevel: Prisma.TransactionIsolationLevel;
    };
    model: {
      PullRequest: {
        payload: Prisma.$PullRequestPayload<ExtArgs>;
        fields: Prisma.PullRequestFieldRefs;
        operations: {
          findUnique: {
            args: Prisma.PullRequestFindUniqueArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$PullRequestPayload> | null;
          };
          findUniqueOrThrow: {
            args: Prisma.PullRequestFindUniqueOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$PullRequestPayload>;
          };
          findFirst: {
            args: Prisma.PullRequestFindFirstArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$PullRequestPayload> | null;
          };
          findFirstOrThrow: {
            args: Prisma.PullRequestFindFirstOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$PullRequestPayload>;
          };
          findMany: {
            args: Prisma.PullRequestFindManyArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$PullRequestPayload>[];
          };
          create: {
            args: Prisma.PullRequestCreateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$PullRequestPayload>;
          };
          createMany: {
            args: Prisma.PullRequestCreateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          createManyAndReturn: {
            args: Prisma.PullRequestCreateManyAndReturnArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$PullRequestPayload>[];
          };
          delete: {
            args: Prisma.PullRequestDeleteArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$PullRequestPayload>;
          };
          update: {
            args: Prisma.PullRequestUpdateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$PullRequestPayload>;
          };
          deleteMany: {
            args: Prisma.PullRequestDeleteManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          updateMany: {
            args: Prisma.PullRequestUpdateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          updateManyAndReturn: {
            args: Prisma.PullRequestUpdateManyAndReturnArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$PullRequestPayload>[];
          };
          upsert: {
            args: Prisma.PullRequestUpsertArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$PullRequestPayload>;
          };
          aggregate: {
            args: Prisma.PullRequestAggregateArgs<ExtArgs>;
            result: $Utils.Optional<AggregatePullRequest>;
          };
          groupBy: {
            args: Prisma.PullRequestGroupByArgs<ExtArgs>;
            result: $Utils.Optional<PullRequestGroupByOutputType>[];
          };
          count: {
            args: Prisma.PullRequestCountArgs<ExtArgs>;
            result: $Utils.Optional<PullRequestCountAggregateOutputType> | number;
          };
        };
      };
      ReviewQueue: {
        payload: Prisma.$ReviewQueuePayload<ExtArgs>;
        fields: Prisma.ReviewQueueFieldRefs;
        operations: {
          findUnique: {
            args: Prisma.ReviewQueueFindUniqueArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$ReviewQueuePayload> | null;
          };
          findUniqueOrThrow: {
            args: Prisma.ReviewQueueFindUniqueOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$ReviewQueuePayload>;
          };
          findFirst: {
            args: Prisma.ReviewQueueFindFirstArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$ReviewQueuePayload> | null;
          };
          findFirstOrThrow: {
            args: Prisma.ReviewQueueFindFirstOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$ReviewQueuePayload>;
          };
          findMany: {
            args: Prisma.ReviewQueueFindManyArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$ReviewQueuePayload>[];
          };
          create: {
            args: Prisma.ReviewQueueCreateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$ReviewQueuePayload>;
          };
          createMany: {
            args: Prisma.ReviewQueueCreateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          createManyAndReturn: {
            args: Prisma.ReviewQueueCreateManyAndReturnArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$ReviewQueuePayload>[];
          };
          delete: {
            args: Prisma.ReviewQueueDeleteArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$ReviewQueuePayload>;
          };
          update: {
            args: Prisma.ReviewQueueUpdateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$ReviewQueuePayload>;
          };
          deleteMany: {
            args: Prisma.ReviewQueueDeleteManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          updateMany: {
            args: Prisma.ReviewQueueUpdateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          updateManyAndReturn: {
            args: Prisma.ReviewQueueUpdateManyAndReturnArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$ReviewQueuePayload>[];
          };
          upsert: {
            args: Prisma.ReviewQueueUpsertArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$ReviewQueuePayload>;
          };
          aggregate: {
            args: Prisma.ReviewQueueAggregateArgs<ExtArgs>;
            result: $Utils.Optional<AggregateReviewQueue>;
          };
          groupBy: {
            args: Prisma.ReviewQueueGroupByArgs<ExtArgs>;
            result: $Utils.Optional<ReviewQueueGroupByOutputType>[];
          };
          count: {
            args: Prisma.ReviewQueueCountArgs<ExtArgs>;
            result: $Utils.Optional<ReviewQueueCountAggregateOutputType> | number;
          };
        };
      };
      Event: {
        payload: Prisma.$EventPayload<ExtArgs>;
        fields: Prisma.EventFieldRefs;
        operations: {
          findUnique: {
            args: Prisma.EventFindUniqueArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$EventPayload> | null;
          };
          findUniqueOrThrow: {
            args: Prisma.EventFindUniqueOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$EventPayload>;
          };
          findFirst: {
            args: Prisma.EventFindFirstArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$EventPayload> | null;
          };
          findFirstOrThrow: {
            args: Prisma.EventFindFirstOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$EventPayload>;
          };
          findMany: {
            args: Prisma.EventFindManyArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$EventPayload>[];
          };
          create: {
            args: Prisma.EventCreateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$EventPayload>;
          };
          createMany: {
            args: Prisma.EventCreateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          createManyAndReturn: {
            args: Prisma.EventCreateManyAndReturnArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$EventPayload>[];
          };
          delete: {
            args: Prisma.EventDeleteArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$EventPayload>;
          };
          update: {
            args: Prisma.EventUpdateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$EventPayload>;
          };
          deleteMany: {
            args: Prisma.EventDeleteManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          updateMany: {
            args: Prisma.EventUpdateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          updateManyAndReturn: {
            args: Prisma.EventUpdateManyAndReturnArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$EventPayload>[];
          };
          upsert: {
            args: Prisma.EventUpsertArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$EventPayload>;
          };
          aggregate: {
            args: Prisma.EventAggregateArgs<ExtArgs>;
            result: $Utils.Optional<AggregateEvent>;
          };
          groupBy: {
            args: Prisma.EventGroupByArgs<ExtArgs>;
            result: $Utils.Optional<EventGroupByOutputType>[];
          };
          count: {
            args: Prisma.EventCountArgs<ExtArgs>;
            result: $Utils.Optional<EventCountAggregateOutputType> | number;
          };
        };
      };
      QueueOrder: {
        payload: Prisma.$QueueOrderPayload<ExtArgs>;
        fields: Prisma.QueueOrderFieldRefs;
        operations: {
          findUnique: {
            args: Prisma.QueueOrderFindUniqueArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$QueueOrderPayload> | null;
          };
          findUniqueOrThrow: {
            args: Prisma.QueueOrderFindUniqueOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$QueueOrderPayload>;
          };
          findFirst: {
            args: Prisma.QueueOrderFindFirstArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$QueueOrderPayload> | null;
          };
          findFirstOrThrow: {
            args: Prisma.QueueOrderFindFirstOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$QueueOrderPayload>;
          };
          findMany: {
            args: Prisma.QueueOrderFindManyArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$QueueOrderPayload>[];
          };
          create: {
            args: Prisma.QueueOrderCreateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$QueueOrderPayload>;
          };
          createMany: {
            args: Prisma.QueueOrderCreateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          createManyAndReturn: {
            args: Prisma.QueueOrderCreateManyAndReturnArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$QueueOrderPayload>[];
          };
          delete: {
            args: Prisma.QueueOrderDeleteArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$QueueOrderPayload>;
          };
          update: {
            args: Prisma.QueueOrderUpdateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$QueueOrderPayload>;
          };
          deleteMany: {
            args: Prisma.QueueOrderDeleteManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          updateMany: {
            args: Prisma.QueueOrderUpdateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          updateManyAndReturn: {
            args: Prisma.QueueOrderUpdateManyAndReturnArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$QueueOrderPayload>[];
          };
          upsert: {
            args: Prisma.QueueOrderUpsertArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$QueueOrderPayload>;
          };
          aggregate: {
            args: Prisma.QueueOrderAggregateArgs<ExtArgs>;
            result: $Utils.Optional<AggregateQueueOrder>;
          };
          groupBy: {
            args: Prisma.QueueOrderGroupByArgs<ExtArgs>;
            result: $Utils.Optional<QueueOrderGroupByOutputType>[];
          };
          count: {
            args: Prisma.QueueOrderCountArgs<ExtArgs>;
            result: $Utils.Optional<QueueOrderCountAggregateOutputType> | number;
          };
        };
      };
      SystemState: {
        payload: Prisma.$SystemStatePayload<ExtArgs>;
        fields: Prisma.SystemStateFieldRefs;
        operations: {
          findUnique: {
            args: Prisma.SystemStateFindUniqueArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$SystemStatePayload> | null;
          };
          findUniqueOrThrow: {
            args: Prisma.SystemStateFindUniqueOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$SystemStatePayload>;
          };
          findFirst: {
            args: Prisma.SystemStateFindFirstArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$SystemStatePayload> | null;
          };
          findFirstOrThrow: {
            args: Prisma.SystemStateFindFirstOrThrowArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$SystemStatePayload>;
          };
          findMany: {
            args: Prisma.SystemStateFindManyArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$SystemStatePayload>[];
          };
          create: {
            args: Prisma.SystemStateCreateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$SystemStatePayload>;
          };
          createMany: {
            args: Prisma.SystemStateCreateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          createManyAndReturn: {
            args: Prisma.SystemStateCreateManyAndReturnArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$SystemStatePayload>[];
          };
          delete: {
            args: Prisma.SystemStateDeleteArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$SystemStatePayload>;
          };
          update: {
            args: Prisma.SystemStateUpdateArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$SystemStatePayload>;
          };
          deleteMany: {
            args: Prisma.SystemStateDeleteManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          updateMany: {
            args: Prisma.SystemStateUpdateManyArgs<ExtArgs>;
            result: BatchPayload;
          };
          updateManyAndReturn: {
            args: Prisma.SystemStateUpdateManyAndReturnArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$SystemStatePayload>[];
          };
          upsert: {
            args: Prisma.SystemStateUpsertArgs<ExtArgs>;
            result: $Utils.PayloadToResult<Prisma.$SystemStatePayload>;
          };
          aggregate: {
            args: Prisma.SystemStateAggregateArgs<ExtArgs>;
            result: $Utils.Optional<AggregateSystemState>;
          };
          groupBy: {
            args: Prisma.SystemStateGroupByArgs<ExtArgs>;
            result: $Utils.Optional<SystemStateGroupByOutputType>[];
          };
          count: {
            args: Prisma.SystemStateCountArgs<ExtArgs>;
            result: $Utils.Optional<SystemStateCountAggregateOutputType> | number;
          };
        };
      };
    };
  } & {
    other: {
      payload: any;
      operations: {
        $executeRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]];
          result: any;
        };
        $executeRawUnsafe: {
          args: [query: string, ...values: any[]];
          result: any;
        };
        $queryRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]];
          result: any;
        };
        $queryRawUnsafe: {
          args: [query: string, ...values: any[]];
          result: any;
        };
      };
    };
  };
  export const defineExtension: $Extensions.ExtendsHook<'define', Prisma.TypeMapCb, $Extensions.DefaultArgs>;
  export type DefaultPrismaClient = PrismaClient;
  export type ErrorFormat = 'pretty' | 'colorless' | 'minimal';
  export interface PrismaClientOptions {
    /**
     * @default "colorless"
     */
    errorFormat?: ErrorFormat;
    /**
     * @example
     * ```
     * // Shorthand for `emit: 'stdout'`
     * log: ['query', 'info', 'warn', 'error']
     *
     * // Emit as events only
     * log: [
     *   { emit: 'event', level: 'query' },
     *   { emit: 'event', level: 'info' },
     *   { emit: 'event', level: 'warn' }
     *   { emit: 'event', level: 'error' }
     * ]
     *
     * / Emit as events and log to stdout
     * og: [
     *  { emit: 'stdout', level: 'query' },
     *  { emit: 'stdout', level: 'info' },
     *  { emit: 'stdout', level: 'warn' }
     *  { emit: 'stdout', level: 'error' }
     *
     * ```
     * Read more in our [docs](https://pris.ly/d/logging).
     */
    log?: (LogLevel | LogDefinition)[];
    /**
     * The default values for transactionOptions
     * maxWait ?= 2000
     * timeout ?= 5000
     */
    transactionOptions?: {
      maxWait?: number;
      timeout?: number;
      isolationLevel?: Prisma.TransactionIsolationLevel;
    };
    /**
     * Instance of a Driver Adapter, e.g., like one provided by `@prisma/adapter-planetscale`
     */
    adapter?: runtime.SqlDriverAdapterFactory;
    /**
     * Prisma Accelerate URL allowing the client to connect through Accelerate instead of a direct database.
     */
    accelerateUrl?: string;
    /**
     * Global configuration for omitting model fields by default.
     *
     * @example
     * ```
     * const prisma = new PrismaClient({
     *   omit: {
     *     user: {
     *       password: true
     *     }
     *   }
     * })
     * ```
     */
    omit?: Prisma.GlobalOmitConfig;
    /**
     * SQL commenter plugins that add metadata to SQL queries as comments.
     * Comments follow the sqlcommenter format: https://google.github.io/sqlcommenter/
     *
     * @example
     * ```
     * const prisma = new PrismaClient({
     *   adapter,
     *   comments: [
     *     traceContext(),
     *     queryInsights(),
     *   ],
     * })
     * ```
     */
    comments?: runtime.SqlCommenterPlugin[];
  }
  export type GlobalOmitConfig = {
    pullRequest?: PullRequestOmit;
    reviewQueue?: ReviewQueueOmit;
    event?: EventOmit;
    queueOrder?: QueueOrderOmit;
    systemState?: SystemStateOmit;
  };

  /* Types for Logging */
  export type LogLevel = 'info' | 'query' | 'warn' | 'error';
  export type LogDefinition = {
    level: LogLevel;
    emit: 'stdout' | 'event';
  };

  export type CheckIsLogLevel<T> = T extends LogLevel ? T : never;

  export type GetLogType<T> = CheckIsLogLevel<T extends LogDefinition ? T['level'] : T>;

  export type GetEvents<T extends any[]> = T extends Array<LogLevel | LogDefinition> ? GetLogType<T[number]> : never;

  export type QueryEvent = {
    timestamp: Date;
    query: string;
    params: string;
    duration: number;
    target: string;
  };

  export type LogEvent = {
    timestamp: Date;
    message: string;
    target: string;
  };
  /* End Types for Logging */

  export type PrismaAction =
    | 'findUnique'
    | 'findUniqueOrThrow'
    | 'findMany'
    | 'findFirst'
    | 'findFirstOrThrow'
    | 'create'
    | 'createMany'
    | 'createManyAndReturn'
    | 'update'
    | 'updateMany'
    | 'updateManyAndReturn'
    | 'upsert'
    | 'delete'
    | 'deleteMany'
    | 'executeRaw'
    | 'queryRaw'
    | 'aggregate'
    | 'count'
    | 'runCommandRaw'
    | 'findRaw'
    | 'groupBy';

  // tested in getLogLevel.test.ts
  export function getLogLevel(log: Array<LogLevel | LogDefinition>): LogLevel | undefined;

  /**
   * `PrismaClient` proxy available in interactive transactions.
   */
  export type TransactionClient = Omit<Prisma.DefaultPrismaClient, runtime.ITXClientDenyList>;

  export type Datasource = {
    url?: string;
  };

  /**
   * Count Types
   */

  /**
   * Count Type PullRequestCountOutputType
   */

  export type PullRequestCountOutputType = {
    queueItems: number;
    events: number;
  };

  export type PullRequestCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    queueItems?: boolean | PullRequestCountOutputTypeCountQueueItemsArgs;
    events?: boolean | PullRequestCountOutputTypeCountEventsArgs;
  };

  // Custom InputTypes
  /**
   * PullRequestCountOutputType without action
   */
  export type PullRequestCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PullRequestCountOutputType
     */
    select?: PullRequestCountOutputTypeSelect<ExtArgs> | null;
  };

  /**
   * PullRequestCountOutputType without action
   */
  export type PullRequestCountOutputTypeCountQueueItemsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ReviewQueueWhereInput;
  };

  /**
   * PullRequestCountOutputType without action
   */
  export type PullRequestCountOutputTypeCountEventsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: EventWhereInput;
  };

  /**
   * Models
   */

  /**
   * Model PullRequest
   */

  export type AggregatePullRequest = {
    _count: PullRequestCountAggregateOutputType | null;
    _avg: PullRequestAvgAggregateOutputType | null;
    _sum: PullRequestSumAggregateOutputType | null;
    _min: PullRequestMinAggregateOutputType | null;
    _max: PullRequestMaxAggregateOutputType | null;
  };

  export type PullRequestAvgAggregateOutputType = {
    id: number | null;
    pr_number: number | null;
    retrigger_count: number | null;
    review_count: number | null;
  };

  export type PullRequestSumAggregateOutputType = {
    id: number | null;
    pr_number: number | null;
    retrigger_count: number | null;
    review_count: number | null;
  };

  export type PullRequestMinAggregateOutputType = {
    id: number | null;
    uuid: string | null;
    repo_full_name: string | null;
    pr_number: number | null;
    title: string | null;
    author_login: string | null;
    first_seen_at: Date | null;
    first_review_limit_at: Date | null;
    last_review_limit_at: Date | null;
    last_review_requested_at: Date | null;
    last_coderabbit_review_at: Date | null;
    last_coderabbit_acknowledged_at: Date | null;
    retrigger_count: number | null;
    review_count: number | null;
    created_at: Date | null;
    updated_at: Date | null;
  };

  export type PullRequestMaxAggregateOutputType = {
    id: number | null;
    uuid: string | null;
    repo_full_name: string | null;
    pr_number: number | null;
    title: string | null;
    author_login: string | null;
    first_seen_at: Date | null;
    first_review_limit_at: Date | null;
    last_review_limit_at: Date | null;
    last_review_requested_at: Date | null;
    last_coderabbit_review_at: Date | null;
    last_coderabbit_acknowledged_at: Date | null;
    retrigger_count: number | null;
    review_count: number | null;
    created_at: Date | null;
    updated_at: Date | null;
  };

  export type PullRequestCountAggregateOutputType = {
    id: number;
    uuid: number;
    repo_full_name: number;
    pr_number: number;
    title: number;
    author_login: number;
    first_seen_at: number;
    first_review_limit_at: number;
    last_review_limit_at: number;
    last_review_requested_at: number;
    last_coderabbit_review_at: number;
    last_coderabbit_acknowledged_at: number;
    retrigger_count: number;
    review_count: number;
    created_at: number;
    updated_at: number;
    _all: number;
  };

  export type PullRequestAvgAggregateInputType = {
    id?: true;
    pr_number?: true;
    retrigger_count?: true;
    review_count?: true;
  };

  export type PullRequestSumAggregateInputType = {
    id?: true;
    pr_number?: true;
    retrigger_count?: true;
    review_count?: true;
  };

  export type PullRequestMinAggregateInputType = {
    id?: true;
    uuid?: true;
    repo_full_name?: true;
    pr_number?: true;
    title?: true;
    author_login?: true;
    first_seen_at?: true;
    first_review_limit_at?: true;
    last_review_limit_at?: true;
    last_review_requested_at?: true;
    last_coderabbit_review_at?: true;
    last_coderabbit_acknowledged_at?: true;
    retrigger_count?: true;
    review_count?: true;
    created_at?: true;
    updated_at?: true;
  };

  export type PullRequestMaxAggregateInputType = {
    id?: true;
    uuid?: true;
    repo_full_name?: true;
    pr_number?: true;
    title?: true;
    author_login?: true;
    first_seen_at?: true;
    first_review_limit_at?: true;
    last_review_limit_at?: true;
    last_review_requested_at?: true;
    last_coderabbit_review_at?: true;
    last_coderabbit_acknowledged_at?: true;
    retrigger_count?: true;
    review_count?: true;
    created_at?: true;
    updated_at?: true;
  };

  export type PullRequestCountAggregateInputType = {
    id?: true;
    uuid?: true;
    repo_full_name?: true;
    pr_number?: true;
    title?: true;
    author_login?: true;
    first_seen_at?: true;
    first_review_limit_at?: true;
    last_review_limit_at?: true;
    last_review_requested_at?: true;
    last_coderabbit_review_at?: true;
    last_coderabbit_acknowledged_at?: true;
    retrigger_count?: true;
    review_count?: true;
    created_at?: true;
    updated_at?: true;
    _all?: true;
  };

  export type PullRequestAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PullRequest to aggregate.
     */
    where?: PullRequestWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of PullRequests to fetch.
     */
    orderBy?: PullRequestOrderByWithRelationInput | PullRequestOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the start position
     */
    cursor?: PullRequestWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` PullRequests from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` PullRequests.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Count returned PullRequests
     **/
    _count?: true | PullRequestCountAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to average
     **/
    _avg?: PullRequestAvgAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to sum
     **/
    _sum?: PullRequestSumAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the minimum value
     **/
    _min?: PullRequestMinAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the maximum value
     **/
    _max?: PullRequestMaxAggregateInputType;
  };

  export type GetPullRequestAggregateType<T extends PullRequestAggregateArgs> = {
    [P in keyof T & keyof AggregatePullRequest]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregatePullRequest[P]>
      : GetScalarType<T[P], AggregatePullRequest[P]>;
  };

  export type PullRequestGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: PullRequestWhereInput;
    orderBy?: PullRequestOrderByWithAggregationInput | PullRequestOrderByWithAggregationInput[];
    by: PullRequestScalarFieldEnum[] | PullRequestScalarFieldEnum;
    having?: PullRequestScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: PullRequestCountAggregateInputType | true;
    _avg?: PullRequestAvgAggregateInputType;
    _sum?: PullRequestSumAggregateInputType;
    _min?: PullRequestMinAggregateInputType;
    _max?: PullRequestMaxAggregateInputType;
  };

  export type PullRequestGroupByOutputType = {
    id: number;
    uuid: string;
    repo_full_name: string;
    pr_number: number;
    title: string;
    author_login: string;
    first_seen_at: Date;
    first_review_limit_at: Date | null;
    last_review_limit_at: Date | null;
    last_review_requested_at: Date | null;
    last_coderabbit_review_at: Date | null;
    last_coderabbit_acknowledged_at: Date | null;
    retrigger_count: number;
    review_count: number;
    created_at: Date;
    updated_at: Date;
    _count: PullRequestCountAggregateOutputType | null;
    _avg: PullRequestAvgAggregateOutputType | null;
    _sum: PullRequestSumAggregateOutputType | null;
    _min: PullRequestMinAggregateOutputType | null;
    _max: PullRequestMaxAggregateOutputType | null;
  };

  type GetPullRequestGroupByPayload<T extends PullRequestGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<PullRequestGroupByOutputType, T['by']> & {
        [P in keyof T & keyof PullRequestGroupByOutputType]: P extends '_count'
          ? T[P] extends boolean
            ? number
            : GetScalarType<T[P], PullRequestGroupByOutputType[P]>
          : GetScalarType<T[P], PullRequestGroupByOutputType[P]>;
      }
    >
  >;

  export type PullRequestSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<
    {
      id?: boolean;
      uuid?: boolean;
      repo_full_name?: boolean;
      pr_number?: boolean;
      title?: boolean;
      author_login?: boolean;
      first_seen_at?: boolean;
      first_review_limit_at?: boolean;
      last_review_limit_at?: boolean;
      last_review_requested_at?: boolean;
      last_coderabbit_review_at?: boolean;
      last_coderabbit_acknowledged_at?: boolean;
      retrigger_count?: boolean;
      review_count?: boolean;
      created_at?: boolean;
      updated_at?: boolean;
      queueItems?: boolean | PullRequest$queueItemsArgs<ExtArgs>;
      events?: boolean | PullRequest$eventsArgs<ExtArgs>;
      _count?: boolean | PullRequestCountOutputTypeDefaultArgs<ExtArgs>;
    },
    ExtArgs['result']['pullRequest']
  >;

  export type PullRequestSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<
    {
      id?: boolean;
      uuid?: boolean;
      repo_full_name?: boolean;
      pr_number?: boolean;
      title?: boolean;
      author_login?: boolean;
      first_seen_at?: boolean;
      first_review_limit_at?: boolean;
      last_review_limit_at?: boolean;
      last_review_requested_at?: boolean;
      last_coderabbit_review_at?: boolean;
      last_coderabbit_acknowledged_at?: boolean;
      retrigger_count?: boolean;
      review_count?: boolean;
      created_at?: boolean;
      updated_at?: boolean;
    },
    ExtArgs['result']['pullRequest']
  >;

  export type PullRequestSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<
    {
      id?: boolean;
      uuid?: boolean;
      repo_full_name?: boolean;
      pr_number?: boolean;
      title?: boolean;
      author_login?: boolean;
      first_seen_at?: boolean;
      first_review_limit_at?: boolean;
      last_review_limit_at?: boolean;
      last_review_requested_at?: boolean;
      last_coderabbit_review_at?: boolean;
      last_coderabbit_acknowledged_at?: boolean;
      retrigger_count?: boolean;
      review_count?: boolean;
      created_at?: boolean;
      updated_at?: boolean;
    },
    ExtArgs['result']['pullRequest']
  >;

  export type PullRequestSelectScalar = {
    id?: boolean;
    uuid?: boolean;
    repo_full_name?: boolean;
    pr_number?: boolean;
    title?: boolean;
    author_login?: boolean;
    first_seen_at?: boolean;
    first_review_limit_at?: boolean;
    last_review_limit_at?: boolean;
    last_review_requested_at?: boolean;
    last_coderabbit_review_at?: boolean;
    last_coderabbit_acknowledged_at?: boolean;
    retrigger_count?: boolean;
    review_count?: boolean;
    created_at?: boolean;
    updated_at?: boolean;
  };

  export type PullRequestOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<
    | 'id'
    | 'uuid'
    | 'repo_full_name'
    | 'pr_number'
    | 'title'
    | 'author_login'
    | 'first_seen_at'
    | 'first_review_limit_at'
    | 'last_review_limit_at'
    | 'last_review_requested_at'
    | 'last_coderabbit_review_at'
    | 'last_coderabbit_acknowledged_at'
    | 'retrigger_count'
    | 'review_count'
    | 'created_at'
    | 'updated_at',
    ExtArgs['result']['pullRequest']
  >;
  export type PullRequestInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    queueItems?: boolean | PullRequest$queueItemsArgs<ExtArgs>;
    events?: boolean | PullRequest$eventsArgs<ExtArgs>;
    _count?: boolean | PullRequestCountOutputTypeDefaultArgs<ExtArgs>;
  };
  export type PullRequestIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {};
  export type PullRequestIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {};

  export type $PullRequestPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: 'PullRequest';
    objects: {
      queueItems: Prisma.$ReviewQueuePayload<ExtArgs>[];
      events: Prisma.$EventPayload<ExtArgs>[];
    };
    scalars: $Extensions.GetPayloadResult<
      {
        id: number;
        uuid: string;
        repo_full_name: string;
        pr_number: number;
        title: string;
        author_login: string;
        first_seen_at: Date;
        first_review_limit_at: Date | null;
        last_review_limit_at: Date | null;
        last_review_requested_at: Date | null;
        last_coderabbit_review_at: Date | null;
        last_coderabbit_acknowledged_at: Date | null;
        retrigger_count: number;
        review_count: number;
        created_at: Date;
        updated_at: Date;
      },
      ExtArgs['result']['pullRequest']
    >;
    composites: {};
  };

  type PullRequestGetPayload<S extends boolean | null | undefined | PullRequestDefaultArgs> = $Result.GetResult<Prisma.$PullRequestPayload, S>;

  type PullRequestCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = Omit<
    PullRequestFindManyArgs,
    'select' | 'include' | 'distinct' | 'omit'
  > & {
    select?: PullRequestCountAggregateInputType | true;
  };

  export interface PullRequestDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['PullRequest']; meta: { name: 'PullRequest' } };
    /**
     * Find zero or one PullRequest that matches the filter.
     * @param {PullRequestFindUniqueArgs} args - Arguments to find a PullRequest
     * @example
     * // Get one PullRequest
     * const pullRequest = await prisma.pullRequest.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends PullRequestFindUniqueArgs>(
      args: SelectSubset<T, PullRequestFindUniqueArgs<ExtArgs>>,
    ): Prisma__PullRequestClient<
      $Result.GetResult<Prisma.$PullRequestPayload<ExtArgs>, T, 'findUnique', GlobalOmitOptions> | null,
      null,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find one PullRequest that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {PullRequestFindUniqueOrThrowArgs} args - Arguments to find a PullRequest
     * @example
     * // Get one PullRequest
     * const pullRequest = await prisma.pullRequest.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends PullRequestFindUniqueOrThrowArgs>(
      args: SelectSubset<T, PullRequestFindUniqueOrThrowArgs<ExtArgs>>,
    ): Prisma__PullRequestClient<
      $Result.GetResult<Prisma.$PullRequestPayload<ExtArgs>, T, 'findUniqueOrThrow', GlobalOmitOptions>,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find the first PullRequest that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PullRequestFindFirstArgs} args - Arguments to find a PullRequest
     * @example
     * // Get one PullRequest
     * const pullRequest = await prisma.pullRequest.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends PullRequestFindFirstArgs>(
      args?: SelectSubset<T, PullRequestFindFirstArgs<ExtArgs>>,
    ): Prisma__PullRequestClient<
      $Result.GetResult<Prisma.$PullRequestPayload<ExtArgs>, T, 'findFirst', GlobalOmitOptions> | null,
      null,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find the first PullRequest that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PullRequestFindFirstOrThrowArgs} args - Arguments to find a PullRequest
     * @example
     * // Get one PullRequest
     * const pullRequest = await prisma.pullRequest.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends PullRequestFindFirstOrThrowArgs>(
      args?: SelectSubset<T, PullRequestFindFirstOrThrowArgs<ExtArgs>>,
    ): Prisma__PullRequestClient<
      $Result.GetResult<Prisma.$PullRequestPayload<ExtArgs>, T, 'findFirstOrThrow', GlobalOmitOptions>,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find zero or more PullRequests that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PullRequestFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all PullRequests
     * const pullRequests = await prisma.pullRequest.findMany()
     *
     * // Get first 10 PullRequests
     * const pullRequests = await prisma.pullRequest.findMany({ take: 10 })
     *
     * // Only select the `id`
     * const pullRequestWithIdOnly = await prisma.pullRequest.findMany({ select: { id: true } })
     *
     */
    findMany<T extends PullRequestFindManyArgs>(
      args?: SelectSubset<T, PullRequestFindManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PullRequestPayload<ExtArgs>, T, 'findMany', GlobalOmitOptions>>;

    /**
     * Create a PullRequest.
     * @param {PullRequestCreateArgs} args - Arguments to create a PullRequest.
     * @example
     * // Create one PullRequest
     * const PullRequest = await prisma.pullRequest.create({
     *   data: {
     *     // ... data to create a PullRequest
     *   }
     * })
     *
     */
    create<T extends PullRequestCreateArgs>(
      args: SelectSubset<T, PullRequestCreateArgs<ExtArgs>>,
    ): Prisma__PullRequestClient<$Result.GetResult<Prisma.$PullRequestPayload<ExtArgs>, T, 'create', GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;

    /**
     * Create many PullRequests.
     * @param {PullRequestCreateManyArgs} args - Arguments to create many PullRequests.
     * @example
     * // Create many PullRequests
     * const pullRequest = await prisma.pullRequest.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     */
    createMany<T extends PullRequestCreateManyArgs>(args?: SelectSubset<T, PullRequestCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Create many PullRequests and returns the data saved in the database.
     * @param {PullRequestCreateManyAndReturnArgs} args - Arguments to create many PullRequests.
     * @example
     * // Create many PullRequests
     * const pullRequest = await prisma.pullRequest.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Create many PullRequests and only return the `id`
     * const pullRequestWithIdOnly = await prisma.pullRequest.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    createManyAndReturn<T extends PullRequestCreateManyAndReturnArgs>(
      args?: SelectSubset<T, PullRequestCreateManyAndReturnArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PullRequestPayload<ExtArgs>, T, 'createManyAndReturn', GlobalOmitOptions>>;

    /**
     * Delete a PullRequest.
     * @param {PullRequestDeleteArgs} args - Arguments to delete one PullRequest.
     * @example
     * // Delete one PullRequest
     * const PullRequest = await prisma.pullRequest.delete({
     *   where: {
     *     // ... filter to delete one PullRequest
     *   }
     * })
     *
     */
    delete<T extends PullRequestDeleteArgs>(
      args: SelectSubset<T, PullRequestDeleteArgs<ExtArgs>>,
    ): Prisma__PullRequestClient<$Result.GetResult<Prisma.$PullRequestPayload<ExtArgs>, T, 'delete', GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;

    /**
     * Update one PullRequest.
     * @param {PullRequestUpdateArgs} args - Arguments to update one PullRequest.
     * @example
     * // Update one PullRequest
     * const pullRequest = await prisma.pullRequest.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    update<T extends PullRequestUpdateArgs>(
      args: SelectSubset<T, PullRequestUpdateArgs<ExtArgs>>,
    ): Prisma__PullRequestClient<$Result.GetResult<Prisma.$PullRequestPayload<ExtArgs>, T, 'update', GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;

    /**
     * Delete zero or more PullRequests.
     * @param {PullRequestDeleteManyArgs} args - Arguments to filter PullRequests to delete.
     * @example
     * // Delete a few PullRequests
     * const { count } = await prisma.pullRequest.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     *
     */
    deleteMany<T extends PullRequestDeleteManyArgs>(args?: SelectSubset<T, PullRequestDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Update zero or more PullRequests.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PullRequestUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many PullRequests
     * const pullRequest = await prisma.pullRequest.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    updateMany<T extends PullRequestUpdateManyArgs>(args: SelectSubset<T, PullRequestUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Update zero or more PullRequests and returns the data updated in the database.
     * @param {PullRequestUpdateManyAndReturnArgs} args - Arguments to update many PullRequests.
     * @example
     * // Update many PullRequests
     * const pullRequest = await prisma.pullRequest.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Update zero or more PullRequests and only return the `id`
     * const pullRequestWithIdOnly = await prisma.pullRequest.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    updateManyAndReturn<T extends PullRequestUpdateManyAndReturnArgs>(
      args: SelectSubset<T, PullRequestUpdateManyAndReturnArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<$Result.GetResult<Prisma.$PullRequestPayload<ExtArgs>, T, 'updateManyAndReturn', GlobalOmitOptions>>;

    /**
     * Create or update one PullRequest.
     * @param {PullRequestUpsertArgs} args - Arguments to update or create a PullRequest.
     * @example
     * // Update or create a PullRequest
     * const pullRequest = await prisma.pullRequest.upsert({
     *   create: {
     *     // ... data to create a PullRequest
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the PullRequest we want to update
     *   }
     * })
     */
    upsert<T extends PullRequestUpsertArgs>(
      args: SelectSubset<T, PullRequestUpsertArgs<ExtArgs>>,
    ): Prisma__PullRequestClient<$Result.GetResult<Prisma.$PullRequestPayload<ExtArgs>, T, 'upsert', GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;

    /**
     * Count the number of PullRequests.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PullRequestCountArgs} args - Arguments to filter PullRequests to count.
     * @example
     * // Count the number of PullRequests
     * const count = await prisma.pullRequest.count({
     *   where: {
     *     // ... the filter for the PullRequests we want to count
     *   }
     * })
     **/
    count<T extends PullRequestCountArgs>(
      args?: Subset<T, PullRequestCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any> ? (T['select'] extends true ? number : GetScalarType<T['select'], PullRequestCountAggregateOutputType>) : number
    >;

    /**
     * Allows you to perform aggregations operations on a PullRequest.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PullRequestAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
     **/
    aggregate<T extends PullRequestAggregateArgs>(args: Subset<T, PullRequestAggregateArgs>): Prisma.PrismaPromise<GetPullRequestAggregateType<T>>;

    /**
     * Group by PullRequest.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PullRequestGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     *
     **/
    groupBy<
      T extends PullRequestGroupByArgs,
      HasSelectOrTake extends Or<Extends<'skip', Keys<T>>, Extends<'take', Keys<T>>>,
      OrderByArg extends True extends HasSelectOrTake ? { orderBy: PullRequestGroupByArgs['orderBy'] } : { orderBy?: PullRequestGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
        ? `Error: "by" must not be empty.`
        : HavingValid extends False
          ? {
              [P in HavingFields]: P extends ByFields
                ? never
                : P extends string
                  ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
                  : [Error, 'Field ', P, ` in "having" needs to be provided in "by"`];
            }[HavingFields]
          : 'take' extends Keys<T>
            ? 'orderBy' extends Keys<T>
              ? ByValid extends True
                ? {}
                : {
                    [P in OrderFields]: P extends ByFields ? never : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                  }[OrderFields]
              : 'Error: If you provide "take", you also need to provide "orderBy"'
            : 'skip' extends Keys<T>
              ? 'orderBy' extends Keys<T>
                ? ByValid extends True
                  ? {}
                  : {
                      [P in OrderFields]: P extends ByFields ? never : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                    }[OrderFields]
                : 'Error: If you provide "skip", you also need to provide "orderBy"'
              : ByValid extends True
                ? {}
                : {
                    [P in OrderFields]: P extends ByFields ? never : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                  }[OrderFields],
    >(
      args: SubsetIntersection<T, PullRequestGroupByArgs, OrderByArg> & InputErrors,
    ): {} extends InputErrors ? GetPullRequestGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>;
    /**
     * Fields of the PullRequest model
     */
    readonly fields: PullRequestFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for PullRequest.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__PullRequestClient<
    T,
    Null = never,
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
    GlobalOmitOptions = {},
  > extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: 'PrismaPromise';
    queueItems<T extends PullRequest$queueItemsArgs<ExtArgs> = {}>(
      args?: Subset<T, PullRequest$queueItemsArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ReviewQueuePayload<ExtArgs>, T, 'findMany', GlobalOmitOptions> | Null>;
    events<T extends PullRequest$eventsArgs<ExtArgs> = {}>(
      args?: Subset<T, PullRequest$eventsArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<$Result.GetResult<Prisma.$EventPayload<ExtArgs>, T, 'findMany', GlobalOmitOptions> | Null>;
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(
      onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null,
      onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null,
    ): $Utils.JsPromise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>;
  }

  /**
   * Fields of the PullRequest model
   */
  interface PullRequestFieldRefs {
    readonly id: FieldRef<'PullRequest', 'Int'>;
    readonly uuid: FieldRef<'PullRequest', 'String'>;
    readonly repo_full_name: FieldRef<'PullRequest', 'String'>;
    readonly pr_number: FieldRef<'PullRequest', 'Int'>;
    readonly title: FieldRef<'PullRequest', 'String'>;
    readonly author_login: FieldRef<'PullRequest', 'String'>;
    readonly first_seen_at: FieldRef<'PullRequest', 'DateTime'>;
    readonly first_review_limit_at: FieldRef<'PullRequest', 'DateTime'>;
    readonly last_review_limit_at: FieldRef<'PullRequest', 'DateTime'>;
    readonly last_review_requested_at: FieldRef<'PullRequest', 'DateTime'>;
    readonly last_coderabbit_review_at: FieldRef<'PullRequest', 'DateTime'>;
    readonly last_coderabbit_acknowledged_at: FieldRef<'PullRequest', 'DateTime'>;
    readonly retrigger_count: FieldRef<'PullRequest', 'Int'>;
    readonly review_count: FieldRef<'PullRequest', 'Int'>;
    readonly created_at: FieldRef<'PullRequest', 'DateTime'>;
    readonly updated_at: FieldRef<'PullRequest', 'DateTime'>;
  }

  // Custom InputTypes
  /**
   * PullRequest findUnique
   */
  export type PullRequestFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PullRequest
     */
    select?: PullRequestSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the PullRequest
     */
    omit?: PullRequestOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PullRequestInclude<ExtArgs> | null;
    /**
     * Filter, which PullRequest to fetch.
     */
    where: PullRequestWhereUniqueInput;
  };

  /**
   * PullRequest findUniqueOrThrow
   */
  export type PullRequestFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PullRequest
     */
    select?: PullRequestSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the PullRequest
     */
    omit?: PullRequestOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PullRequestInclude<ExtArgs> | null;
    /**
     * Filter, which PullRequest to fetch.
     */
    where: PullRequestWhereUniqueInput;
  };

  /**
   * PullRequest findFirst
   */
  export type PullRequestFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PullRequest
     */
    select?: PullRequestSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the PullRequest
     */
    omit?: PullRequestOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PullRequestInclude<ExtArgs> | null;
    /**
     * Filter, which PullRequest to fetch.
     */
    where?: PullRequestWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of PullRequests to fetch.
     */
    orderBy?: PullRequestOrderByWithRelationInput | PullRequestOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for PullRequests.
     */
    cursor?: PullRequestWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` PullRequests from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` PullRequests.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of PullRequests.
     */
    distinct?: PullRequestScalarFieldEnum | PullRequestScalarFieldEnum[];
  };

  /**
   * PullRequest findFirstOrThrow
   */
  export type PullRequestFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PullRequest
     */
    select?: PullRequestSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the PullRequest
     */
    omit?: PullRequestOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PullRequestInclude<ExtArgs> | null;
    /**
     * Filter, which PullRequest to fetch.
     */
    where?: PullRequestWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of PullRequests to fetch.
     */
    orderBy?: PullRequestOrderByWithRelationInput | PullRequestOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for PullRequests.
     */
    cursor?: PullRequestWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` PullRequests from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` PullRequests.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of PullRequests.
     */
    distinct?: PullRequestScalarFieldEnum | PullRequestScalarFieldEnum[];
  };

  /**
   * PullRequest findMany
   */
  export type PullRequestFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PullRequest
     */
    select?: PullRequestSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the PullRequest
     */
    omit?: PullRequestOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PullRequestInclude<ExtArgs> | null;
    /**
     * Filter, which PullRequests to fetch.
     */
    where?: PullRequestWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of PullRequests to fetch.
     */
    orderBy?: PullRequestOrderByWithRelationInput | PullRequestOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for listing PullRequests.
     */
    cursor?: PullRequestWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` PullRequests from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` PullRequests.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of PullRequests.
     */
    distinct?: PullRequestScalarFieldEnum | PullRequestScalarFieldEnum[];
  };

  /**
   * PullRequest create
   */
  export type PullRequestCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PullRequest
     */
    select?: PullRequestSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the PullRequest
     */
    omit?: PullRequestOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PullRequestInclude<ExtArgs> | null;
    /**
     * The data needed to create a PullRequest.
     */
    data: XOR<PullRequestCreateInput, PullRequestUncheckedCreateInput>;
  };

  /**
   * PullRequest createMany
   */
  export type PullRequestCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many PullRequests.
     */
    data: PullRequestCreateManyInput | PullRequestCreateManyInput[];
  };

  /**
   * PullRequest createManyAndReturn
   */
  export type PullRequestCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PullRequest
     */
    select?: PullRequestSelectCreateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the PullRequest
     */
    omit?: PullRequestOmit<ExtArgs> | null;
    /**
     * The data used to create many PullRequests.
     */
    data: PullRequestCreateManyInput | PullRequestCreateManyInput[];
  };

  /**
   * PullRequest update
   */
  export type PullRequestUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PullRequest
     */
    select?: PullRequestSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the PullRequest
     */
    omit?: PullRequestOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PullRequestInclude<ExtArgs> | null;
    /**
     * The data needed to update a PullRequest.
     */
    data: XOR<PullRequestUpdateInput, PullRequestUncheckedUpdateInput>;
    /**
     * Choose, which PullRequest to update.
     */
    where: PullRequestWhereUniqueInput;
  };

  /**
   * PullRequest updateMany
   */
  export type PullRequestUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update PullRequests.
     */
    data: XOR<PullRequestUpdateManyMutationInput, PullRequestUncheckedUpdateManyInput>;
    /**
     * Filter which PullRequests to update
     */
    where?: PullRequestWhereInput;
    /**
     * Limit how many PullRequests to update.
     */
    limit?: number;
  };

  /**
   * PullRequest updateManyAndReturn
   */
  export type PullRequestUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PullRequest
     */
    select?: PullRequestSelectUpdateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the PullRequest
     */
    omit?: PullRequestOmit<ExtArgs> | null;
    /**
     * The data used to update PullRequests.
     */
    data: XOR<PullRequestUpdateManyMutationInput, PullRequestUncheckedUpdateManyInput>;
    /**
     * Filter which PullRequests to update
     */
    where?: PullRequestWhereInput;
    /**
     * Limit how many PullRequests to update.
     */
    limit?: number;
  };

  /**
   * PullRequest upsert
   */
  export type PullRequestUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PullRequest
     */
    select?: PullRequestSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the PullRequest
     */
    omit?: PullRequestOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PullRequestInclude<ExtArgs> | null;
    /**
     * The filter to search for the PullRequest to update in case it exists.
     */
    where: PullRequestWhereUniqueInput;
    /**
     * In case the PullRequest found by the `where` argument doesn't exist, create a new PullRequest with this data.
     */
    create: XOR<PullRequestCreateInput, PullRequestUncheckedCreateInput>;
    /**
     * In case the PullRequest was found with the provided `where` argument, update it with this data.
     */
    update: XOR<PullRequestUpdateInput, PullRequestUncheckedUpdateInput>;
  };

  /**
   * PullRequest delete
   */
  export type PullRequestDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PullRequest
     */
    select?: PullRequestSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the PullRequest
     */
    omit?: PullRequestOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PullRequestInclude<ExtArgs> | null;
    /**
     * Filter which PullRequest to delete.
     */
    where: PullRequestWhereUniqueInput;
  };

  /**
   * PullRequest deleteMany
   */
  export type PullRequestDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which PullRequests to delete
     */
    where?: PullRequestWhereInput;
    /**
     * Limit how many PullRequests to delete.
     */
    limit?: number;
  };

  /**
   * PullRequest.queueItems
   */
  export type PullRequest$queueItemsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ReviewQueue
     */
    select?: ReviewQueueSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the ReviewQueue
     */
    omit?: ReviewQueueOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ReviewQueueInclude<ExtArgs> | null;
    where?: ReviewQueueWhereInput;
    orderBy?: ReviewQueueOrderByWithRelationInput | ReviewQueueOrderByWithRelationInput[];
    cursor?: ReviewQueueWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: ReviewQueueScalarFieldEnum | ReviewQueueScalarFieldEnum[];
  };

  /**
   * PullRequest.events
   */
  export type PullRequest$eventsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Event
     */
    select?: EventSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Event
     */
    omit?: EventOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EventInclude<ExtArgs> | null;
    where?: EventWhereInput;
    orderBy?: EventOrderByWithRelationInput | EventOrderByWithRelationInput[];
    cursor?: EventWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: EventScalarFieldEnum | EventScalarFieldEnum[];
  };

  /**
   * PullRequest without action
   */
  export type PullRequestDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PullRequest
     */
    select?: PullRequestSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the PullRequest
     */
    omit?: PullRequestOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PullRequestInclude<ExtArgs> | null;
  };

  /**
   * Model ReviewQueue
   */

  export type AggregateReviewQueue = {
    _count: ReviewQueueCountAggregateOutputType | null;
    _avg: ReviewQueueAvgAggregateOutputType | null;
    _sum: ReviewQueueSumAggregateOutputType | null;
    _min: ReviewQueueMinAggregateOutputType | null;
    _max: ReviewQueueMaxAggregateOutputType | null;
  };

  export type ReviewQueueAvgAggregateOutputType = {
    id: number | null;
    pull_request_id: number | null;
    pr_number: number | null;
    attempts: number | null;
    source_comment_id: number | null;
  };

  export type ReviewQueueSumAggregateOutputType = {
    id: number | null;
    pull_request_id: number | null;
    pr_number: number | null;
    attempts: number | null;
    source_comment_id: number | null;
  };

  export type ReviewQueueMinAggregateOutputType = {
    id: number | null;
    uuid: string | null;
    pull_request_id: number | null;
    repo_full_name: string | null;
    pr_number: number | null;
    pr_title: string | null;
    status: string | null;
    not_before: Date | null;
    attempts: number | null;
    source_comment_url: string | null;
    source_comment_id: number | null;
    trigger_source: string | null;
    retrigger_comment_url: string | null;
    retriggered_at: Date | null;
    failed_at: Date | null;
    reviewed_at: Date | null;
    created_at: Date | null;
    updated_at: Date | null;
  };

  export type ReviewQueueMaxAggregateOutputType = {
    id: number | null;
    uuid: string | null;
    pull_request_id: number | null;
    repo_full_name: string | null;
    pr_number: number | null;
    pr_title: string | null;
    status: string | null;
    not_before: Date | null;
    attempts: number | null;
    source_comment_url: string | null;
    source_comment_id: number | null;
    trigger_source: string | null;
    retrigger_comment_url: string | null;
    retriggered_at: Date | null;
    failed_at: Date | null;
    reviewed_at: Date | null;
    created_at: Date | null;
    updated_at: Date | null;
  };

  export type ReviewQueueCountAggregateOutputType = {
    id: number;
    uuid: number;
    pull_request_id: number;
    repo_full_name: number;
    pr_number: number;
    pr_title: number;
    status: number;
    not_before: number;
    attempts: number;
    source_comment_url: number;
    source_comment_id: number;
    trigger_source: number;
    retrigger_comment_url: number;
    retriggered_at: number;
    failed_at: number;
    reviewed_at: number;
    created_at: number;
    updated_at: number;
    _all: number;
  };

  export type ReviewQueueAvgAggregateInputType = {
    id?: true;
    pull_request_id?: true;
    pr_number?: true;
    attempts?: true;
    source_comment_id?: true;
  };

  export type ReviewQueueSumAggregateInputType = {
    id?: true;
    pull_request_id?: true;
    pr_number?: true;
    attempts?: true;
    source_comment_id?: true;
  };

  export type ReviewQueueMinAggregateInputType = {
    id?: true;
    uuid?: true;
    pull_request_id?: true;
    repo_full_name?: true;
    pr_number?: true;
    pr_title?: true;
    status?: true;
    not_before?: true;
    attempts?: true;
    source_comment_url?: true;
    source_comment_id?: true;
    trigger_source?: true;
    retrigger_comment_url?: true;
    retriggered_at?: true;
    failed_at?: true;
    reviewed_at?: true;
    created_at?: true;
    updated_at?: true;
  };

  export type ReviewQueueMaxAggregateInputType = {
    id?: true;
    uuid?: true;
    pull_request_id?: true;
    repo_full_name?: true;
    pr_number?: true;
    pr_title?: true;
    status?: true;
    not_before?: true;
    attempts?: true;
    source_comment_url?: true;
    source_comment_id?: true;
    trigger_source?: true;
    retrigger_comment_url?: true;
    retriggered_at?: true;
    failed_at?: true;
    reviewed_at?: true;
    created_at?: true;
    updated_at?: true;
  };

  export type ReviewQueueCountAggregateInputType = {
    id?: true;
    uuid?: true;
    pull_request_id?: true;
    repo_full_name?: true;
    pr_number?: true;
    pr_title?: true;
    status?: true;
    not_before?: true;
    attempts?: true;
    source_comment_url?: true;
    source_comment_id?: true;
    trigger_source?: true;
    retrigger_comment_url?: true;
    retriggered_at?: true;
    failed_at?: true;
    reviewed_at?: true;
    created_at?: true;
    updated_at?: true;
    _all?: true;
  };

  export type ReviewQueueAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which ReviewQueue to aggregate.
     */
    where?: ReviewQueueWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of ReviewQueues to fetch.
     */
    orderBy?: ReviewQueueOrderByWithRelationInput | ReviewQueueOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the start position
     */
    cursor?: ReviewQueueWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` ReviewQueues from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` ReviewQueues.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Count returned ReviewQueues
     **/
    _count?: true | ReviewQueueCountAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to average
     **/
    _avg?: ReviewQueueAvgAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to sum
     **/
    _sum?: ReviewQueueSumAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the minimum value
     **/
    _min?: ReviewQueueMinAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the maximum value
     **/
    _max?: ReviewQueueMaxAggregateInputType;
  };

  export type GetReviewQueueAggregateType<T extends ReviewQueueAggregateArgs> = {
    [P in keyof T & keyof AggregateReviewQueue]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateReviewQueue[P]>
      : GetScalarType<T[P], AggregateReviewQueue[P]>;
  };

  export type ReviewQueueGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ReviewQueueWhereInput;
    orderBy?: ReviewQueueOrderByWithAggregationInput | ReviewQueueOrderByWithAggregationInput[];
    by: ReviewQueueScalarFieldEnum[] | ReviewQueueScalarFieldEnum;
    having?: ReviewQueueScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: ReviewQueueCountAggregateInputType | true;
    _avg?: ReviewQueueAvgAggregateInputType;
    _sum?: ReviewQueueSumAggregateInputType;
    _min?: ReviewQueueMinAggregateInputType;
    _max?: ReviewQueueMaxAggregateInputType;
  };

  export type ReviewQueueGroupByOutputType = {
    id: number;
    uuid: string;
    pull_request_id: number | null;
    repo_full_name: string;
    pr_number: number;
    pr_title: string;
    status: string;
    not_before: Date;
    attempts: number;
    source_comment_url: string;
    source_comment_id: number;
    trigger_source: string;
    retrigger_comment_url: string | null;
    retriggered_at: Date | null;
    failed_at: Date | null;
    reviewed_at: Date | null;
    created_at: Date;
    updated_at: Date;
    _count: ReviewQueueCountAggregateOutputType | null;
    _avg: ReviewQueueAvgAggregateOutputType | null;
    _sum: ReviewQueueSumAggregateOutputType | null;
    _min: ReviewQueueMinAggregateOutputType | null;
    _max: ReviewQueueMaxAggregateOutputType | null;
  };

  type GetReviewQueueGroupByPayload<T extends ReviewQueueGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<ReviewQueueGroupByOutputType, T['by']> & {
        [P in keyof T & keyof ReviewQueueGroupByOutputType]: P extends '_count'
          ? T[P] extends boolean
            ? number
            : GetScalarType<T[P], ReviewQueueGroupByOutputType[P]>
          : GetScalarType<T[P], ReviewQueueGroupByOutputType[P]>;
      }
    >
  >;

  export type ReviewQueueSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<
    {
      id?: boolean;
      uuid?: boolean;
      pull_request_id?: boolean;
      repo_full_name?: boolean;
      pr_number?: boolean;
      pr_title?: boolean;
      status?: boolean;
      not_before?: boolean;
      attempts?: boolean;
      source_comment_url?: boolean;
      source_comment_id?: boolean;
      trigger_source?: boolean;
      retrigger_comment_url?: boolean;
      retriggered_at?: boolean;
      failed_at?: boolean;
      reviewed_at?: boolean;
      created_at?: boolean;
      updated_at?: boolean;
      queueOrder?: boolean | ReviewQueue$queueOrderArgs<ExtArgs>;
      pullRequest?: boolean | ReviewQueue$pullRequestArgs<ExtArgs>;
    },
    ExtArgs['result']['reviewQueue']
  >;

  export type ReviewQueueSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<
    {
      id?: boolean;
      uuid?: boolean;
      pull_request_id?: boolean;
      repo_full_name?: boolean;
      pr_number?: boolean;
      pr_title?: boolean;
      status?: boolean;
      not_before?: boolean;
      attempts?: boolean;
      source_comment_url?: boolean;
      source_comment_id?: boolean;
      trigger_source?: boolean;
      retrigger_comment_url?: boolean;
      retriggered_at?: boolean;
      failed_at?: boolean;
      reviewed_at?: boolean;
      created_at?: boolean;
      updated_at?: boolean;
      pullRequest?: boolean | ReviewQueue$pullRequestArgs<ExtArgs>;
    },
    ExtArgs['result']['reviewQueue']
  >;

  export type ReviewQueueSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<
    {
      id?: boolean;
      uuid?: boolean;
      pull_request_id?: boolean;
      repo_full_name?: boolean;
      pr_number?: boolean;
      pr_title?: boolean;
      status?: boolean;
      not_before?: boolean;
      attempts?: boolean;
      source_comment_url?: boolean;
      source_comment_id?: boolean;
      trigger_source?: boolean;
      retrigger_comment_url?: boolean;
      retriggered_at?: boolean;
      failed_at?: boolean;
      reviewed_at?: boolean;
      created_at?: boolean;
      updated_at?: boolean;
      pullRequest?: boolean | ReviewQueue$pullRequestArgs<ExtArgs>;
    },
    ExtArgs['result']['reviewQueue']
  >;

  export type ReviewQueueSelectScalar = {
    id?: boolean;
    uuid?: boolean;
    pull_request_id?: boolean;
    repo_full_name?: boolean;
    pr_number?: boolean;
    pr_title?: boolean;
    status?: boolean;
    not_before?: boolean;
    attempts?: boolean;
    source_comment_url?: boolean;
    source_comment_id?: boolean;
    trigger_source?: boolean;
    retrigger_comment_url?: boolean;
    retriggered_at?: boolean;
    failed_at?: boolean;
    reviewed_at?: boolean;
    created_at?: boolean;
    updated_at?: boolean;
  };

  export type ReviewQueueOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<
    | 'id'
    | 'uuid'
    | 'pull_request_id'
    | 'repo_full_name'
    | 'pr_number'
    | 'pr_title'
    | 'status'
    | 'not_before'
    | 'attempts'
    | 'source_comment_url'
    | 'source_comment_id'
    | 'trigger_source'
    | 'retrigger_comment_url'
    | 'retriggered_at'
    | 'failed_at'
    | 'reviewed_at'
    | 'created_at'
    | 'updated_at',
    ExtArgs['result']['reviewQueue']
  >;
  export type ReviewQueueInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    queueOrder?: boolean | ReviewQueue$queueOrderArgs<ExtArgs>;
    pullRequest?: boolean | ReviewQueue$pullRequestArgs<ExtArgs>;
  };
  export type ReviewQueueIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    pullRequest?: boolean | ReviewQueue$pullRequestArgs<ExtArgs>;
  };
  export type ReviewQueueIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    pullRequest?: boolean | ReviewQueue$pullRequestArgs<ExtArgs>;
  };

  export type $ReviewQueuePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: 'ReviewQueue';
    objects: {
      queueOrder: Prisma.$QueueOrderPayload<ExtArgs> | null;
      pullRequest: Prisma.$PullRequestPayload<ExtArgs> | null;
    };
    scalars: $Extensions.GetPayloadResult<
      {
        id: number;
        /**
         * Max 36 (UUID v4). Enforced by CHECK in the init migration.
         */
        uuid: string;
        pull_request_id: number | null;
        /**
         * Max 140: GitHub owner/org (<=39) + "/" + repo (<=100). Sources and CHECK in the init migration; mirrored in src/schemas/lengths.ts.
         */
        repo_full_name: string;
        pr_number: number;
        /**
         * Max 256 (GitHub PR title). Set at enqueue time.
         */
        pr_title: string;
        /**
         * Max 25; one of 'pending' | 'retriggered' | 'reviewed' | 'failed' (CHECK in the init migration).
         */
        status: string;
        not_before: Date;
        attempts: number;
        /**
         * Max 512 (GitHub comment URL). Source rate-limit comment that triggered this queue entry.
         */
        source_comment_url: string;
        /**
         * Numeric comment ID extracted from source_comment_url at enqueue time.
         */
        source_comment_id: number;
        /**
         * Max 25; one of 'dashboard_retrigger_now' | 'scheduler' (CHECK in the add_trigger_source_check migration).
         */
        trigger_source: string;
        /**
         * Max 512 (GitHub comment URL). Set by markRetriggered when the retrigger comment is posted.
         */
        retrigger_comment_url: string | null;
        retriggered_at: Date | null;
        failed_at: Date | null;
        reviewed_at: Date | null;
        created_at: Date;
        updated_at: Date;
      },
      ExtArgs['result']['reviewQueue']
    >;
    composites: {};
  };

  type ReviewQueueGetPayload<S extends boolean | null | undefined | ReviewQueueDefaultArgs> = $Result.GetResult<Prisma.$ReviewQueuePayload, S>;

  type ReviewQueueCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = Omit<
    ReviewQueueFindManyArgs,
    'select' | 'include' | 'distinct' | 'omit'
  > & {
    select?: ReviewQueueCountAggregateInputType | true;
  };

  export interface ReviewQueueDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['ReviewQueue']; meta: { name: 'ReviewQueue' } };
    /**
     * Find zero or one ReviewQueue that matches the filter.
     * @param {ReviewQueueFindUniqueArgs} args - Arguments to find a ReviewQueue
     * @example
     * // Get one ReviewQueue
     * const reviewQueue = await prisma.reviewQueue.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends ReviewQueueFindUniqueArgs>(
      args: SelectSubset<T, ReviewQueueFindUniqueArgs<ExtArgs>>,
    ): Prisma__ReviewQueueClient<
      $Result.GetResult<Prisma.$ReviewQueuePayload<ExtArgs>, T, 'findUnique', GlobalOmitOptions> | null,
      null,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find one ReviewQueue that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {ReviewQueueFindUniqueOrThrowArgs} args - Arguments to find a ReviewQueue
     * @example
     * // Get one ReviewQueue
     * const reviewQueue = await prisma.reviewQueue.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends ReviewQueueFindUniqueOrThrowArgs>(
      args: SelectSubset<T, ReviewQueueFindUniqueOrThrowArgs<ExtArgs>>,
    ): Prisma__ReviewQueueClient<
      $Result.GetResult<Prisma.$ReviewQueuePayload<ExtArgs>, T, 'findUniqueOrThrow', GlobalOmitOptions>,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find the first ReviewQueue that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ReviewQueueFindFirstArgs} args - Arguments to find a ReviewQueue
     * @example
     * // Get one ReviewQueue
     * const reviewQueue = await prisma.reviewQueue.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends ReviewQueueFindFirstArgs>(
      args?: SelectSubset<T, ReviewQueueFindFirstArgs<ExtArgs>>,
    ): Prisma__ReviewQueueClient<
      $Result.GetResult<Prisma.$ReviewQueuePayload<ExtArgs>, T, 'findFirst', GlobalOmitOptions> | null,
      null,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find the first ReviewQueue that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ReviewQueueFindFirstOrThrowArgs} args - Arguments to find a ReviewQueue
     * @example
     * // Get one ReviewQueue
     * const reviewQueue = await prisma.reviewQueue.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends ReviewQueueFindFirstOrThrowArgs>(
      args?: SelectSubset<T, ReviewQueueFindFirstOrThrowArgs<ExtArgs>>,
    ): Prisma__ReviewQueueClient<
      $Result.GetResult<Prisma.$ReviewQueuePayload<ExtArgs>, T, 'findFirstOrThrow', GlobalOmitOptions>,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find zero or more ReviewQueues that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ReviewQueueFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all ReviewQueues
     * const reviewQueues = await prisma.reviewQueue.findMany()
     *
     * // Get first 10 ReviewQueues
     * const reviewQueues = await prisma.reviewQueue.findMany({ take: 10 })
     *
     * // Only select the `id`
     * const reviewQueueWithIdOnly = await prisma.reviewQueue.findMany({ select: { id: true } })
     *
     */
    findMany<T extends ReviewQueueFindManyArgs>(
      args?: SelectSubset<T, ReviewQueueFindManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ReviewQueuePayload<ExtArgs>, T, 'findMany', GlobalOmitOptions>>;

    /**
     * Create a ReviewQueue.
     * @param {ReviewQueueCreateArgs} args - Arguments to create a ReviewQueue.
     * @example
     * // Create one ReviewQueue
     * const ReviewQueue = await prisma.reviewQueue.create({
     *   data: {
     *     // ... data to create a ReviewQueue
     *   }
     * })
     *
     */
    create<T extends ReviewQueueCreateArgs>(
      args: SelectSubset<T, ReviewQueueCreateArgs<ExtArgs>>,
    ): Prisma__ReviewQueueClient<$Result.GetResult<Prisma.$ReviewQueuePayload<ExtArgs>, T, 'create', GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;

    /**
     * Create many ReviewQueues.
     * @param {ReviewQueueCreateManyArgs} args - Arguments to create many ReviewQueues.
     * @example
     * // Create many ReviewQueues
     * const reviewQueue = await prisma.reviewQueue.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     */
    createMany<T extends ReviewQueueCreateManyArgs>(args?: SelectSubset<T, ReviewQueueCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Create many ReviewQueues and returns the data saved in the database.
     * @param {ReviewQueueCreateManyAndReturnArgs} args - Arguments to create many ReviewQueues.
     * @example
     * // Create many ReviewQueues
     * const reviewQueue = await prisma.reviewQueue.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Create many ReviewQueues and only return the `id`
     * const reviewQueueWithIdOnly = await prisma.reviewQueue.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    createManyAndReturn<T extends ReviewQueueCreateManyAndReturnArgs>(
      args?: SelectSubset<T, ReviewQueueCreateManyAndReturnArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ReviewQueuePayload<ExtArgs>, T, 'createManyAndReturn', GlobalOmitOptions>>;

    /**
     * Delete a ReviewQueue.
     * @param {ReviewQueueDeleteArgs} args - Arguments to delete one ReviewQueue.
     * @example
     * // Delete one ReviewQueue
     * const ReviewQueue = await prisma.reviewQueue.delete({
     *   where: {
     *     // ... filter to delete one ReviewQueue
     *   }
     * })
     *
     */
    delete<T extends ReviewQueueDeleteArgs>(
      args: SelectSubset<T, ReviewQueueDeleteArgs<ExtArgs>>,
    ): Prisma__ReviewQueueClient<$Result.GetResult<Prisma.$ReviewQueuePayload<ExtArgs>, T, 'delete', GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;

    /**
     * Update one ReviewQueue.
     * @param {ReviewQueueUpdateArgs} args - Arguments to update one ReviewQueue.
     * @example
     * // Update one ReviewQueue
     * const reviewQueue = await prisma.reviewQueue.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    update<T extends ReviewQueueUpdateArgs>(
      args: SelectSubset<T, ReviewQueueUpdateArgs<ExtArgs>>,
    ): Prisma__ReviewQueueClient<$Result.GetResult<Prisma.$ReviewQueuePayload<ExtArgs>, T, 'update', GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;

    /**
     * Delete zero or more ReviewQueues.
     * @param {ReviewQueueDeleteManyArgs} args - Arguments to filter ReviewQueues to delete.
     * @example
     * // Delete a few ReviewQueues
     * const { count } = await prisma.reviewQueue.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     *
     */
    deleteMany<T extends ReviewQueueDeleteManyArgs>(args?: SelectSubset<T, ReviewQueueDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Update zero or more ReviewQueues.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ReviewQueueUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many ReviewQueues
     * const reviewQueue = await prisma.reviewQueue.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    updateMany<T extends ReviewQueueUpdateManyArgs>(args: SelectSubset<T, ReviewQueueUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Update zero or more ReviewQueues and returns the data updated in the database.
     * @param {ReviewQueueUpdateManyAndReturnArgs} args - Arguments to update many ReviewQueues.
     * @example
     * // Update many ReviewQueues
     * const reviewQueue = await prisma.reviewQueue.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Update zero or more ReviewQueues and only return the `id`
     * const reviewQueueWithIdOnly = await prisma.reviewQueue.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    updateManyAndReturn<T extends ReviewQueueUpdateManyAndReturnArgs>(
      args: SelectSubset<T, ReviewQueueUpdateManyAndReturnArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ReviewQueuePayload<ExtArgs>, T, 'updateManyAndReturn', GlobalOmitOptions>>;

    /**
     * Create or update one ReviewQueue.
     * @param {ReviewQueueUpsertArgs} args - Arguments to update or create a ReviewQueue.
     * @example
     * // Update or create a ReviewQueue
     * const reviewQueue = await prisma.reviewQueue.upsert({
     *   create: {
     *     // ... data to create a ReviewQueue
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the ReviewQueue we want to update
     *   }
     * })
     */
    upsert<T extends ReviewQueueUpsertArgs>(
      args: SelectSubset<T, ReviewQueueUpsertArgs<ExtArgs>>,
    ): Prisma__ReviewQueueClient<$Result.GetResult<Prisma.$ReviewQueuePayload<ExtArgs>, T, 'upsert', GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;

    /**
     * Count the number of ReviewQueues.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ReviewQueueCountArgs} args - Arguments to filter ReviewQueues to count.
     * @example
     * // Count the number of ReviewQueues
     * const count = await prisma.reviewQueue.count({
     *   where: {
     *     // ... the filter for the ReviewQueues we want to count
     *   }
     * })
     **/
    count<T extends ReviewQueueCountArgs>(
      args?: Subset<T, ReviewQueueCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any> ? (T['select'] extends true ? number : GetScalarType<T['select'], ReviewQueueCountAggregateOutputType>) : number
    >;

    /**
     * Allows you to perform aggregations operations on a ReviewQueue.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ReviewQueueAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
     **/
    aggregate<T extends ReviewQueueAggregateArgs>(args: Subset<T, ReviewQueueAggregateArgs>): Prisma.PrismaPromise<GetReviewQueueAggregateType<T>>;

    /**
     * Group by ReviewQueue.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ReviewQueueGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     *
     **/
    groupBy<
      T extends ReviewQueueGroupByArgs,
      HasSelectOrTake extends Or<Extends<'skip', Keys<T>>, Extends<'take', Keys<T>>>,
      OrderByArg extends True extends HasSelectOrTake ? { orderBy: ReviewQueueGroupByArgs['orderBy'] } : { orderBy?: ReviewQueueGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
        ? `Error: "by" must not be empty.`
        : HavingValid extends False
          ? {
              [P in HavingFields]: P extends ByFields
                ? never
                : P extends string
                  ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
                  : [Error, 'Field ', P, ` in "having" needs to be provided in "by"`];
            }[HavingFields]
          : 'take' extends Keys<T>
            ? 'orderBy' extends Keys<T>
              ? ByValid extends True
                ? {}
                : {
                    [P in OrderFields]: P extends ByFields ? never : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                  }[OrderFields]
              : 'Error: If you provide "take", you also need to provide "orderBy"'
            : 'skip' extends Keys<T>
              ? 'orderBy' extends Keys<T>
                ? ByValid extends True
                  ? {}
                  : {
                      [P in OrderFields]: P extends ByFields ? never : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                    }[OrderFields]
                : 'Error: If you provide "skip", you also need to provide "orderBy"'
              : ByValid extends True
                ? {}
                : {
                    [P in OrderFields]: P extends ByFields ? never : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                  }[OrderFields],
    >(
      args: SubsetIntersection<T, ReviewQueueGroupByArgs, OrderByArg> & InputErrors,
    ): {} extends InputErrors ? GetReviewQueueGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>;
    /**
     * Fields of the ReviewQueue model
     */
    readonly fields: ReviewQueueFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for ReviewQueue.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__ReviewQueueClient<
    T,
    Null = never,
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
    GlobalOmitOptions = {},
  > extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: 'PrismaPromise';
    queueOrder<T extends ReviewQueue$queueOrderArgs<ExtArgs> = {}>(
      args?: Subset<T, ReviewQueue$queueOrderArgs<ExtArgs>>,
    ): Prisma__QueueOrderClient<
      $Result.GetResult<Prisma.$QueueOrderPayload<ExtArgs>, T, 'findUniqueOrThrow', GlobalOmitOptions> | null,
      null,
      ExtArgs,
      GlobalOmitOptions
    >;
    pullRequest<T extends ReviewQueue$pullRequestArgs<ExtArgs> = {}>(
      args?: Subset<T, ReviewQueue$pullRequestArgs<ExtArgs>>,
    ): Prisma__PullRequestClient<
      $Result.GetResult<Prisma.$PullRequestPayload<ExtArgs>, T, 'findUniqueOrThrow', GlobalOmitOptions> | null,
      null,
      ExtArgs,
      GlobalOmitOptions
    >;
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(
      onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null,
      onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null,
    ): $Utils.JsPromise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>;
  }

  /**
   * Fields of the ReviewQueue model
   */
  interface ReviewQueueFieldRefs {
    readonly id: FieldRef<'ReviewQueue', 'Int'>;
    readonly uuid: FieldRef<'ReviewQueue', 'String'>;
    readonly pull_request_id: FieldRef<'ReviewQueue', 'Int'>;
    readonly repo_full_name: FieldRef<'ReviewQueue', 'String'>;
    readonly pr_number: FieldRef<'ReviewQueue', 'Int'>;
    readonly pr_title: FieldRef<'ReviewQueue', 'String'>;
    readonly status: FieldRef<'ReviewQueue', 'String'>;
    readonly not_before: FieldRef<'ReviewQueue', 'DateTime'>;
    readonly attempts: FieldRef<'ReviewQueue', 'Int'>;
    readonly source_comment_url: FieldRef<'ReviewQueue', 'String'>;
    readonly source_comment_id: FieldRef<'ReviewQueue', 'Int'>;
    readonly trigger_source: FieldRef<'ReviewQueue', 'String'>;
    readonly retrigger_comment_url: FieldRef<'ReviewQueue', 'String'>;
    readonly retriggered_at: FieldRef<'ReviewQueue', 'DateTime'>;
    readonly failed_at: FieldRef<'ReviewQueue', 'DateTime'>;
    readonly reviewed_at: FieldRef<'ReviewQueue', 'DateTime'>;
    readonly created_at: FieldRef<'ReviewQueue', 'DateTime'>;
    readonly updated_at: FieldRef<'ReviewQueue', 'DateTime'>;
  }

  // Custom InputTypes
  /**
   * ReviewQueue findUnique
   */
  export type ReviewQueueFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ReviewQueue
     */
    select?: ReviewQueueSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the ReviewQueue
     */
    omit?: ReviewQueueOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ReviewQueueInclude<ExtArgs> | null;
    /**
     * Filter, which ReviewQueue to fetch.
     */
    where: ReviewQueueWhereUniqueInput;
  };

  /**
   * ReviewQueue findUniqueOrThrow
   */
  export type ReviewQueueFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ReviewQueue
     */
    select?: ReviewQueueSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the ReviewQueue
     */
    omit?: ReviewQueueOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ReviewQueueInclude<ExtArgs> | null;
    /**
     * Filter, which ReviewQueue to fetch.
     */
    where: ReviewQueueWhereUniqueInput;
  };

  /**
   * ReviewQueue findFirst
   */
  export type ReviewQueueFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ReviewQueue
     */
    select?: ReviewQueueSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the ReviewQueue
     */
    omit?: ReviewQueueOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ReviewQueueInclude<ExtArgs> | null;
    /**
     * Filter, which ReviewQueue to fetch.
     */
    where?: ReviewQueueWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of ReviewQueues to fetch.
     */
    orderBy?: ReviewQueueOrderByWithRelationInput | ReviewQueueOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for ReviewQueues.
     */
    cursor?: ReviewQueueWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` ReviewQueues from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` ReviewQueues.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of ReviewQueues.
     */
    distinct?: ReviewQueueScalarFieldEnum | ReviewQueueScalarFieldEnum[];
  };

  /**
   * ReviewQueue findFirstOrThrow
   */
  export type ReviewQueueFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ReviewQueue
     */
    select?: ReviewQueueSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the ReviewQueue
     */
    omit?: ReviewQueueOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ReviewQueueInclude<ExtArgs> | null;
    /**
     * Filter, which ReviewQueue to fetch.
     */
    where?: ReviewQueueWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of ReviewQueues to fetch.
     */
    orderBy?: ReviewQueueOrderByWithRelationInput | ReviewQueueOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for ReviewQueues.
     */
    cursor?: ReviewQueueWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` ReviewQueues from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` ReviewQueues.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of ReviewQueues.
     */
    distinct?: ReviewQueueScalarFieldEnum | ReviewQueueScalarFieldEnum[];
  };

  /**
   * ReviewQueue findMany
   */
  export type ReviewQueueFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ReviewQueue
     */
    select?: ReviewQueueSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the ReviewQueue
     */
    omit?: ReviewQueueOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ReviewQueueInclude<ExtArgs> | null;
    /**
     * Filter, which ReviewQueues to fetch.
     */
    where?: ReviewQueueWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of ReviewQueues to fetch.
     */
    orderBy?: ReviewQueueOrderByWithRelationInput | ReviewQueueOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for listing ReviewQueues.
     */
    cursor?: ReviewQueueWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` ReviewQueues from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` ReviewQueues.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of ReviewQueues.
     */
    distinct?: ReviewQueueScalarFieldEnum | ReviewQueueScalarFieldEnum[];
  };

  /**
   * ReviewQueue create
   */
  export type ReviewQueueCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ReviewQueue
     */
    select?: ReviewQueueSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the ReviewQueue
     */
    omit?: ReviewQueueOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ReviewQueueInclude<ExtArgs> | null;
    /**
     * The data needed to create a ReviewQueue.
     */
    data: XOR<ReviewQueueCreateInput, ReviewQueueUncheckedCreateInput>;
  };

  /**
   * ReviewQueue createMany
   */
  export type ReviewQueueCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many ReviewQueues.
     */
    data: ReviewQueueCreateManyInput | ReviewQueueCreateManyInput[];
  };

  /**
   * ReviewQueue createManyAndReturn
   */
  export type ReviewQueueCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ReviewQueue
     */
    select?: ReviewQueueSelectCreateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the ReviewQueue
     */
    omit?: ReviewQueueOmit<ExtArgs> | null;
    /**
     * The data used to create many ReviewQueues.
     */
    data: ReviewQueueCreateManyInput | ReviewQueueCreateManyInput[];
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ReviewQueueIncludeCreateManyAndReturn<ExtArgs> | null;
  };

  /**
   * ReviewQueue update
   */
  export type ReviewQueueUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ReviewQueue
     */
    select?: ReviewQueueSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the ReviewQueue
     */
    omit?: ReviewQueueOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ReviewQueueInclude<ExtArgs> | null;
    /**
     * The data needed to update a ReviewQueue.
     */
    data: XOR<ReviewQueueUpdateInput, ReviewQueueUncheckedUpdateInput>;
    /**
     * Choose, which ReviewQueue to update.
     */
    where: ReviewQueueWhereUniqueInput;
  };

  /**
   * ReviewQueue updateMany
   */
  export type ReviewQueueUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update ReviewQueues.
     */
    data: XOR<ReviewQueueUpdateManyMutationInput, ReviewQueueUncheckedUpdateManyInput>;
    /**
     * Filter which ReviewQueues to update
     */
    where?: ReviewQueueWhereInput;
    /**
     * Limit how many ReviewQueues to update.
     */
    limit?: number;
  };

  /**
   * ReviewQueue updateManyAndReturn
   */
  export type ReviewQueueUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ReviewQueue
     */
    select?: ReviewQueueSelectUpdateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the ReviewQueue
     */
    omit?: ReviewQueueOmit<ExtArgs> | null;
    /**
     * The data used to update ReviewQueues.
     */
    data: XOR<ReviewQueueUpdateManyMutationInput, ReviewQueueUncheckedUpdateManyInput>;
    /**
     * Filter which ReviewQueues to update
     */
    where?: ReviewQueueWhereInput;
    /**
     * Limit how many ReviewQueues to update.
     */
    limit?: number;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ReviewQueueIncludeUpdateManyAndReturn<ExtArgs> | null;
  };

  /**
   * ReviewQueue upsert
   */
  export type ReviewQueueUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ReviewQueue
     */
    select?: ReviewQueueSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the ReviewQueue
     */
    omit?: ReviewQueueOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ReviewQueueInclude<ExtArgs> | null;
    /**
     * The filter to search for the ReviewQueue to update in case it exists.
     */
    where: ReviewQueueWhereUniqueInput;
    /**
     * In case the ReviewQueue found by the `where` argument doesn't exist, create a new ReviewQueue with this data.
     */
    create: XOR<ReviewQueueCreateInput, ReviewQueueUncheckedCreateInput>;
    /**
     * In case the ReviewQueue was found with the provided `where` argument, update it with this data.
     */
    update: XOR<ReviewQueueUpdateInput, ReviewQueueUncheckedUpdateInput>;
  };

  /**
   * ReviewQueue delete
   */
  export type ReviewQueueDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ReviewQueue
     */
    select?: ReviewQueueSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the ReviewQueue
     */
    omit?: ReviewQueueOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ReviewQueueInclude<ExtArgs> | null;
    /**
     * Filter which ReviewQueue to delete.
     */
    where: ReviewQueueWhereUniqueInput;
  };

  /**
   * ReviewQueue deleteMany
   */
  export type ReviewQueueDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which ReviewQueues to delete
     */
    where?: ReviewQueueWhereInput;
    /**
     * Limit how many ReviewQueues to delete.
     */
    limit?: number;
  };

  /**
   * ReviewQueue.queueOrder
   */
  export type ReviewQueue$queueOrderArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the QueueOrder
     */
    select?: QueueOrderSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the QueueOrder
     */
    omit?: QueueOrderOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: QueueOrderInclude<ExtArgs> | null;
    where?: QueueOrderWhereInput;
  };

  /**
   * ReviewQueue.pullRequest
   */
  export type ReviewQueue$pullRequestArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PullRequest
     */
    select?: PullRequestSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the PullRequest
     */
    omit?: PullRequestOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PullRequestInclude<ExtArgs> | null;
    where?: PullRequestWhereInput;
  };

  /**
   * ReviewQueue without action
   */
  export type ReviewQueueDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ReviewQueue
     */
    select?: ReviewQueueSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the ReviewQueue
     */
    omit?: ReviewQueueOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ReviewQueueInclude<ExtArgs> | null;
  };

  /**
   * Model Event
   */

  export type AggregateEvent = {
    _count: EventCountAggregateOutputType | null;
    _avg: EventAvgAggregateOutputType | null;
    _sum: EventSumAggregateOutputType | null;
    _min: EventMinAggregateOutputType | null;
    _max: EventMaxAggregateOutputType | null;
  };

  export type EventAvgAggregateOutputType = {
    id: number | null;
    pull_request_id: number | null;
    pr_number: number | null;
  };

  export type EventSumAggregateOutputType = {
    id: number | null;
    pull_request_id: number | null;
    pr_number: number | null;
  };

  export type EventMinAggregateOutputType = {
    id: number | null;
    uuid: string | null;
    ts: Date | null;
    type: string | null;
    pull_request_id: number | null;
    repo_full_name: string | null;
    pr_number: number | null;
    correlation_id: string | null;
    request_id: string | null;
    version: string | null;
    payload: string | null;
    metadata: string | null;
  };

  export type EventMaxAggregateOutputType = {
    id: number | null;
    uuid: string | null;
    ts: Date | null;
    type: string | null;
    pull_request_id: number | null;
    repo_full_name: string | null;
    pr_number: number | null;
    correlation_id: string | null;
    request_id: string | null;
    version: string | null;
    payload: string | null;
    metadata: string | null;
  };

  export type EventCountAggregateOutputType = {
    id: number;
    uuid: number;
    ts: number;
    type: number;
    pull_request_id: number;
    repo_full_name: number;
    pr_number: number;
    correlation_id: number;
    request_id: number;
    version: number;
    payload: number;
    metadata: number;
    _all: number;
  };

  export type EventAvgAggregateInputType = {
    id?: true;
    pull_request_id?: true;
    pr_number?: true;
  };

  export type EventSumAggregateInputType = {
    id?: true;
    pull_request_id?: true;
    pr_number?: true;
  };

  export type EventMinAggregateInputType = {
    id?: true;
    uuid?: true;
    ts?: true;
    type?: true;
    pull_request_id?: true;
    repo_full_name?: true;
    pr_number?: true;
    correlation_id?: true;
    request_id?: true;
    version?: true;
    payload?: true;
    metadata?: true;
  };

  export type EventMaxAggregateInputType = {
    id?: true;
    uuid?: true;
    ts?: true;
    type?: true;
    pull_request_id?: true;
    repo_full_name?: true;
    pr_number?: true;
    correlation_id?: true;
    request_id?: true;
    version?: true;
    payload?: true;
    metadata?: true;
  };

  export type EventCountAggregateInputType = {
    id?: true;
    uuid?: true;
    ts?: true;
    type?: true;
    pull_request_id?: true;
    repo_full_name?: true;
    pr_number?: true;
    correlation_id?: true;
    request_id?: true;
    version?: true;
    payload?: true;
    metadata?: true;
    _all?: true;
  };

  export type EventAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Event to aggregate.
     */
    where?: EventWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of Events to fetch.
     */
    orderBy?: EventOrderByWithRelationInput | EventOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the start position
     */
    cursor?: EventWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` Events from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` Events.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Count returned Events
     **/
    _count?: true | EventCountAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to average
     **/
    _avg?: EventAvgAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to sum
     **/
    _sum?: EventSumAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the minimum value
     **/
    _min?: EventMinAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the maximum value
     **/
    _max?: EventMaxAggregateInputType;
  };

  export type GetEventAggregateType<T extends EventAggregateArgs> = {
    [P in keyof T & keyof AggregateEvent]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateEvent[P]>
      : GetScalarType<T[P], AggregateEvent[P]>;
  };

  export type EventGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: EventWhereInput;
    orderBy?: EventOrderByWithAggregationInput | EventOrderByWithAggregationInput[];
    by: EventScalarFieldEnum[] | EventScalarFieldEnum;
    having?: EventScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: EventCountAggregateInputType | true;
    _avg?: EventAvgAggregateInputType;
    _sum?: EventSumAggregateInputType;
    _min?: EventMinAggregateInputType;
    _max?: EventMaxAggregateInputType;
  };

  export type EventGroupByOutputType = {
    id: number;
    uuid: string;
    ts: Date;
    type: string;
    pull_request_id: number | null;
    repo_full_name: string;
    pr_number: number;
    correlation_id: string;
    request_id: string | null;
    version: string;
    payload: string;
    metadata: string | null;
    _count: EventCountAggregateOutputType | null;
    _avg: EventAvgAggregateOutputType | null;
    _sum: EventSumAggregateOutputType | null;
    _min: EventMinAggregateOutputType | null;
    _max: EventMaxAggregateOutputType | null;
  };

  type GetEventGroupByPayload<T extends EventGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<EventGroupByOutputType, T['by']> & {
        [P in keyof T & keyof EventGroupByOutputType]: P extends '_count'
          ? T[P] extends boolean
            ? number
            : GetScalarType<T[P], EventGroupByOutputType[P]>
          : GetScalarType<T[P], EventGroupByOutputType[P]>;
      }
    >
  >;

  export type EventSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<
    {
      id?: boolean;
      uuid?: boolean;
      ts?: boolean;
      type?: boolean;
      pull_request_id?: boolean;
      repo_full_name?: boolean;
      pr_number?: boolean;
      correlation_id?: boolean;
      request_id?: boolean;
      version?: boolean;
      payload?: boolean;
      metadata?: boolean;
      pullRequest?: boolean | Event$pullRequestArgs<ExtArgs>;
    },
    ExtArgs['result']['event']
  >;

  export type EventSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<
    {
      id?: boolean;
      uuid?: boolean;
      ts?: boolean;
      type?: boolean;
      pull_request_id?: boolean;
      repo_full_name?: boolean;
      pr_number?: boolean;
      correlation_id?: boolean;
      request_id?: boolean;
      version?: boolean;
      payload?: boolean;
      metadata?: boolean;
      pullRequest?: boolean | Event$pullRequestArgs<ExtArgs>;
    },
    ExtArgs['result']['event']
  >;

  export type EventSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<
    {
      id?: boolean;
      uuid?: boolean;
      ts?: boolean;
      type?: boolean;
      pull_request_id?: boolean;
      repo_full_name?: boolean;
      pr_number?: boolean;
      correlation_id?: boolean;
      request_id?: boolean;
      version?: boolean;
      payload?: boolean;
      metadata?: boolean;
      pullRequest?: boolean | Event$pullRequestArgs<ExtArgs>;
    },
    ExtArgs['result']['event']
  >;

  export type EventSelectScalar = {
    id?: boolean;
    uuid?: boolean;
    ts?: boolean;
    type?: boolean;
    pull_request_id?: boolean;
    repo_full_name?: boolean;
    pr_number?: boolean;
    correlation_id?: boolean;
    request_id?: boolean;
    version?: boolean;
    payload?: boolean;
    metadata?: boolean;
  };

  export type EventOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<
    'id' | 'uuid' | 'ts' | 'type' | 'pull_request_id' | 'repo_full_name' | 'pr_number' | 'correlation_id' | 'request_id' | 'version' | 'payload' | 'metadata',
    ExtArgs['result']['event']
  >;
  export type EventInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    pullRequest?: boolean | Event$pullRequestArgs<ExtArgs>;
  };
  export type EventIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    pullRequest?: boolean | Event$pullRequestArgs<ExtArgs>;
  };
  export type EventIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    pullRequest?: boolean | Event$pullRequestArgs<ExtArgs>;
  };

  export type $EventPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: 'Event';
    objects: {
      pullRequest: Prisma.$PullRequestPayload<ExtArgs> | null;
    };
    scalars: $Extensions.GetPayloadResult<
      {
        id: number;
        /**
         * Max 36 (UUID v4).
         */
        uuid: string;
        ts: Date;
        /**
         * Max 25; one of 'detected' | 'enqueued' | 'retriggered' | 'bypassed' | 'completed' | 'failed' (CHECK in the init + bypass migration).
         */
        type: string;
        pull_request_id: number | null;
        /**
         * Max 140: GitHub owner/org + "/" + repo. See review_queue / init migration for sources.
         */
        repo_full_name: string;
        pr_number: number;
        /**
         * Max 73 (two UUID v4 of 36 + 1 delimiter).
         */
        correlation_id: string;
        /**
         * Max 73 (two UUID v4 of 36 + 1 delimiter).
         */
        request_id: string | null;
        /**
         * Max 32 (semver, incl. prerelease/build metadata).
         */
        version: string;
        /**
         * JSON blob; max 16384. Type-specific fields validated by Zod in src/schemas/events.ts.
         */
        payload: string;
        /**
         * JSON blob; max 2048. Provenance (git sha, build id, host, node version).
         */
        metadata: string | null;
      },
      ExtArgs['result']['event']
    >;
    composites: {};
  };

  type EventGetPayload<S extends boolean | null | undefined | EventDefaultArgs> = $Result.GetResult<Prisma.$EventPayload, S>;

  type EventCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = Omit<
    EventFindManyArgs,
    'select' | 'include' | 'distinct' | 'omit'
  > & {
    select?: EventCountAggregateInputType | true;
  };

  export interface EventDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Event']; meta: { name: 'Event' } };
    /**
     * Find zero or one Event that matches the filter.
     * @param {EventFindUniqueArgs} args - Arguments to find a Event
     * @example
     * // Get one Event
     * const event = await prisma.event.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends EventFindUniqueArgs>(
      args: SelectSubset<T, EventFindUniqueArgs<ExtArgs>>,
    ): Prisma__EventClient<$Result.GetResult<Prisma.$EventPayload<ExtArgs>, T, 'findUnique', GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;

    /**
     * Find one Event that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {EventFindUniqueOrThrowArgs} args - Arguments to find a Event
     * @example
     * // Get one Event
     * const event = await prisma.event.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends EventFindUniqueOrThrowArgs>(
      args: SelectSubset<T, EventFindUniqueOrThrowArgs<ExtArgs>>,
    ): Prisma__EventClient<$Result.GetResult<Prisma.$EventPayload<ExtArgs>, T, 'findUniqueOrThrow', GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;

    /**
     * Find the first Event that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EventFindFirstArgs} args - Arguments to find a Event
     * @example
     * // Get one Event
     * const event = await prisma.event.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends EventFindFirstArgs>(
      args?: SelectSubset<T, EventFindFirstArgs<ExtArgs>>,
    ): Prisma__EventClient<$Result.GetResult<Prisma.$EventPayload<ExtArgs>, T, 'findFirst', GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;

    /**
     * Find the first Event that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EventFindFirstOrThrowArgs} args - Arguments to find a Event
     * @example
     * // Get one Event
     * const event = await prisma.event.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends EventFindFirstOrThrowArgs>(
      args?: SelectSubset<T, EventFindFirstOrThrowArgs<ExtArgs>>,
    ): Prisma__EventClient<$Result.GetResult<Prisma.$EventPayload<ExtArgs>, T, 'findFirstOrThrow', GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;

    /**
     * Find zero or more Events that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EventFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Events
     * const events = await prisma.event.findMany()
     *
     * // Get first 10 Events
     * const events = await prisma.event.findMany({ take: 10 })
     *
     * // Only select the `id`
     * const eventWithIdOnly = await prisma.event.findMany({ select: { id: true } })
     *
     */
    findMany<T extends EventFindManyArgs>(
      args?: SelectSubset<T, EventFindManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<$Result.GetResult<Prisma.$EventPayload<ExtArgs>, T, 'findMany', GlobalOmitOptions>>;

    /**
     * Create a Event.
     * @param {EventCreateArgs} args - Arguments to create a Event.
     * @example
     * // Create one Event
     * const Event = await prisma.event.create({
     *   data: {
     *     // ... data to create a Event
     *   }
     * })
     *
     */
    create<T extends EventCreateArgs>(
      args: SelectSubset<T, EventCreateArgs<ExtArgs>>,
    ): Prisma__EventClient<$Result.GetResult<Prisma.$EventPayload<ExtArgs>, T, 'create', GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;

    /**
     * Create many Events.
     * @param {EventCreateManyArgs} args - Arguments to create many Events.
     * @example
     * // Create many Events
     * const event = await prisma.event.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     */
    createMany<T extends EventCreateManyArgs>(args?: SelectSubset<T, EventCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Create many Events and returns the data saved in the database.
     * @param {EventCreateManyAndReturnArgs} args - Arguments to create many Events.
     * @example
     * // Create many Events
     * const event = await prisma.event.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Create many Events and only return the `id`
     * const eventWithIdOnly = await prisma.event.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    createManyAndReturn<T extends EventCreateManyAndReturnArgs>(
      args?: SelectSubset<T, EventCreateManyAndReturnArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<$Result.GetResult<Prisma.$EventPayload<ExtArgs>, T, 'createManyAndReturn', GlobalOmitOptions>>;

    /**
     * Delete a Event.
     * @param {EventDeleteArgs} args - Arguments to delete one Event.
     * @example
     * // Delete one Event
     * const Event = await prisma.event.delete({
     *   where: {
     *     // ... filter to delete one Event
     *   }
     * })
     *
     */
    delete<T extends EventDeleteArgs>(
      args: SelectSubset<T, EventDeleteArgs<ExtArgs>>,
    ): Prisma__EventClient<$Result.GetResult<Prisma.$EventPayload<ExtArgs>, T, 'delete', GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;

    /**
     * Update one Event.
     * @param {EventUpdateArgs} args - Arguments to update one Event.
     * @example
     * // Update one Event
     * const event = await prisma.event.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    update<T extends EventUpdateArgs>(
      args: SelectSubset<T, EventUpdateArgs<ExtArgs>>,
    ): Prisma__EventClient<$Result.GetResult<Prisma.$EventPayload<ExtArgs>, T, 'update', GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;

    /**
     * Delete zero or more Events.
     * @param {EventDeleteManyArgs} args - Arguments to filter Events to delete.
     * @example
     * // Delete a few Events
     * const { count } = await prisma.event.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     *
     */
    deleteMany<T extends EventDeleteManyArgs>(args?: SelectSubset<T, EventDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Update zero or more Events.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EventUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Events
     * const event = await prisma.event.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    updateMany<T extends EventUpdateManyArgs>(args: SelectSubset<T, EventUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Update zero or more Events and returns the data updated in the database.
     * @param {EventUpdateManyAndReturnArgs} args - Arguments to update many Events.
     * @example
     * // Update many Events
     * const event = await prisma.event.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Update zero or more Events and only return the `id`
     * const eventWithIdOnly = await prisma.event.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    updateManyAndReturn<T extends EventUpdateManyAndReturnArgs>(
      args: SelectSubset<T, EventUpdateManyAndReturnArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<$Result.GetResult<Prisma.$EventPayload<ExtArgs>, T, 'updateManyAndReturn', GlobalOmitOptions>>;

    /**
     * Create or update one Event.
     * @param {EventUpsertArgs} args - Arguments to update or create a Event.
     * @example
     * // Update or create a Event
     * const event = await prisma.event.upsert({
     *   create: {
     *     // ... data to create a Event
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Event we want to update
     *   }
     * })
     */
    upsert<T extends EventUpsertArgs>(
      args: SelectSubset<T, EventUpsertArgs<ExtArgs>>,
    ): Prisma__EventClient<$Result.GetResult<Prisma.$EventPayload<ExtArgs>, T, 'upsert', GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;

    /**
     * Count the number of Events.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EventCountArgs} args - Arguments to filter Events to count.
     * @example
     * // Count the number of Events
     * const count = await prisma.event.count({
     *   where: {
     *     // ... the filter for the Events we want to count
     *   }
     * })
     **/
    count<T extends EventCountArgs>(
      args?: Subset<T, EventCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any> ? (T['select'] extends true ? number : GetScalarType<T['select'], EventCountAggregateOutputType>) : number
    >;

    /**
     * Allows you to perform aggregations operations on a Event.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EventAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
     **/
    aggregate<T extends EventAggregateArgs>(args: Subset<T, EventAggregateArgs>): Prisma.PrismaPromise<GetEventAggregateType<T>>;

    /**
     * Group by Event.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EventGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     *
     **/
    groupBy<
      T extends EventGroupByArgs,
      HasSelectOrTake extends Or<Extends<'skip', Keys<T>>, Extends<'take', Keys<T>>>,
      OrderByArg extends True extends HasSelectOrTake ? { orderBy: EventGroupByArgs['orderBy'] } : { orderBy?: EventGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
        ? `Error: "by" must not be empty.`
        : HavingValid extends False
          ? {
              [P in HavingFields]: P extends ByFields
                ? never
                : P extends string
                  ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
                  : [Error, 'Field ', P, ` in "having" needs to be provided in "by"`];
            }[HavingFields]
          : 'take' extends Keys<T>
            ? 'orderBy' extends Keys<T>
              ? ByValid extends True
                ? {}
                : {
                    [P in OrderFields]: P extends ByFields ? never : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                  }[OrderFields]
              : 'Error: If you provide "take", you also need to provide "orderBy"'
            : 'skip' extends Keys<T>
              ? 'orderBy' extends Keys<T>
                ? ByValid extends True
                  ? {}
                  : {
                      [P in OrderFields]: P extends ByFields ? never : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                    }[OrderFields]
                : 'Error: If you provide "skip", you also need to provide "orderBy"'
              : ByValid extends True
                ? {}
                : {
                    [P in OrderFields]: P extends ByFields ? never : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                  }[OrderFields],
    >(
      args: SubsetIntersection<T, EventGroupByArgs, OrderByArg> & InputErrors,
    ): {} extends InputErrors ? GetEventGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>;
    /**
     * Fields of the Event model
     */
    readonly fields: EventFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Event.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__EventClient<
    T,
    Null = never,
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
    GlobalOmitOptions = {},
  > extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: 'PrismaPromise';
    pullRequest<T extends Event$pullRequestArgs<ExtArgs> = {}>(
      args?: Subset<T, Event$pullRequestArgs<ExtArgs>>,
    ): Prisma__PullRequestClient<
      $Result.GetResult<Prisma.$PullRequestPayload<ExtArgs>, T, 'findUniqueOrThrow', GlobalOmitOptions> | null,
      null,
      ExtArgs,
      GlobalOmitOptions
    >;
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(
      onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null,
      onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null,
    ): $Utils.JsPromise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>;
  }

  /**
   * Fields of the Event model
   */
  interface EventFieldRefs {
    readonly id: FieldRef<'Event', 'Int'>;
    readonly uuid: FieldRef<'Event', 'String'>;
    readonly ts: FieldRef<'Event', 'DateTime'>;
    readonly type: FieldRef<'Event', 'String'>;
    readonly pull_request_id: FieldRef<'Event', 'Int'>;
    readonly repo_full_name: FieldRef<'Event', 'String'>;
    readonly pr_number: FieldRef<'Event', 'Int'>;
    readonly correlation_id: FieldRef<'Event', 'String'>;
    readonly request_id: FieldRef<'Event', 'String'>;
    readonly version: FieldRef<'Event', 'String'>;
    readonly payload: FieldRef<'Event', 'String'>;
    readonly metadata: FieldRef<'Event', 'String'>;
  }

  // Custom InputTypes
  /**
   * Event findUnique
   */
  export type EventFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Event
     */
    select?: EventSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Event
     */
    omit?: EventOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EventInclude<ExtArgs> | null;
    /**
     * Filter, which Event to fetch.
     */
    where: EventWhereUniqueInput;
  };

  /**
   * Event findUniqueOrThrow
   */
  export type EventFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Event
     */
    select?: EventSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Event
     */
    omit?: EventOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EventInclude<ExtArgs> | null;
    /**
     * Filter, which Event to fetch.
     */
    where: EventWhereUniqueInput;
  };

  /**
   * Event findFirst
   */
  export type EventFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Event
     */
    select?: EventSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Event
     */
    omit?: EventOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EventInclude<ExtArgs> | null;
    /**
     * Filter, which Event to fetch.
     */
    where?: EventWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of Events to fetch.
     */
    orderBy?: EventOrderByWithRelationInput | EventOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for Events.
     */
    cursor?: EventWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` Events from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` Events.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of Events.
     */
    distinct?: EventScalarFieldEnum | EventScalarFieldEnum[];
  };

  /**
   * Event findFirstOrThrow
   */
  export type EventFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Event
     */
    select?: EventSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Event
     */
    omit?: EventOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EventInclude<ExtArgs> | null;
    /**
     * Filter, which Event to fetch.
     */
    where?: EventWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of Events to fetch.
     */
    orderBy?: EventOrderByWithRelationInput | EventOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for Events.
     */
    cursor?: EventWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` Events from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` Events.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of Events.
     */
    distinct?: EventScalarFieldEnum | EventScalarFieldEnum[];
  };

  /**
   * Event findMany
   */
  export type EventFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Event
     */
    select?: EventSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Event
     */
    omit?: EventOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EventInclude<ExtArgs> | null;
    /**
     * Filter, which Events to fetch.
     */
    where?: EventWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of Events to fetch.
     */
    orderBy?: EventOrderByWithRelationInput | EventOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for listing Events.
     */
    cursor?: EventWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` Events from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` Events.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of Events.
     */
    distinct?: EventScalarFieldEnum | EventScalarFieldEnum[];
  };

  /**
   * Event create
   */
  export type EventCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Event
     */
    select?: EventSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Event
     */
    omit?: EventOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EventInclude<ExtArgs> | null;
    /**
     * The data needed to create a Event.
     */
    data: XOR<EventCreateInput, EventUncheckedCreateInput>;
  };

  /**
   * Event createMany
   */
  export type EventCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Events.
     */
    data: EventCreateManyInput | EventCreateManyInput[];
  };

  /**
   * Event createManyAndReturn
   */
  export type EventCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Event
     */
    select?: EventSelectCreateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the Event
     */
    omit?: EventOmit<ExtArgs> | null;
    /**
     * The data used to create many Events.
     */
    data: EventCreateManyInput | EventCreateManyInput[];
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EventIncludeCreateManyAndReturn<ExtArgs> | null;
  };

  /**
   * Event update
   */
  export type EventUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Event
     */
    select?: EventSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Event
     */
    omit?: EventOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EventInclude<ExtArgs> | null;
    /**
     * The data needed to update a Event.
     */
    data: XOR<EventUpdateInput, EventUncheckedUpdateInput>;
    /**
     * Choose, which Event to update.
     */
    where: EventWhereUniqueInput;
  };

  /**
   * Event updateMany
   */
  export type EventUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Events.
     */
    data: XOR<EventUpdateManyMutationInput, EventUncheckedUpdateManyInput>;
    /**
     * Filter which Events to update
     */
    where?: EventWhereInput;
    /**
     * Limit how many Events to update.
     */
    limit?: number;
  };

  /**
   * Event updateManyAndReturn
   */
  export type EventUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Event
     */
    select?: EventSelectUpdateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the Event
     */
    omit?: EventOmit<ExtArgs> | null;
    /**
     * The data used to update Events.
     */
    data: XOR<EventUpdateManyMutationInput, EventUncheckedUpdateManyInput>;
    /**
     * Filter which Events to update
     */
    where?: EventWhereInput;
    /**
     * Limit how many Events to update.
     */
    limit?: number;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EventIncludeUpdateManyAndReturn<ExtArgs> | null;
  };

  /**
   * Event upsert
   */
  export type EventUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Event
     */
    select?: EventSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Event
     */
    omit?: EventOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EventInclude<ExtArgs> | null;
    /**
     * The filter to search for the Event to update in case it exists.
     */
    where: EventWhereUniqueInput;
    /**
     * In case the Event found by the `where` argument doesn't exist, create a new Event with this data.
     */
    create: XOR<EventCreateInput, EventUncheckedCreateInput>;
    /**
     * In case the Event was found with the provided `where` argument, update it with this data.
     */
    update: XOR<EventUpdateInput, EventUncheckedUpdateInput>;
  };

  /**
   * Event delete
   */
  export type EventDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Event
     */
    select?: EventSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Event
     */
    omit?: EventOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EventInclude<ExtArgs> | null;
    /**
     * Filter which Event to delete.
     */
    where: EventWhereUniqueInput;
  };

  /**
   * Event deleteMany
   */
  export type EventDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Events to delete
     */
    where?: EventWhereInput;
    /**
     * Limit how many Events to delete.
     */
    limit?: number;
  };

  /**
   * Event.pullRequest
   */
  export type Event$pullRequestArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PullRequest
     */
    select?: PullRequestSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the PullRequest
     */
    omit?: PullRequestOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: PullRequestInclude<ExtArgs> | null;
    where?: PullRequestWhereInput;
  };

  /**
   * Event without action
   */
  export type EventDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Event
     */
    select?: EventSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the Event
     */
    omit?: EventOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: EventInclude<ExtArgs> | null;
  };

  /**
   * Model QueueOrder
   */

  export type AggregateQueueOrder = {
    _count: QueueOrderCountAggregateOutputType | null;
    _avg: QueueOrderAvgAggregateOutputType | null;
    _sum: QueueOrderSumAggregateOutputType | null;
    _min: QueueOrderMinAggregateOutputType | null;
    _max: QueueOrderMaxAggregateOutputType | null;
  };

  export type QueueOrderAvgAggregateOutputType = {
    id: number | null;
    queue_item_id: number | null;
    position: number | null;
  };

  export type QueueOrderSumAggregateOutputType = {
    id: number | null;
    queue_item_id: number | null;
    position: number | null;
  };

  export type QueueOrderMinAggregateOutputType = {
    id: number | null;
    queue_item_id: number | null;
    position: number | null;
    created_at: Date | null;
    updated_at: Date | null;
  };

  export type QueueOrderMaxAggregateOutputType = {
    id: number | null;
    queue_item_id: number | null;
    position: number | null;
    created_at: Date | null;
    updated_at: Date | null;
  };

  export type QueueOrderCountAggregateOutputType = {
    id: number;
    queue_item_id: number;
    position: number;
    created_at: number;
    updated_at: number;
    _all: number;
  };

  export type QueueOrderAvgAggregateInputType = {
    id?: true;
    queue_item_id?: true;
    position?: true;
  };

  export type QueueOrderSumAggregateInputType = {
    id?: true;
    queue_item_id?: true;
    position?: true;
  };

  export type QueueOrderMinAggregateInputType = {
    id?: true;
    queue_item_id?: true;
    position?: true;
    created_at?: true;
    updated_at?: true;
  };

  export type QueueOrderMaxAggregateInputType = {
    id?: true;
    queue_item_id?: true;
    position?: true;
    created_at?: true;
    updated_at?: true;
  };

  export type QueueOrderCountAggregateInputType = {
    id?: true;
    queue_item_id?: true;
    position?: true;
    created_at?: true;
    updated_at?: true;
    _all?: true;
  };

  export type QueueOrderAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which QueueOrder to aggregate.
     */
    where?: QueueOrderWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of QueueOrders to fetch.
     */
    orderBy?: QueueOrderOrderByWithRelationInput | QueueOrderOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the start position
     */
    cursor?: QueueOrderWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` QueueOrders from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` QueueOrders.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Count returned QueueOrders
     **/
    _count?: true | QueueOrderCountAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to average
     **/
    _avg?: QueueOrderAvgAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to sum
     **/
    _sum?: QueueOrderSumAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the minimum value
     **/
    _min?: QueueOrderMinAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the maximum value
     **/
    _max?: QueueOrderMaxAggregateInputType;
  };

  export type GetQueueOrderAggregateType<T extends QueueOrderAggregateArgs> = {
    [P in keyof T & keyof AggregateQueueOrder]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateQueueOrder[P]>
      : GetScalarType<T[P], AggregateQueueOrder[P]>;
  };

  export type QueueOrderGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: QueueOrderWhereInput;
    orderBy?: QueueOrderOrderByWithAggregationInput | QueueOrderOrderByWithAggregationInput[];
    by: QueueOrderScalarFieldEnum[] | QueueOrderScalarFieldEnum;
    having?: QueueOrderScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: QueueOrderCountAggregateInputType | true;
    _avg?: QueueOrderAvgAggregateInputType;
    _sum?: QueueOrderSumAggregateInputType;
    _min?: QueueOrderMinAggregateInputType;
    _max?: QueueOrderMaxAggregateInputType;
  };

  export type QueueOrderGroupByOutputType = {
    id: number;
    queue_item_id: number;
    position: number | null;
    created_at: Date;
    updated_at: Date;
    _count: QueueOrderCountAggregateOutputType | null;
    _avg: QueueOrderAvgAggregateOutputType | null;
    _sum: QueueOrderSumAggregateOutputType | null;
    _min: QueueOrderMinAggregateOutputType | null;
    _max: QueueOrderMaxAggregateOutputType | null;
  };

  type GetQueueOrderGroupByPayload<T extends QueueOrderGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<QueueOrderGroupByOutputType, T['by']> & {
        [P in keyof T & keyof QueueOrderGroupByOutputType]: P extends '_count'
          ? T[P] extends boolean
            ? number
            : GetScalarType<T[P], QueueOrderGroupByOutputType[P]>
          : GetScalarType<T[P], QueueOrderGroupByOutputType[P]>;
      }
    >
  >;

  export type QueueOrderSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<
    {
      id?: boolean;
      queue_item_id?: boolean;
      position?: boolean;
      created_at?: boolean;
      updated_at?: boolean;
      queueItem?: boolean | ReviewQueueDefaultArgs<ExtArgs>;
    },
    ExtArgs['result']['queueOrder']
  >;

  export type QueueOrderSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<
    {
      id?: boolean;
      queue_item_id?: boolean;
      position?: boolean;
      created_at?: boolean;
      updated_at?: boolean;
      queueItem?: boolean | ReviewQueueDefaultArgs<ExtArgs>;
    },
    ExtArgs['result']['queueOrder']
  >;

  export type QueueOrderSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<
    {
      id?: boolean;
      queue_item_id?: boolean;
      position?: boolean;
      created_at?: boolean;
      updated_at?: boolean;
      queueItem?: boolean | ReviewQueueDefaultArgs<ExtArgs>;
    },
    ExtArgs['result']['queueOrder']
  >;

  export type QueueOrderSelectScalar = {
    id?: boolean;
    queue_item_id?: boolean;
    position?: boolean;
    created_at?: boolean;
    updated_at?: boolean;
  };

  export type QueueOrderOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<
    'id' | 'queue_item_id' | 'position' | 'created_at' | 'updated_at',
    ExtArgs['result']['queueOrder']
  >;
  export type QueueOrderInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    queueItem?: boolean | ReviewQueueDefaultArgs<ExtArgs>;
  };
  export type QueueOrderIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    queueItem?: boolean | ReviewQueueDefaultArgs<ExtArgs>;
  };
  export type QueueOrderIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    queueItem?: boolean | ReviewQueueDefaultArgs<ExtArgs>;
  };

  export type $QueueOrderPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: 'QueueOrder';
    objects: {
      queueItem: Prisma.$ReviewQueuePayload<ExtArgs>;
    };
    scalars: $Extensions.GetPayloadResult<
      {
        id: number;
        queue_item_id: number;
        position: number | null;
        created_at: Date;
        updated_at: Date;
      },
      ExtArgs['result']['queueOrder']
    >;
    composites: {};
  };

  type QueueOrderGetPayload<S extends boolean | null | undefined | QueueOrderDefaultArgs> = $Result.GetResult<Prisma.$QueueOrderPayload, S>;

  type QueueOrderCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = Omit<
    QueueOrderFindManyArgs,
    'select' | 'include' | 'distinct' | 'omit'
  > & {
    select?: QueueOrderCountAggregateInputType | true;
  };

  export interface QueueOrderDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['QueueOrder']; meta: { name: 'QueueOrder' } };
    /**
     * Find zero or one QueueOrder that matches the filter.
     * @param {QueueOrderFindUniqueArgs} args - Arguments to find a QueueOrder
     * @example
     * // Get one QueueOrder
     * const queueOrder = await prisma.queueOrder.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends QueueOrderFindUniqueArgs>(
      args: SelectSubset<T, QueueOrderFindUniqueArgs<ExtArgs>>,
    ): Prisma__QueueOrderClient<
      $Result.GetResult<Prisma.$QueueOrderPayload<ExtArgs>, T, 'findUnique', GlobalOmitOptions> | null,
      null,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find one QueueOrder that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {QueueOrderFindUniqueOrThrowArgs} args - Arguments to find a QueueOrder
     * @example
     * // Get one QueueOrder
     * const queueOrder = await prisma.queueOrder.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends QueueOrderFindUniqueOrThrowArgs>(
      args: SelectSubset<T, QueueOrderFindUniqueOrThrowArgs<ExtArgs>>,
    ): Prisma__QueueOrderClient<
      $Result.GetResult<Prisma.$QueueOrderPayload<ExtArgs>, T, 'findUniqueOrThrow', GlobalOmitOptions>,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find the first QueueOrder that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {QueueOrderFindFirstArgs} args - Arguments to find a QueueOrder
     * @example
     * // Get one QueueOrder
     * const queueOrder = await prisma.queueOrder.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends QueueOrderFindFirstArgs>(
      args?: SelectSubset<T, QueueOrderFindFirstArgs<ExtArgs>>,
    ): Prisma__QueueOrderClient<
      $Result.GetResult<Prisma.$QueueOrderPayload<ExtArgs>, T, 'findFirst', GlobalOmitOptions> | null,
      null,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find the first QueueOrder that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {QueueOrderFindFirstOrThrowArgs} args - Arguments to find a QueueOrder
     * @example
     * // Get one QueueOrder
     * const queueOrder = await prisma.queueOrder.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends QueueOrderFindFirstOrThrowArgs>(
      args?: SelectSubset<T, QueueOrderFindFirstOrThrowArgs<ExtArgs>>,
    ): Prisma__QueueOrderClient<
      $Result.GetResult<Prisma.$QueueOrderPayload<ExtArgs>, T, 'findFirstOrThrow', GlobalOmitOptions>,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find zero or more QueueOrders that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {QueueOrderFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all QueueOrders
     * const queueOrders = await prisma.queueOrder.findMany()
     *
     * // Get first 10 QueueOrders
     * const queueOrders = await prisma.queueOrder.findMany({ take: 10 })
     *
     * // Only select the `id`
     * const queueOrderWithIdOnly = await prisma.queueOrder.findMany({ select: { id: true } })
     *
     */
    findMany<T extends QueueOrderFindManyArgs>(
      args?: SelectSubset<T, QueueOrderFindManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<$Result.GetResult<Prisma.$QueueOrderPayload<ExtArgs>, T, 'findMany', GlobalOmitOptions>>;

    /**
     * Create a QueueOrder.
     * @param {QueueOrderCreateArgs} args - Arguments to create a QueueOrder.
     * @example
     * // Create one QueueOrder
     * const QueueOrder = await prisma.queueOrder.create({
     *   data: {
     *     // ... data to create a QueueOrder
     *   }
     * })
     *
     */
    create<T extends QueueOrderCreateArgs>(
      args: SelectSubset<T, QueueOrderCreateArgs<ExtArgs>>,
    ): Prisma__QueueOrderClient<$Result.GetResult<Prisma.$QueueOrderPayload<ExtArgs>, T, 'create', GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;

    /**
     * Create many QueueOrders.
     * @param {QueueOrderCreateManyArgs} args - Arguments to create many QueueOrders.
     * @example
     * // Create many QueueOrders
     * const queueOrder = await prisma.queueOrder.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     */
    createMany<T extends QueueOrderCreateManyArgs>(args?: SelectSubset<T, QueueOrderCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Create many QueueOrders and returns the data saved in the database.
     * @param {QueueOrderCreateManyAndReturnArgs} args - Arguments to create many QueueOrders.
     * @example
     * // Create many QueueOrders
     * const queueOrder = await prisma.queueOrder.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Create many QueueOrders and only return the `id`
     * const queueOrderWithIdOnly = await prisma.queueOrder.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    createManyAndReturn<T extends QueueOrderCreateManyAndReturnArgs>(
      args?: SelectSubset<T, QueueOrderCreateManyAndReturnArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<$Result.GetResult<Prisma.$QueueOrderPayload<ExtArgs>, T, 'createManyAndReturn', GlobalOmitOptions>>;

    /**
     * Delete a QueueOrder.
     * @param {QueueOrderDeleteArgs} args - Arguments to delete one QueueOrder.
     * @example
     * // Delete one QueueOrder
     * const QueueOrder = await prisma.queueOrder.delete({
     *   where: {
     *     // ... filter to delete one QueueOrder
     *   }
     * })
     *
     */
    delete<T extends QueueOrderDeleteArgs>(
      args: SelectSubset<T, QueueOrderDeleteArgs<ExtArgs>>,
    ): Prisma__QueueOrderClient<$Result.GetResult<Prisma.$QueueOrderPayload<ExtArgs>, T, 'delete', GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;

    /**
     * Update one QueueOrder.
     * @param {QueueOrderUpdateArgs} args - Arguments to update one QueueOrder.
     * @example
     * // Update one QueueOrder
     * const queueOrder = await prisma.queueOrder.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    update<T extends QueueOrderUpdateArgs>(
      args: SelectSubset<T, QueueOrderUpdateArgs<ExtArgs>>,
    ): Prisma__QueueOrderClient<$Result.GetResult<Prisma.$QueueOrderPayload<ExtArgs>, T, 'update', GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;

    /**
     * Delete zero or more QueueOrders.
     * @param {QueueOrderDeleteManyArgs} args - Arguments to filter QueueOrders to delete.
     * @example
     * // Delete a few QueueOrders
     * const { count } = await prisma.queueOrder.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     *
     */
    deleteMany<T extends QueueOrderDeleteManyArgs>(args?: SelectSubset<T, QueueOrderDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Update zero or more QueueOrders.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {QueueOrderUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many QueueOrders
     * const queueOrder = await prisma.queueOrder.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    updateMany<T extends QueueOrderUpdateManyArgs>(args: SelectSubset<T, QueueOrderUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Update zero or more QueueOrders and returns the data updated in the database.
     * @param {QueueOrderUpdateManyAndReturnArgs} args - Arguments to update many QueueOrders.
     * @example
     * // Update many QueueOrders
     * const queueOrder = await prisma.queueOrder.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Update zero or more QueueOrders and only return the `id`
     * const queueOrderWithIdOnly = await prisma.queueOrder.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    updateManyAndReturn<T extends QueueOrderUpdateManyAndReturnArgs>(
      args: SelectSubset<T, QueueOrderUpdateManyAndReturnArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<$Result.GetResult<Prisma.$QueueOrderPayload<ExtArgs>, T, 'updateManyAndReturn', GlobalOmitOptions>>;

    /**
     * Create or update one QueueOrder.
     * @param {QueueOrderUpsertArgs} args - Arguments to update or create a QueueOrder.
     * @example
     * // Update or create a QueueOrder
     * const queueOrder = await prisma.queueOrder.upsert({
     *   create: {
     *     // ... data to create a QueueOrder
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the QueueOrder we want to update
     *   }
     * })
     */
    upsert<T extends QueueOrderUpsertArgs>(
      args: SelectSubset<T, QueueOrderUpsertArgs<ExtArgs>>,
    ): Prisma__QueueOrderClient<$Result.GetResult<Prisma.$QueueOrderPayload<ExtArgs>, T, 'upsert', GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;

    /**
     * Count the number of QueueOrders.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {QueueOrderCountArgs} args - Arguments to filter QueueOrders to count.
     * @example
     * // Count the number of QueueOrders
     * const count = await prisma.queueOrder.count({
     *   where: {
     *     // ... the filter for the QueueOrders we want to count
     *   }
     * })
     **/
    count<T extends QueueOrderCountArgs>(
      args?: Subset<T, QueueOrderCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any> ? (T['select'] extends true ? number : GetScalarType<T['select'], QueueOrderCountAggregateOutputType>) : number
    >;

    /**
     * Allows you to perform aggregations operations on a QueueOrder.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {QueueOrderAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
     **/
    aggregate<T extends QueueOrderAggregateArgs>(args: Subset<T, QueueOrderAggregateArgs>): Prisma.PrismaPromise<GetQueueOrderAggregateType<T>>;

    /**
     * Group by QueueOrder.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {QueueOrderGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     *
     **/
    groupBy<
      T extends QueueOrderGroupByArgs,
      HasSelectOrTake extends Or<Extends<'skip', Keys<T>>, Extends<'take', Keys<T>>>,
      OrderByArg extends True extends HasSelectOrTake ? { orderBy: QueueOrderGroupByArgs['orderBy'] } : { orderBy?: QueueOrderGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
        ? `Error: "by" must not be empty.`
        : HavingValid extends False
          ? {
              [P in HavingFields]: P extends ByFields
                ? never
                : P extends string
                  ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
                  : [Error, 'Field ', P, ` in "having" needs to be provided in "by"`];
            }[HavingFields]
          : 'take' extends Keys<T>
            ? 'orderBy' extends Keys<T>
              ? ByValid extends True
                ? {}
                : {
                    [P in OrderFields]: P extends ByFields ? never : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                  }[OrderFields]
              : 'Error: If you provide "take", you also need to provide "orderBy"'
            : 'skip' extends Keys<T>
              ? 'orderBy' extends Keys<T>
                ? ByValid extends True
                  ? {}
                  : {
                      [P in OrderFields]: P extends ByFields ? never : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                    }[OrderFields]
                : 'Error: If you provide "skip", you also need to provide "orderBy"'
              : ByValid extends True
                ? {}
                : {
                    [P in OrderFields]: P extends ByFields ? never : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                  }[OrderFields],
    >(
      args: SubsetIntersection<T, QueueOrderGroupByArgs, OrderByArg> & InputErrors,
    ): {} extends InputErrors ? GetQueueOrderGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>;
    /**
     * Fields of the QueueOrder model
     */
    readonly fields: QueueOrderFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for QueueOrder.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__QueueOrderClient<
    T,
    Null = never,
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
    GlobalOmitOptions = {},
  > extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: 'PrismaPromise';
    queueItem<T extends ReviewQueueDefaultArgs<ExtArgs> = {}>(
      args?: Subset<T, ReviewQueueDefaultArgs<ExtArgs>>,
    ): Prisma__ReviewQueueClient<
      $Result.GetResult<Prisma.$ReviewQueuePayload<ExtArgs>, T, 'findUniqueOrThrow', GlobalOmitOptions> | Null,
      Null,
      ExtArgs,
      GlobalOmitOptions
    >;
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(
      onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null,
      onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null,
    ): $Utils.JsPromise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>;
  }

  /**
   * Fields of the QueueOrder model
   */
  interface QueueOrderFieldRefs {
    readonly id: FieldRef<'QueueOrder', 'Int'>;
    readonly queue_item_id: FieldRef<'QueueOrder', 'Int'>;
    readonly position: FieldRef<'QueueOrder', 'Int'>;
    readonly created_at: FieldRef<'QueueOrder', 'DateTime'>;
    readonly updated_at: FieldRef<'QueueOrder', 'DateTime'>;
  }

  // Custom InputTypes
  /**
   * QueueOrder findUnique
   */
  export type QueueOrderFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the QueueOrder
     */
    select?: QueueOrderSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the QueueOrder
     */
    omit?: QueueOrderOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: QueueOrderInclude<ExtArgs> | null;
    /**
     * Filter, which QueueOrder to fetch.
     */
    where: QueueOrderWhereUniqueInput;
  };

  /**
   * QueueOrder findUniqueOrThrow
   */
  export type QueueOrderFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the QueueOrder
     */
    select?: QueueOrderSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the QueueOrder
     */
    omit?: QueueOrderOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: QueueOrderInclude<ExtArgs> | null;
    /**
     * Filter, which QueueOrder to fetch.
     */
    where: QueueOrderWhereUniqueInput;
  };

  /**
   * QueueOrder findFirst
   */
  export type QueueOrderFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the QueueOrder
     */
    select?: QueueOrderSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the QueueOrder
     */
    omit?: QueueOrderOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: QueueOrderInclude<ExtArgs> | null;
    /**
     * Filter, which QueueOrder to fetch.
     */
    where?: QueueOrderWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of QueueOrders to fetch.
     */
    orderBy?: QueueOrderOrderByWithRelationInput | QueueOrderOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for QueueOrders.
     */
    cursor?: QueueOrderWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` QueueOrders from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` QueueOrders.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of QueueOrders.
     */
    distinct?: QueueOrderScalarFieldEnum | QueueOrderScalarFieldEnum[];
  };

  /**
   * QueueOrder findFirstOrThrow
   */
  export type QueueOrderFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the QueueOrder
     */
    select?: QueueOrderSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the QueueOrder
     */
    omit?: QueueOrderOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: QueueOrderInclude<ExtArgs> | null;
    /**
     * Filter, which QueueOrder to fetch.
     */
    where?: QueueOrderWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of QueueOrders to fetch.
     */
    orderBy?: QueueOrderOrderByWithRelationInput | QueueOrderOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for QueueOrders.
     */
    cursor?: QueueOrderWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` QueueOrders from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` QueueOrders.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of QueueOrders.
     */
    distinct?: QueueOrderScalarFieldEnum | QueueOrderScalarFieldEnum[];
  };

  /**
   * QueueOrder findMany
   */
  export type QueueOrderFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the QueueOrder
     */
    select?: QueueOrderSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the QueueOrder
     */
    omit?: QueueOrderOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: QueueOrderInclude<ExtArgs> | null;
    /**
     * Filter, which QueueOrders to fetch.
     */
    where?: QueueOrderWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of QueueOrders to fetch.
     */
    orderBy?: QueueOrderOrderByWithRelationInput | QueueOrderOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for listing QueueOrders.
     */
    cursor?: QueueOrderWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` QueueOrders from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` QueueOrders.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of QueueOrders.
     */
    distinct?: QueueOrderScalarFieldEnum | QueueOrderScalarFieldEnum[];
  };

  /**
   * QueueOrder create
   */
  export type QueueOrderCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the QueueOrder
     */
    select?: QueueOrderSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the QueueOrder
     */
    omit?: QueueOrderOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: QueueOrderInclude<ExtArgs> | null;
    /**
     * The data needed to create a QueueOrder.
     */
    data: XOR<QueueOrderCreateInput, QueueOrderUncheckedCreateInput>;
  };

  /**
   * QueueOrder createMany
   */
  export type QueueOrderCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many QueueOrders.
     */
    data: QueueOrderCreateManyInput | QueueOrderCreateManyInput[];
  };

  /**
   * QueueOrder createManyAndReturn
   */
  export type QueueOrderCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the QueueOrder
     */
    select?: QueueOrderSelectCreateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the QueueOrder
     */
    omit?: QueueOrderOmit<ExtArgs> | null;
    /**
     * The data used to create many QueueOrders.
     */
    data: QueueOrderCreateManyInput | QueueOrderCreateManyInput[];
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: QueueOrderIncludeCreateManyAndReturn<ExtArgs> | null;
  };

  /**
   * QueueOrder update
   */
  export type QueueOrderUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the QueueOrder
     */
    select?: QueueOrderSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the QueueOrder
     */
    omit?: QueueOrderOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: QueueOrderInclude<ExtArgs> | null;
    /**
     * The data needed to update a QueueOrder.
     */
    data: XOR<QueueOrderUpdateInput, QueueOrderUncheckedUpdateInput>;
    /**
     * Choose, which QueueOrder to update.
     */
    where: QueueOrderWhereUniqueInput;
  };

  /**
   * QueueOrder updateMany
   */
  export type QueueOrderUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update QueueOrders.
     */
    data: XOR<QueueOrderUpdateManyMutationInput, QueueOrderUncheckedUpdateManyInput>;
    /**
     * Filter which QueueOrders to update
     */
    where?: QueueOrderWhereInput;
    /**
     * Limit how many QueueOrders to update.
     */
    limit?: number;
  };

  /**
   * QueueOrder updateManyAndReturn
   */
  export type QueueOrderUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the QueueOrder
     */
    select?: QueueOrderSelectUpdateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the QueueOrder
     */
    omit?: QueueOrderOmit<ExtArgs> | null;
    /**
     * The data used to update QueueOrders.
     */
    data: XOR<QueueOrderUpdateManyMutationInput, QueueOrderUncheckedUpdateManyInput>;
    /**
     * Filter which QueueOrders to update
     */
    where?: QueueOrderWhereInput;
    /**
     * Limit how many QueueOrders to update.
     */
    limit?: number;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: QueueOrderIncludeUpdateManyAndReturn<ExtArgs> | null;
  };

  /**
   * QueueOrder upsert
   */
  export type QueueOrderUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the QueueOrder
     */
    select?: QueueOrderSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the QueueOrder
     */
    omit?: QueueOrderOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: QueueOrderInclude<ExtArgs> | null;
    /**
     * The filter to search for the QueueOrder to update in case it exists.
     */
    where: QueueOrderWhereUniqueInput;
    /**
     * In case the QueueOrder found by the `where` argument doesn't exist, create a new QueueOrder with this data.
     */
    create: XOR<QueueOrderCreateInput, QueueOrderUncheckedCreateInput>;
    /**
     * In case the QueueOrder was found with the provided `where` argument, update it with this data.
     */
    update: XOR<QueueOrderUpdateInput, QueueOrderUncheckedUpdateInput>;
  };

  /**
   * QueueOrder delete
   */
  export type QueueOrderDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the QueueOrder
     */
    select?: QueueOrderSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the QueueOrder
     */
    omit?: QueueOrderOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: QueueOrderInclude<ExtArgs> | null;
    /**
     * Filter which QueueOrder to delete.
     */
    where: QueueOrderWhereUniqueInput;
  };

  /**
   * QueueOrder deleteMany
   */
  export type QueueOrderDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which QueueOrders to delete
     */
    where?: QueueOrderWhereInput;
    /**
     * Limit how many QueueOrders to delete.
     */
    limit?: number;
  };

  /**
   * QueueOrder without action
   */
  export type QueueOrderDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the QueueOrder
     */
    select?: QueueOrderSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the QueueOrder
     */
    omit?: QueueOrderOmit<ExtArgs> | null;
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: QueueOrderInclude<ExtArgs> | null;
  };

  /**
   * Model SystemState
   */

  export type AggregateSystemState = {
    _count: SystemStateCountAggregateOutputType | null;
    _avg: SystemStateAvgAggregateOutputType | null;
    _sum: SystemStateSumAggregateOutputType | null;
    _min: SystemStateMinAggregateOutputType | null;
    _max: SystemStateMaxAggregateOutputType | null;
  };

  export type SystemStateAvgAggregateOutputType = {
    value_integer: number | null;
    value_float: number | null;
  };

  export type SystemStateSumAggregateOutputType = {
    value_integer: number | null;
    value_float: number | null;
  };

  export type SystemStateMinAggregateOutputType = {
    state_key: string | null;
    value_text: string | null;
    value_integer: number | null;
    value_float: number | null;
    value_datetime: string | null;
    updated_at: string | null;
  };

  export type SystemStateMaxAggregateOutputType = {
    state_key: string | null;
    value_text: string | null;
    value_integer: number | null;
    value_float: number | null;
    value_datetime: string | null;
    updated_at: string | null;
  };

  export type SystemStateCountAggregateOutputType = {
    state_key: number;
    value_text: number;
    value_integer: number;
    value_float: number;
    value_datetime: number;
    updated_at: number;
    _all: number;
  };

  export type SystemStateAvgAggregateInputType = {
    value_integer?: true;
    value_float?: true;
  };

  export type SystemStateSumAggregateInputType = {
    value_integer?: true;
    value_float?: true;
  };

  export type SystemStateMinAggregateInputType = {
    state_key?: true;
    value_text?: true;
    value_integer?: true;
    value_float?: true;
    value_datetime?: true;
    updated_at?: true;
  };

  export type SystemStateMaxAggregateInputType = {
    state_key?: true;
    value_text?: true;
    value_integer?: true;
    value_float?: true;
    value_datetime?: true;
    updated_at?: true;
  };

  export type SystemStateCountAggregateInputType = {
    state_key?: true;
    value_text?: true;
    value_integer?: true;
    value_float?: true;
    value_datetime?: true;
    updated_at?: true;
    _all?: true;
  };

  export type SystemStateAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which SystemState to aggregate.
     */
    where?: SystemStateWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of SystemStates to fetch.
     */
    orderBy?: SystemStateOrderByWithRelationInput | SystemStateOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the start position
     */
    cursor?: SystemStateWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` SystemStates from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` SystemStates.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Count returned SystemStates
     **/
    _count?: true | SystemStateCountAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to average
     **/
    _avg?: SystemStateAvgAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to sum
     **/
    _sum?: SystemStateSumAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the minimum value
     **/
    _min?: SystemStateMinAggregateInputType;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     *
     * Select which fields to find the maximum value
     **/
    _max?: SystemStateMaxAggregateInputType;
  };

  export type GetSystemStateAggregateType<T extends SystemStateAggregateArgs> = {
    [P in keyof T & keyof AggregateSystemState]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateSystemState[P]>
      : GetScalarType<T[P], AggregateSystemState[P]>;
  };

  export type SystemStateGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: SystemStateWhereInput;
    orderBy?: SystemStateOrderByWithAggregationInput | SystemStateOrderByWithAggregationInput[];
    by: SystemStateScalarFieldEnum[] | SystemStateScalarFieldEnum;
    having?: SystemStateScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: SystemStateCountAggregateInputType | true;
    _avg?: SystemStateAvgAggregateInputType;
    _sum?: SystemStateSumAggregateInputType;
    _min?: SystemStateMinAggregateInputType;
    _max?: SystemStateMaxAggregateInputType;
  };

  export type SystemStateGroupByOutputType = {
    state_key: string;
    value_text: string | null;
    value_integer: number | null;
    value_float: number | null;
    value_datetime: string | null;
    updated_at: string;
    _count: SystemStateCountAggregateOutputType | null;
    _avg: SystemStateAvgAggregateOutputType | null;
    _sum: SystemStateSumAggregateOutputType | null;
    _min: SystemStateMinAggregateOutputType | null;
    _max: SystemStateMaxAggregateOutputType | null;
  };

  type GetSystemStateGroupByPayload<T extends SystemStateGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<SystemStateGroupByOutputType, T['by']> & {
        [P in keyof T & keyof SystemStateGroupByOutputType]: P extends '_count'
          ? T[P] extends boolean
            ? number
            : GetScalarType<T[P], SystemStateGroupByOutputType[P]>
          : GetScalarType<T[P], SystemStateGroupByOutputType[P]>;
      }
    >
  >;

  export type SystemStateSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<
    {
      state_key?: boolean;
      value_text?: boolean;
      value_integer?: boolean;
      value_float?: boolean;
      value_datetime?: boolean;
      updated_at?: boolean;
    },
    ExtArgs['result']['systemState']
  >;

  export type SystemStateSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<
    {
      state_key?: boolean;
      value_text?: boolean;
      value_integer?: boolean;
      value_float?: boolean;
      value_datetime?: boolean;
      updated_at?: boolean;
    },
    ExtArgs['result']['systemState']
  >;

  export type SystemStateSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<
    {
      state_key?: boolean;
      value_text?: boolean;
      value_integer?: boolean;
      value_float?: boolean;
      value_datetime?: boolean;
      updated_at?: boolean;
    },
    ExtArgs['result']['systemState']
  >;

  export type SystemStateSelectScalar = {
    state_key?: boolean;
    value_text?: boolean;
    value_integer?: boolean;
    value_float?: boolean;
    value_datetime?: boolean;
    updated_at?: boolean;
  };

  export type SystemStateOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<
    'state_key' | 'value_text' | 'value_integer' | 'value_float' | 'value_datetime' | 'updated_at',
    ExtArgs['result']['systemState']
  >;

  export type $SystemStatePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: 'SystemState';
    objects: {};
    scalars: $Extensions.GetPayloadResult<
      {
        state_key: string;
        value_text: string | null;
        value_integer: number | null;
        value_float: number | null;
        value_datetime: string | null;
        updated_at: string;
      },
      ExtArgs['result']['systemState']
    >;
    composites: {};
  };

  type SystemStateGetPayload<S extends boolean | null | undefined | SystemStateDefaultArgs> = $Result.GetResult<Prisma.$SystemStatePayload, S>;

  type SystemStateCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = Omit<
    SystemStateFindManyArgs,
    'select' | 'include' | 'distinct' | 'omit'
  > & {
    select?: SystemStateCountAggregateInputType | true;
  };

  export interface SystemStateDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['SystemState']; meta: { name: 'SystemState' } };
    /**
     * Find zero or one SystemState that matches the filter.
     * @param {SystemStateFindUniqueArgs} args - Arguments to find a SystemState
     * @example
     * // Get one SystemState
     * const systemState = await prisma.systemState.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends SystemStateFindUniqueArgs>(
      args: SelectSubset<T, SystemStateFindUniqueArgs<ExtArgs>>,
    ): Prisma__SystemStateClient<
      $Result.GetResult<Prisma.$SystemStatePayload<ExtArgs>, T, 'findUnique', GlobalOmitOptions> | null,
      null,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find one SystemState that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {SystemStateFindUniqueOrThrowArgs} args - Arguments to find a SystemState
     * @example
     * // Get one SystemState
     * const systemState = await prisma.systemState.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends SystemStateFindUniqueOrThrowArgs>(
      args: SelectSubset<T, SystemStateFindUniqueOrThrowArgs<ExtArgs>>,
    ): Prisma__SystemStateClient<
      $Result.GetResult<Prisma.$SystemStatePayload<ExtArgs>, T, 'findUniqueOrThrow', GlobalOmitOptions>,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find the first SystemState that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SystemStateFindFirstArgs} args - Arguments to find a SystemState
     * @example
     * // Get one SystemState
     * const systemState = await prisma.systemState.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends SystemStateFindFirstArgs>(
      args?: SelectSubset<T, SystemStateFindFirstArgs<ExtArgs>>,
    ): Prisma__SystemStateClient<
      $Result.GetResult<Prisma.$SystemStatePayload<ExtArgs>, T, 'findFirst', GlobalOmitOptions> | null,
      null,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find the first SystemState that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SystemStateFindFirstOrThrowArgs} args - Arguments to find a SystemState
     * @example
     * // Get one SystemState
     * const systemState = await prisma.systemState.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends SystemStateFindFirstOrThrowArgs>(
      args?: SelectSubset<T, SystemStateFindFirstOrThrowArgs<ExtArgs>>,
    ): Prisma__SystemStateClient<
      $Result.GetResult<Prisma.$SystemStatePayload<ExtArgs>, T, 'findFirstOrThrow', GlobalOmitOptions>,
      never,
      ExtArgs,
      GlobalOmitOptions
    >;

    /**
     * Find zero or more SystemStates that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SystemStateFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all SystemStates
     * const systemStates = await prisma.systemState.findMany()
     *
     * // Get first 10 SystemStates
     * const systemStates = await prisma.systemState.findMany({ take: 10 })
     *
     * // Only select the `state_key`
     * const systemStateWithState_keyOnly = await prisma.systemState.findMany({ select: { state_key: true } })
     *
     */
    findMany<T extends SystemStateFindManyArgs>(
      args?: SelectSubset<T, SystemStateFindManyArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SystemStatePayload<ExtArgs>, T, 'findMany', GlobalOmitOptions>>;

    /**
     * Create a SystemState.
     * @param {SystemStateCreateArgs} args - Arguments to create a SystemState.
     * @example
     * // Create one SystemState
     * const SystemState = await prisma.systemState.create({
     *   data: {
     *     // ... data to create a SystemState
     *   }
     * })
     *
     */
    create<T extends SystemStateCreateArgs>(
      args: SelectSubset<T, SystemStateCreateArgs<ExtArgs>>,
    ): Prisma__SystemStateClient<$Result.GetResult<Prisma.$SystemStatePayload<ExtArgs>, T, 'create', GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;

    /**
     * Create many SystemStates.
     * @param {SystemStateCreateManyArgs} args - Arguments to create many SystemStates.
     * @example
     * // Create many SystemStates
     * const systemState = await prisma.systemState.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     */
    createMany<T extends SystemStateCreateManyArgs>(args?: SelectSubset<T, SystemStateCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Create many SystemStates and returns the data saved in the database.
     * @param {SystemStateCreateManyAndReturnArgs} args - Arguments to create many SystemStates.
     * @example
     * // Create many SystemStates
     * const systemState = await prisma.systemState.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Create many SystemStates and only return the `state_key`
     * const systemStateWithState_keyOnly = await prisma.systemState.createManyAndReturn({
     *   select: { state_key: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    createManyAndReturn<T extends SystemStateCreateManyAndReturnArgs>(
      args?: SelectSubset<T, SystemStateCreateManyAndReturnArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SystemStatePayload<ExtArgs>, T, 'createManyAndReturn', GlobalOmitOptions>>;

    /**
     * Delete a SystemState.
     * @param {SystemStateDeleteArgs} args - Arguments to delete one SystemState.
     * @example
     * // Delete one SystemState
     * const SystemState = await prisma.systemState.delete({
     *   where: {
     *     // ... filter to delete one SystemState
     *   }
     * })
     *
     */
    delete<T extends SystemStateDeleteArgs>(
      args: SelectSubset<T, SystemStateDeleteArgs<ExtArgs>>,
    ): Prisma__SystemStateClient<$Result.GetResult<Prisma.$SystemStatePayload<ExtArgs>, T, 'delete', GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;

    /**
     * Update one SystemState.
     * @param {SystemStateUpdateArgs} args - Arguments to update one SystemState.
     * @example
     * // Update one SystemState
     * const systemState = await prisma.systemState.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    update<T extends SystemStateUpdateArgs>(
      args: SelectSubset<T, SystemStateUpdateArgs<ExtArgs>>,
    ): Prisma__SystemStateClient<$Result.GetResult<Prisma.$SystemStatePayload<ExtArgs>, T, 'update', GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;

    /**
     * Delete zero or more SystemStates.
     * @param {SystemStateDeleteManyArgs} args - Arguments to filter SystemStates to delete.
     * @example
     * // Delete a few SystemStates
     * const { count } = await prisma.systemState.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     *
     */
    deleteMany<T extends SystemStateDeleteManyArgs>(args?: SelectSubset<T, SystemStateDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Update zero or more SystemStates.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SystemStateUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many SystemStates
     * const systemState = await prisma.systemState.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     *
     */
    updateMany<T extends SystemStateUpdateManyArgs>(args: SelectSubset<T, SystemStateUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>;

    /**
     * Update zero or more SystemStates and returns the data updated in the database.
     * @param {SystemStateUpdateManyAndReturnArgs} args - Arguments to update many SystemStates.
     * @example
     * // Update many SystemStates
     * const systemState = await prisma.systemState.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *
     * // Update zero or more SystemStates and only return the `state_key`
     * const systemStateWithState_keyOnly = await prisma.systemState.updateManyAndReturn({
     *   select: { state_key: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     *
     */
    updateManyAndReturn<T extends SystemStateUpdateManyAndReturnArgs>(
      args: SelectSubset<T, SystemStateUpdateManyAndReturnArgs<ExtArgs>>,
    ): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SystemStatePayload<ExtArgs>, T, 'updateManyAndReturn', GlobalOmitOptions>>;

    /**
     * Create or update one SystemState.
     * @param {SystemStateUpsertArgs} args - Arguments to update or create a SystemState.
     * @example
     * // Update or create a SystemState
     * const systemState = await prisma.systemState.upsert({
     *   create: {
     *     // ... data to create a SystemState
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the SystemState we want to update
     *   }
     * })
     */
    upsert<T extends SystemStateUpsertArgs>(
      args: SelectSubset<T, SystemStateUpsertArgs<ExtArgs>>,
    ): Prisma__SystemStateClient<$Result.GetResult<Prisma.$SystemStatePayload<ExtArgs>, T, 'upsert', GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;

    /**
     * Count the number of SystemStates.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SystemStateCountArgs} args - Arguments to filter SystemStates to count.
     * @example
     * // Count the number of SystemStates
     * const count = await prisma.systemState.count({
     *   where: {
     *     // ... the filter for the SystemStates we want to count
     *   }
     * })
     **/
    count<T extends SystemStateCountArgs>(
      args?: Subset<T, SystemStateCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any> ? (T['select'] extends true ? number : GetScalarType<T['select'], SystemStateCountAggregateOutputType>) : number
    >;

    /**
     * Allows you to perform aggregations operations on a SystemState.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SystemStateAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
     **/
    aggregate<T extends SystemStateAggregateArgs>(args: Subset<T, SystemStateAggregateArgs>): Prisma.PrismaPromise<GetSystemStateAggregateType<T>>;

    /**
     * Group by SystemState.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SystemStateGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     *
     **/
    groupBy<
      T extends SystemStateGroupByArgs,
      HasSelectOrTake extends Or<Extends<'skip', Keys<T>>, Extends<'take', Keys<T>>>,
      OrderByArg extends True extends HasSelectOrTake ? { orderBy: SystemStateGroupByArgs['orderBy'] } : { orderBy?: SystemStateGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
        ? `Error: "by" must not be empty.`
        : HavingValid extends False
          ? {
              [P in HavingFields]: P extends ByFields
                ? never
                : P extends string
                  ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
                  : [Error, 'Field ', P, ` in "having" needs to be provided in "by"`];
            }[HavingFields]
          : 'take' extends Keys<T>
            ? 'orderBy' extends Keys<T>
              ? ByValid extends True
                ? {}
                : {
                    [P in OrderFields]: P extends ByFields ? never : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                  }[OrderFields]
              : 'Error: If you provide "take", you also need to provide "orderBy"'
            : 'skip' extends Keys<T>
              ? 'orderBy' extends Keys<T>
                ? ByValid extends True
                  ? {}
                  : {
                      [P in OrderFields]: P extends ByFields ? never : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                    }[OrderFields]
                : 'Error: If you provide "skip", you also need to provide "orderBy"'
              : ByValid extends True
                ? {}
                : {
                    [P in OrderFields]: P extends ByFields ? never : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
                  }[OrderFields],
    >(
      args: SubsetIntersection<T, SystemStateGroupByArgs, OrderByArg> & InputErrors,
    ): {} extends InputErrors ? GetSystemStateGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>;
    /**
     * Fields of the SystemState model
     */
    readonly fields: SystemStateFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for SystemState.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__SystemStateClient<
    T,
    Null = never,
    ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
    GlobalOmitOptions = {},
  > extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: 'PrismaPromise';
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(
      onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null,
      onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null,
    ): $Utils.JsPromise<TResult1 | TResult2>;
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>;
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>;
  }

  /**
   * Fields of the SystemState model
   */
  interface SystemStateFieldRefs {
    readonly state_key: FieldRef<'SystemState', 'String'>;
    readonly value_text: FieldRef<'SystemState', 'String'>;
    readonly value_integer: FieldRef<'SystemState', 'Int'>;
    readonly value_float: FieldRef<'SystemState', 'Float'>;
    readonly value_datetime: FieldRef<'SystemState', 'String'>;
    readonly updated_at: FieldRef<'SystemState', 'String'>;
  }

  // Custom InputTypes
  /**
   * SystemState findUnique
   */
  export type SystemStateFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SystemState
     */
    select?: SystemStateSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the SystemState
     */
    omit?: SystemStateOmit<ExtArgs> | null;
    /**
     * Filter, which SystemState to fetch.
     */
    where: SystemStateWhereUniqueInput;
  };

  /**
   * SystemState findUniqueOrThrow
   */
  export type SystemStateFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SystemState
     */
    select?: SystemStateSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the SystemState
     */
    omit?: SystemStateOmit<ExtArgs> | null;
    /**
     * Filter, which SystemState to fetch.
     */
    where: SystemStateWhereUniqueInput;
  };

  /**
   * SystemState findFirst
   */
  export type SystemStateFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SystemState
     */
    select?: SystemStateSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the SystemState
     */
    omit?: SystemStateOmit<ExtArgs> | null;
    /**
     * Filter, which SystemState to fetch.
     */
    where?: SystemStateWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of SystemStates to fetch.
     */
    orderBy?: SystemStateOrderByWithRelationInput | SystemStateOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for SystemStates.
     */
    cursor?: SystemStateWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` SystemStates from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` SystemStates.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of SystemStates.
     */
    distinct?: SystemStateScalarFieldEnum | SystemStateScalarFieldEnum[];
  };

  /**
   * SystemState findFirstOrThrow
   */
  export type SystemStateFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SystemState
     */
    select?: SystemStateSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the SystemState
     */
    omit?: SystemStateOmit<ExtArgs> | null;
    /**
     * Filter, which SystemState to fetch.
     */
    where?: SystemStateWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of SystemStates to fetch.
     */
    orderBy?: SystemStateOrderByWithRelationInput | SystemStateOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for searching for SystemStates.
     */
    cursor?: SystemStateWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` SystemStates from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` SystemStates.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of SystemStates.
     */
    distinct?: SystemStateScalarFieldEnum | SystemStateScalarFieldEnum[];
  };

  /**
   * SystemState findMany
   */
  export type SystemStateFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SystemState
     */
    select?: SystemStateSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the SystemState
     */
    omit?: SystemStateOmit<ExtArgs> | null;
    /**
     * Filter, which SystemStates to fetch.
     */
    where?: SystemStateWhereInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     *
     * Determine the order of SystemStates to fetch.
     */
    orderBy?: SystemStateOrderByWithRelationInput | SystemStateOrderByWithRelationInput[];
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     *
     * Sets the position for listing SystemStates.
     */
    cursor?: SystemStateWhereUniqueInput;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Take `±n` SystemStates from the position of the cursor.
     */
    take?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     *
     * Skip the first `n` SystemStates.
     */
    skip?: number;
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     *
     * Filter by unique combinations of SystemStates.
     */
    distinct?: SystemStateScalarFieldEnum | SystemStateScalarFieldEnum[];
  };

  /**
   * SystemState create
   */
  export type SystemStateCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SystemState
     */
    select?: SystemStateSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the SystemState
     */
    omit?: SystemStateOmit<ExtArgs> | null;
    /**
     * The data needed to create a SystemState.
     */
    data: XOR<SystemStateCreateInput, SystemStateUncheckedCreateInput>;
  };

  /**
   * SystemState createMany
   */
  export type SystemStateCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many SystemStates.
     */
    data: SystemStateCreateManyInput | SystemStateCreateManyInput[];
  };

  /**
   * SystemState createManyAndReturn
   */
  export type SystemStateCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SystemState
     */
    select?: SystemStateSelectCreateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the SystemState
     */
    omit?: SystemStateOmit<ExtArgs> | null;
    /**
     * The data used to create many SystemStates.
     */
    data: SystemStateCreateManyInput | SystemStateCreateManyInput[];
  };

  /**
   * SystemState update
   */
  export type SystemStateUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SystemState
     */
    select?: SystemStateSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the SystemState
     */
    omit?: SystemStateOmit<ExtArgs> | null;
    /**
     * The data needed to update a SystemState.
     */
    data: XOR<SystemStateUpdateInput, SystemStateUncheckedUpdateInput>;
    /**
     * Choose, which SystemState to update.
     */
    where: SystemStateWhereUniqueInput;
  };

  /**
   * SystemState updateMany
   */
  export type SystemStateUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update SystemStates.
     */
    data: XOR<SystemStateUpdateManyMutationInput, SystemStateUncheckedUpdateManyInput>;
    /**
     * Filter which SystemStates to update
     */
    where?: SystemStateWhereInput;
    /**
     * Limit how many SystemStates to update.
     */
    limit?: number;
  };

  /**
   * SystemState updateManyAndReturn
   */
  export type SystemStateUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SystemState
     */
    select?: SystemStateSelectUpdateManyAndReturn<ExtArgs> | null;
    /**
     * Omit specific fields from the SystemState
     */
    omit?: SystemStateOmit<ExtArgs> | null;
    /**
     * The data used to update SystemStates.
     */
    data: XOR<SystemStateUpdateManyMutationInput, SystemStateUncheckedUpdateManyInput>;
    /**
     * Filter which SystemStates to update
     */
    where?: SystemStateWhereInput;
    /**
     * Limit how many SystemStates to update.
     */
    limit?: number;
  };

  /**
   * SystemState upsert
   */
  export type SystemStateUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SystemState
     */
    select?: SystemStateSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the SystemState
     */
    omit?: SystemStateOmit<ExtArgs> | null;
    /**
     * The filter to search for the SystemState to update in case it exists.
     */
    where: SystemStateWhereUniqueInput;
    /**
     * In case the SystemState found by the `where` argument doesn't exist, create a new SystemState with this data.
     */
    create: XOR<SystemStateCreateInput, SystemStateUncheckedCreateInput>;
    /**
     * In case the SystemState was found with the provided `where` argument, update it with this data.
     */
    update: XOR<SystemStateUpdateInput, SystemStateUncheckedUpdateInput>;
  };

  /**
   * SystemState delete
   */
  export type SystemStateDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SystemState
     */
    select?: SystemStateSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the SystemState
     */
    omit?: SystemStateOmit<ExtArgs> | null;
    /**
     * Filter which SystemState to delete.
     */
    where: SystemStateWhereUniqueInput;
  };

  /**
   * SystemState deleteMany
   */
  export type SystemStateDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which SystemStates to delete
     */
    where?: SystemStateWhereInput;
    /**
     * Limit how many SystemStates to delete.
     */
    limit?: number;
  };

  /**
   * SystemState without action
   */
  export type SystemStateDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SystemState
     */
    select?: SystemStateSelect<ExtArgs> | null;
    /**
     * Omit specific fields from the SystemState
     */
    omit?: SystemStateOmit<ExtArgs> | null;
  };

  /**
   * Enums
   */

  export const TransactionIsolationLevel: {
    Serializable: 'Serializable';
  };

  export type TransactionIsolationLevel = (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel];

  export const PullRequestScalarFieldEnum: {
    id: 'id';
    uuid: 'uuid';
    repo_full_name: 'repo_full_name';
    pr_number: 'pr_number';
    title: 'title';
    author_login: 'author_login';
    first_seen_at: 'first_seen_at';
    first_review_limit_at: 'first_review_limit_at';
    last_review_limit_at: 'last_review_limit_at';
    last_review_requested_at: 'last_review_requested_at';
    last_coderabbit_review_at: 'last_coderabbit_review_at';
    last_coderabbit_acknowledged_at: 'last_coderabbit_acknowledged_at';
    retrigger_count: 'retrigger_count';
    review_count: 'review_count';
    created_at: 'created_at';
    updated_at: 'updated_at';
  };

  export type PullRequestScalarFieldEnum = (typeof PullRequestScalarFieldEnum)[keyof typeof PullRequestScalarFieldEnum];

  export const ReviewQueueScalarFieldEnum: {
    id: 'id';
    uuid: 'uuid';
    pull_request_id: 'pull_request_id';
    repo_full_name: 'repo_full_name';
    pr_number: 'pr_number';
    pr_title: 'pr_title';
    status: 'status';
    not_before: 'not_before';
    attempts: 'attempts';
    source_comment_url: 'source_comment_url';
    source_comment_id: 'source_comment_id';
    trigger_source: 'trigger_source';
    retrigger_comment_url: 'retrigger_comment_url';
    retriggered_at: 'retriggered_at';
    failed_at: 'failed_at';
    reviewed_at: 'reviewed_at';
    created_at: 'created_at';
    updated_at: 'updated_at';
  };

  export type ReviewQueueScalarFieldEnum = (typeof ReviewQueueScalarFieldEnum)[keyof typeof ReviewQueueScalarFieldEnum];

  export const EventScalarFieldEnum: {
    id: 'id';
    uuid: 'uuid';
    ts: 'ts';
    type: 'type';
    pull_request_id: 'pull_request_id';
    repo_full_name: 'repo_full_name';
    pr_number: 'pr_number';
    correlation_id: 'correlation_id';
    request_id: 'request_id';
    version: 'version';
    payload: 'payload';
    metadata: 'metadata';
  };

  export type EventScalarFieldEnum = (typeof EventScalarFieldEnum)[keyof typeof EventScalarFieldEnum];

  export const QueueOrderScalarFieldEnum: {
    id: 'id';
    queue_item_id: 'queue_item_id';
    position: 'position';
    created_at: 'created_at';
    updated_at: 'updated_at';
  };

  export type QueueOrderScalarFieldEnum = (typeof QueueOrderScalarFieldEnum)[keyof typeof QueueOrderScalarFieldEnum];

  export const SystemStateScalarFieldEnum: {
    state_key: 'state_key';
    value_text: 'value_text';
    value_integer: 'value_integer';
    value_float: 'value_float';
    value_datetime: 'value_datetime';
    updated_at: 'updated_at';
  };

  export type SystemStateScalarFieldEnum = (typeof SystemStateScalarFieldEnum)[keyof typeof SystemStateScalarFieldEnum];

  export const SortOrder: {
    asc: 'asc';
    desc: 'desc';
  };

  export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder];

  export const NullsOrder: {
    first: 'first';
    last: 'last';
  };

  export type NullsOrder = (typeof NullsOrder)[keyof typeof NullsOrder];

  /**
   * Field references
   */

  /**
   * Reference to a field of type 'Int'
   */
  export type IntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int'>;

  /**
   * Reference to a field of type 'String'
   */
  export type StringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String'>;

  /**
   * Reference to a field of type 'DateTime'
   */
  export type DateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime'>;

  /**
   * Reference to a field of type 'Float'
   */
  export type FloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float'>;

  /**
   * Deep Input Types
   */

  export type PullRequestWhereInput = {
    AND?: PullRequestWhereInput | PullRequestWhereInput[];
    OR?: PullRequestWhereInput[];
    NOT?: PullRequestWhereInput | PullRequestWhereInput[];
    id?: IntFilter<'PullRequest'> | number;
    uuid?: StringFilter<'PullRequest'> | string;
    repo_full_name?: StringFilter<'PullRequest'> | string;
    pr_number?: IntFilter<'PullRequest'> | number;
    title?: StringFilter<'PullRequest'> | string;
    author_login?: StringFilter<'PullRequest'> | string;
    first_seen_at?: DateTimeFilter<'PullRequest'> | Date | string;
    first_review_limit_at?: DateTimeNullableFilter<'PullRequest'> | Date | string | null;
    last_review_limit_at?: DateTimeNullableFilter<'PullRequest'> | Date | string | null;
    last_review_requested_at?: DateTimeNullableFilter<'PullRequest'> | Date | string | null;
    last_coderabbit_review_at?: DateTimeNullableFilter<'PullRequest'> | Date | string | null;
    last_coderabbit_acknowledged_at?: DateTimeNullableFilter<'PullRequest'> | Date | string | null;
    retrigger_count?: IntFilter<'PullRequest'> | number;
    review_count?: IntFilter<'PullRequest'> | number;
    created_at?: DateTimeFilter<'PullRequest'> | Date | string;
    updated_at?: DateTimeFilter<'PullRequest'> | Date | string;
    queueItems?: ReviewQueueListRelationFilter;
    events?: EventListRelationFilter;
  };

  export type PullRequestOrderByWithRelationInput = {
    id?: SortOrder;
    uuid?: SortOrder;
    repo_full_name?: SortOrder;
    pr_number?: SortOrder;
    title?: SortOrder;
    author_login?: SortOrder;
    first_seen_at?: SortOrder;
    first_review_limit_at?: SortOrderInput | SortOrder;
    last_review_limit_at?: SortOrderInput | SortOrder;
    last_review_requested_at?: SortOrderInput | SortOrder;
    last_coderabbit_review_at?: SortOrderInput | SortOrder;
    last_coderabbit_acknowledged_at?: SortOrderInput | SortOrder;
    retrigger_count?: SortOrder;
    review_count?: SortOrder;
    created_at?: SortOrder;
    updated_at?: SortOrder;
    queueItems?: ReviewQueueOrderByRelationAggregateInput;
    events?: EventOrderByRelationAggregateInput;
  };

  export type PullRequestWhereUniqueInput = Prisma.AtLeast<
    {
      id?: number;
      uuid?: string;
      repo_full_name_pr_number?: PullRequestRepo_full_namePr_numberCompoundUniqueInput;
      AND?: PullRequestWhereInput | PullRequestWhereInput[];
      OR?: PullRequestWhereInput[];
      NOT?: PullRequestWhereInput | PullRequestWhereInput[];
      repo_full_name?: StringFilter<'PullRequest'> | string;
      pr_number?: IntFilter<'PullRequest'> | number;
      title?: StringFilter<'PullRequest'> | string;
      author_login?: StringFilter<'PullRequest'> | string;
      first_seen_at?: DateTimeFilter<'PullRequest'> | Date | string;
      first_review_limit_at?: DateTimeNullableFilter<'PullRequest'> | Date | string | null;
      last_review_limit_at?: DateTimeNullableFilter<'PullRequest'> | Date | string | null;
      last_review_requested_at?: DateTimeNullableFilter<'PullRequest'> | Date | string | null;
      last_coderabbit_review_at?: DateTimeNullableFilter<'PullRequest'> | Date | string | null;
      last_coderabbit_acknowledged_at?: DateTimeNullableFilter<'PullRequest'> | Date | string | null;
      retrigger_count?: IntFilter<'PullRequest'> | number;
      review_count?: IntFilter<'PullRequest'> | number;
      created_at?: DateTimeFilter<'PullRequest'> | Date | string;
      updated_at?: DateTimeFilter<'PullRequest'> | Date | string;
      queueItems?: ReviewQueueListRelationFilter;
      events?: EventListRelationFilter;
    },
    'id' | 'uuid' | 'repo_full_name_pr_number'
  >;

  export type PullRequestOrderByWithAggregationInput = {
    id?: SortOrder;
    uuid?: SortOrder;
    repo_full_name?: SortOrder;
    pr_number?: SortOrder;
    title?: SortOrder;
    author_login?: SortOrder;
    first_seen_at?: SortOrder;
    first_review_limit_at?: SortOrderInput | SortOrder;
    last_review_limit_at?: SortOrderInput | SortOrder;
    last_review_requested_at?: SortOrderInput | SortOrder;
    last_coderabbit_review_at?: SortOrderInput | SortOrder;
    last_coderabbit_acknowledged_at?: SortOrderInput | SortOrder;
    retrigger_count?: SortOrder;
    review_count?: SortOrder;
    created_at?: SortOrder;
    updated_at?: SortOrder;
    _count?: PullRequestCountOrderByAggregateInput;
    _avg?: PullRequestAvgOrderByAggregateInput;
    _max?: PullRequestMaxOrderByAggregateInput;
    _min?: PullRequestMinOrderByAggregateInput;
    _sum?: PullRequestSumOrderByAggregateInput;
  };

  export type PullRequestScalarWhereWithAggregatesInput = {
    AND?: PullRequestScalarWhereWithAggregatesInput | PullRequestScalarWhereWithAggregatesInput[];
    OR?: PullRequestScalarWhereWithAggregatesInput[];
    NOT?: PullRequestScalarWhereWithAggregatesInput | PullRequestScalarWhereWithAggregatesInput[];
    id?: IntWithAggregatesFilter<'PullRequest'> | number;
    uuid?: StringWithAggregatesFilter<'PullRequest'> | string;
    repo_full_name?: StringWithAggregatesFilter<'PullRequest'> | string;
    pr_number?: IntWithAggregatesFilter<'PullRequest'> | number;
    title?: StringWithAggregatesFilter<'PullRequest'> | string;
    author_login?: StringWithAggregatesFilter<'PullRequest'> | string;
    first_seen_at?: DateTimeWithAggregatesFilter<'PullRequest'> | Date | string;
    first_review_limit_at?: DateTimeNullableWithAggregatesFilter<'PullRequest'> | Date | string | null;
    last_review_limit_at?: DateTimeNullableWithAggregatesFilter<'PullRequest'> | Date | string | null;
    last_review_requested_at?: DateTimeNullableWithAggregatesFilter<'PullRequest'> | Date | string | null;
    last_coderabbit_review_at?: DateTimeNullableWithAggregatesFilter<'PullRequest'> | Date | string | null;
    last_coderabbit_acknowledged_at?: DateTimeNullableWithAggregatesFilter<'PullRequest'> | Date | string | null;
    retrigger_count?: IntWithAggregatesFilter<'PullRequest'> | number;
    review_count?: IntWithAggregatesFilter<'PullRequest'> | number;
    created_at?: DateTimeWithAggregatesFilter<'PullRequest'> | Date | string;
    updated_at?: DateTimeWithAggregatesFilter<'PullRequest'> | Date | string;
  };

  export type ReviewQueueWhereInput = {
    AND?: ReviewQueueWhereInput | ReviewQueueWhereInput[];
    OR?: ReviewQueueWhereInput[];
    NOT?: ReviewQueueWhereInput | ReviewQueueWhereInput[];
    id?: IntFilter<'ReviewQueue'> | number;
    uuid?: StringFilter<'ReviewQueue'> | string;
    pull_request_id?: IntNullableFilter<'ReviewQueue'> | number | null;
    repo_full_name?: StringFilter<'ReviewQueue'> | string;
    pr_number?: IntFilter<'ReviewQueue'> | number;
    pr_title?: StringFilter<'ReviewQueue'> | string;
    status?: StringFilter<'ReviewQueue'> | string;
    not_before?: DateTimeFilter<'ReviewQueue'> | Date | string;
    attempts?: IntFilter<'ReviewQueue'> | number;
    source_comment_url?: StringFilter<'ReviewQueue'> | string;
    source_comment_id?: IntFilter<'ReviewQueue'> | number;
    trigger_source?: StringFilter<'ReviewQueue'> | string;
    retrigger_comment_url?: StringNullableFilter<'ReviewQueue'> | string | null;
    retriggered_at?: DateTimeNullableFilter<'ReviewQueue'> | Date | string | null;
    failed_at?: DateTimeNullableFilter<'ReviewQueue'> | Date | string | null;
    reviewed_at?: DateTimeNullableFilter<'ReviewQueue'> | Date | string | null;
    created_at?: DateTimeFilter<'ReviewQueue'> | Date | string;
    updated_at?: DateTimeFilter<'ReviewQueue'> | Date | string;
    queueOrder?: XOR<QueueOrderNullableScalarRelationFilter, QueueOrderWhereInput> | null;
    pullRequest?: XOR<PullRequestNullableScalarRelationFilter, PullRequestWhereInput> | null;
  };

  export type ReviewQueueOrderByWithRelationInput = {
    id?: SortOrder;
    uuid?: SortOrder;
    pull_request_id?: SortOrderInput | SortOrder;
    repo_full_name?: SortOrder;
    pr_number?: SortOrder;
    pr_title?: SortOrder;
    status?: SortOrder;
    not_before?: SortOrder;
    attempts?: SortOrder;
    source_comment_url?: SortOrder;
    source_comment_id?: SortOrder;
    trigger_source?: SortOrder;
    retrigger_comment_url?: SortOrderInput | SortOrder;
    retriggered_at?: SortOrderInput | SortOrder;
    failed_at?: SortOrderInput | SortOrder;
    reviewed_at?: SortOrderInput | SortOrder;
    created_at?: SortOrder;
    updated_at?: SortOrder;
    queueOrder?: QueueOrderOrderByWithRelationInput;
    pullRequest?: PullRequestOrderByWithRelationInput;
  };

  export type ReviewQueueWhereUniqueInput = Prisma.AtLeast<
    {
      id?: number;
      uuid?: string;
      AND?: ReviewQueueWhereInput | ReviewQueueWhereInput[];
      OR?: ReviewQueueWhereInput[];
      NOT?: ReviewQueueWhereInput | ReviewQueueWhereInput[];
      pull_request_id?: IntNullableFilter<'ReviewQueue'> | number | null;
      repo_full_name?: StringFilter<'ReviewQueue'> | string;
      pr_number?: IntFilter<'ReviewQueue'> | number;
      pr_title?: StringFilter<'ReviewQueue'> | string;
      status?: StringFilter<'ReviewQueue'> | string;
      not_before?: DateTimeFilter<'ReviewQueue'> | Date | string;
      attempts?: IntFilter<'ReviewQueue'> | number;
      source_comment_url?: StringFilter<'ReviewQueue'> | string;
      source_comment_id?: IntFilter<'ReviewQueue'> | number;
      trigger_source?: StringFilter<'ReviewQueue'> | string;
      retrigger_comment_url?: StringNullableFilter<'ReviewQueue'> | string | null;
      retriggered_at?: DateTimeNullableFilter<'ReviewQueue'> | Date | string | null;
      failed_at?: DateTimeNullableFilter<'ReviewQueue'> | Date | string | null;
      reviewed_at?: DateTimeNullableFilter<'ReviewQueue'> | Date | string | null;
      created_at?: DateTimeFilter<'ReviewQueue'> | Date | string;
      updated_at?: DateTimeFilter<'ReviewQueue'> | Date | string;
      queueOrder?: XOR<QueueOrderNullableScalarRelationFilter, QueueOrderWhereInput> | null;
      pullRequest?: XOR<PullRequestNullableScalarRelationFilter, PullRequestWhereInput> | null;
    },
    'id' | 'uuid'
  >;

  export type ReviewQueueOrderByWithAggregationInput = {
    id?: SortOrder;
    uuid?: SortOrder;
    pull_request_id?: SortOrderInput | SortOrder;
    repo_full_name?: SortOrder;
    pr_number?: SortOrder;
    pr_title?: SortOrder;
    status?: SortOrder;
    not_before?: SortOrder;
    attempts?: SortOrder;
    source_comment_url?: SortOrder;
    source_comment_id?: SortOrder;
    trigger_source?: SortOrder;
    retrigger_comment_url?: SortOrderInput | SortOrder;
    retriggered_at?: SortOrderInput | SortOrder;
    failed_at?: SortOrderInput | SortOrder;
    reviewed_at?: SortOrderInput | SortOrder;
    created_at?: SortOrder;
    updated_at?: SortOrder;
    _count?: ReviewQueueCountOrderByAggregateInput;
    _avg?: ReviewQueueAvgOrderByAggregateInput;
    _max?: ReviewQueueMaxOrderByAggregateInput;
    _min?: ReviewQueueMinOrderByAggregateInput;
    _sum?: ReviewQueueSumOrderByAggregateInput;
  };

  export type ReviewQueueScalarWhereWithAggregatesInput = {
    AND?: ReviewQueueScalarWhereWithAggregatesInput | ReviewQueueScalarWhereWithAggregatesInput[];
    OR?: ReviewQueueScalarWhereWithAggregatesInput[];
    NOT?: ReviewQueueScalarWhereWithAggregatesInput | ReviewQueueScalarWhereWithAggregatesInput[];
    id?: IntWithAggregatesFilter<'ReviewQueue'> | number;
    uuid?: StringWithAggregatesFilter<'ReviewQueue'> | string;
    pull_request_id?: IntNullableWithAggregatesFilter<'ReviewQueue'> | number | null;
    repo_full_name?: StringWithAggregatesFilter<'ReviewQueue'> | string;
    pr_number?: IntWithAggregatesFilter<'ReviewQueue'> | number;
    pr_title?: StringWithAggregatesFilter<'ReviewQueue'> | string;
    status?: StringWithAggregatesFilter<'ReviewQueue'> | string;
    not_before?: DateTimeWithAggregatesFilter<'ReviewQueue'> | Date | string;
    attempts?: IntWithAggregatesFilter<'ReviewQueue'> | number;
    source_comment_url?: StringWithAggregatesFilter<'ReviewQueue'> | string;
    source_comment_id?: IntWithAggregatesFilter<'ReviewQueue'> | number;
    trigger_source?: StringWithAggregatesFilter<'ReviewQueue'> | string;
    retrigger_comment_url?: StringNullableWithAggregatesFilter<'ReviewQueue'> | string | null;
    retriggered_at?: DateTimeNullableWithAggregatesFilter<'ReviewQueue'> | Date | string | null;
    failed_at?: DateTimeNullableWithAggregatesFilter<'ReviewQueue'> | Date | string | null;
    reviewed_at?: DateTimeNullableWithAggregatesFilter<'ReviewQueue'> | Date | string | null;
    created_at?: DateTimeWithAggregatesFilter<'ReviewQueue'> | Date | string;
    updated_at?: DateTimeWithAggregatesFilter<'ReviewQueue'> | Date | string;
  };

  export type EventWhereInput = {
    AND?: EventWhereInput | EventWhereInput[];
    OR?: EventWhereInput[];
    NOT?: EventWhereInput | EventWhereInput[];
    id?: IntFilter<'Event'> | number;
    uuid?: StringFilter<'Event'> | string;
    ts?: DateTimeFilter<'Event'> | Date | string;
    type?: StringFilter<'Event'> | string;
    pull_request_id?: IntNullableFilter<'Event'> | number | null;
    repo_full_name?: StringFilter<'Event'> | string;
    pr_number?: IntFilter<'Event'> | number;
    correlation_id?: StringFilter<'Event'> | string;
    request_id?: StringNullableFilter<'Event'> | string | null;
    version?: StringFilter<'Event'> | string;
    payload?: StringFilter<'Event'> | string;
    metadata?: StringNullableFilter<'Event'> | string | null;
    pullRequest?: XOR<PullRequestNullableScalarRelationFilter, PullRequestWhereInput> | null;
  };

  export type EventOrderByWithRelationInput = {
    id?: SortOrder;
    uuid?: SortOrder;
    ts?: SortOrder;
    type?: SortOrder;
    pull_request_id?: SortOrderInput | SortOrder;
    repo_full_name?: SortOrder;
    pr_number?: SortOrder;
    correlation_id?: SortOrder;
    request_id?: SortOrderInput | SortOrder;
    version?: SortOrder;
    payload?: SortOrder;
    metadata?: SortOrderInput | SortOrder;
    pullRequest?: PullRequestOrderByWithRelationInput;
  };

  export type EventWhereUniqueInput = Prisma.AtLeast<
    {
      id?: number;
      uuid?: string;
      AND?: EventWhereInput | EventWhereInput[];
      OR?: EventWhereInput[];
      NOT?: EventWhereInput | EventWhereInput[];
      ts?: DateTimeFilter<'Event'> | Date | string;
      type?: StringFilter<'Event'> | string;
      pull_request_id?: IntNullableFilter<'Event'> | number | null;
      repo_full_name?: StringFilter<'Event'> | string;
      pr_number?: IntFilter<'Event'> | number;
      correlation_id?: StringFilter<'Event'> | string;
      request_id?: StringNullableFilter<'Event'> | string | null;
      version?: StringFilter<'Event'> | string;
      payload?: StringFilter<'Event'> | string;
      metadata?: StringNullableFilter<'Event'> | string | null;
      pullRequest?: XOR<PullRequestNullableScalarRelationFilter, PullRequestWhereInput> | null;
    },
    'id' | 'uuid'
  >;

  export type EventOrderByWithAggregationInput = {
    id?: SortOrder;
    uuid?: SortOrder;
    ts?: SortOrder;
    type?: SortOrder;
    pull_request_id?: SortOrderInput | SortOrder;
    repo_full_name?: SortOrder;
    pr_number?: SortOrder;
    correlation_id?: SortOrder;
    request_id?: SortOrderInput | SortOrder;
    version?: SortOrder;
    payload?: SortOrder;
    metadata?: SortOrderInput | SortOrder;
    _count?: EventCountOrderByAggregateInput;
    _avg?: EventAvgOrderByAggregateInput;
    _max?: EventMaxOrderByAggregateInput;
    _min?: EventMinOrderByAggregateInput;
    _sum?: EventSumOrderByAggregateInput;
  };

  export type EventScalarWhereWithAggregatesInput = {
    AND?: EventScalarWhereWithAggregatesInput | EventScalarWhereWithAggregatesInput[];
    OR?: EventScalarWhereWithAggregatesInput[];
    NOT?: EventScalarWhereWithAggregatesInput | EventScalarWhereWithAggregatesInput[];
    id?: IntWithAggregatesFilter<'Event'> | number;
    uuid?: StringWithAggregatesFilter<'Event'> | string;
    ts?: DateTimeWithAggregatesFilter<'Event'> | Date | string;
    type?: StringWithAggregatesFilter<'Event'> | string;
    pull_request_id?: IntNullableWithAggregatesFilter<'Event'> | number | null;
    repo_full_name?: StringWithAggregatesFilter<'Event'> | string;
    pr_number?: IntWithAggregatesFilter<'Event'> | number;
    correlation_id?: StringWithAggregatesFilter<'Event'> | string;
    request_id?: StringNullableWithAggregatesFilter<'Event'> | string | null;
    version?: StringWithAggregatesFilter<'Event'> | string;
    payload?: StringWithAggregatesFilter<'Event'> | string;
    metadata?: StringNullableWithAggregatesFilter<'Event'> | string | null;
  };

  export type QueueOrderWhereInput = {
    AND?: QueueOrderWhereInput | QueueOrderWhereInput[];
    OR?: QueueOrderWhereInput[];
    NOT?: QueueOrderWhereInput | QueueOrderWhereInput[];
    id?: IntFilter<'QueueOrder'> | number;
    queue_item_id?: IntFilter<'QueueOrder'> | number;
    position?: IntNullableFilter<'QueueOrder'> | number | null;
    created_at?: DateTimeFilter<'QueueOrder'> | Date | string;
    updated_at?: DateTimeFilter<'QueueOrder'> | Date | string;
    queueItem?: XOR<ReviewQueueScalarRelationFilter, ReviewQueueWhereInput>;
  };

  export type QueueOrderOrderByWithRelationInput = {
    id?: SortOrder;
    queue_item_id?: SortOrder;
    position?: SortOrderInput | SortOrder;
    created_at?: SortOrder;
    updated_at?: SortOrder;
    queueItem?: ReviewQueueOrderByWithRelationInput;
  };

  export type QueueOrderWhereUniqueInput = Prisma.AtLeast<
    {
      id?: number;
      queue_item_id?: number;
      AND?: QueueOrderWhereInput | QueueOrderWhereInput[];
      OR?: QueueOrderWhereInput[];
      NOT?: QueueOrderWhereInput | QueueOrderWhereInput[];
      position?: IntNullableFilter<'QueueOrder'> | number | null;
      created_at?: DateTimeFilter<'QueueOrder'> | Date | string;
      updated_at?: DateTimeFilter<'QueueOrder'> | Date | string;
      queueItem?: XOR<ReviewQueueScalarRelationFilter, ReviewQueueWhereInput>;
    },
    'id' | 'queue_item_id'
  >;

  export type QueueOrderOrderByWithAggregationInput = {
    id?: SortOrder;
    queue_item_id?: SortOrder;
    position?: SortOrderInput | SortOrder;
    created_at?: SortOrder;
    updated_at?: SortOrder;
    _count?: QueueOrderCountOrderByAggregateInput;
    _avg?: QueueOrderAvgOrderByAggregateInput;
    _max?: QueueOrderMaxOrderByAggregateInput;
    _min?: QueueOrderMinOrderByAggregateInput;
    _sum?: QueueOrderSumOrderByAggregateInput;
  };

  export type QueueOrderScalarWhereWithAggregatesInput = {
    AND?: QueueOrderScalarWhereWithAggregatesInput | QueueOrderScalarWhereWithAggregatesInput[];
    OR?: QueueOrderScalarWhereWithAggregatesInput[];
    NOT?: QueueOrderScalarWhereWithAggregatesInput | QueueOrderScalarWhereWithAggregatesInput[];
    id?: IntWithAggregatesFilter<'QueueOrder'> | number;
    queue_item_id?: IntWithAggregatesFilter<'QueueOrder'> | number;
    position?: IntNullableWithAggregatesFilter<'QueueOrder'> | number | null;
    created_at?: DateTimeWithAggregatesFilter<'QueueOrder'> | Date | string;
    updated_at?: DateTimeWithAggregatesFilter<'QueueOrder'> | Date | string;
  };

  export type SystemStateWhereInput = {
    AND?: SystemStateWhereInput | SystemStateWhereInput[];
    OR?: SystemStateWhereInput[];
    NOT?: SystemStateWhereInput | SystemStateWhereInput[];
    state_key?: StringFilter<'SystemState'> | string;
    value_text?: StringNullableFilter<'SystemState'> | string | null;
    value_integer?: IntNullableFilter<'SystemState'> | number | null;
    value_float?: FloatNullableFilter<'SystemState'> | number | null;
    value_datetime?: StringNullableFilter<'SystemState'> | string | null;
    updated_at?: StringFilter<'SystemState'> | string;
  };

  export type SystemStateOrderByWithRelationInput = {
    state_key?: SortOrder;
    value_text?: SortOrderInput | SortOrder;
    value_integer?: SortOrderInput | SortOrder;
    value_float?: SortOrderInput | SortOrder;
    value_datetime?: SortOrderInput | SortOrder;
    updated_at?: SortOrder;
  };

  export type SystemStateWhereUniqueInput = Prisma.AtLeast<
    {
      state_key?: string;
      AND?: SystemStateWhereInput | SystemStateWhereInput[];
      OR?: SystemStateWhereInput[];
      NOT?: SystemStateWhereInput | SystemStateWhereInput[];
      value_text?: StringNullableFilter<'SystemState'> | string | null;
      value_integer?: IntNullableFilter<'SystemState'> | number | null;
      value_float?: FloatNullableFilter<'SystemState'> | number | null;
      value_datetime?: StringNullableFilter<'SystemState'> | string | null;
      updated_at?: StringFilter<'SystemState'> | string;
    },
    'state_key'
  >;

  export type SystemStateOrderByWithAggregationInput = {
    state_key?: SortOrder;
    value_text?: SortOrderInput | SortOrder;
    value_integer?: SortOrderInput | SortOrder;
    value_float?: SortOrderInput | SortOrder;
    value_datetime?: SortOrderInput | SortOrder;
    updated_at?: SortOrder;
    _count?: SystemStateCountOrderByAggregateInput;
    _avg?: SystemStateAvgOrderByAggregateInput;
    _max?: SystemStateMaxOrderByAggregateInput;
    _min?: SystemStateMinOrderByAggregateInput;
    _sum?: SystemStateSumOrderByAggregateInput;
  };

  export type SystemStateScalarWhereWithAggregatesInput = {
    AND?: SystemStateScalarWhereWithAggregatesInput | SystemStateScalarWhereWithAggregatesInput[];
    OR?: SystemStateScalarWhereWithAggregatesInput[];
    NOT?: SystemStateScalarWhereWithAggregatesInput | SystemStateScalarWhereWithAggregatesInput[];
    state_key?: StringWithAggregatesFilter<'SystemState'> | string;
    value_text?: StringNullableWithAggregatesFilter<'SystemState'> | string | null;
    value_integer?: IntNullableWithAggregatesFilter<'SystemState'> | number | null;
    value_float?: FloatNullableWithAggregatesFilter<'SystemState'> | number | null;
    value_datetime?: StringNullableWithAggregatesFilter<'SystemState'> | string | null;
    updated_at?: StringWithAggregatesFilter<'SystemState'> | string;
  };

  export type PullRequestCreateInput = {
    uuid?: string;
    repo_full_name: string;
    pr_number: number;
    title: string;
    author_login: string;
    first_seen_at: Date | string;
    first_review_limit_at?: Date | string | null;
    last_review_limit_at?: Date | string | null;
    last_review_requested_at?: Date | string | null;
    last_coderabbit_review_at?: Date | string | null;
    last_coderabbit_acknowledged_at?: Date | string | null;
    retrigger_count?: number;
    review_count?: number;
    created_at?: Date | string;
    updated_at?: Date | string;
    queueItems?: ReviewQueueCreateNestedManyWithoutPullRequestInput;
    events?: EventCreateNestedManyWithoutPullRequestInput;
  };

  export type PullRequestUncheckedCreateInput = {
    id?: number;
    uuid?: string;
    repo_full_name: string;
    pr_number: number;
    title: string;
    author_login: string;
    first_seen_at: Date | string;
    first_review_limit_at?: Date | string | null;
    last_review_limit_at?: Date | string | null;
    last_review_requested_at?: Date | string | null;
    last_coderabbit_review_at?: Date | string | null;
    last_coderabbit_acknowledged_at?: Date | string | null;
    retrigger_count?: number;
    review_count?: number;
    created_at?: Date | string;
    updated_at?: Date | string;
    queueItems?: ReviewQueueUncheckedCreateNestedManyWithoutPullRequestInput;
    events?: EventUncheckedCreateNestedManyWithoutPullRequestInput;
  };

  export type PullRequestUpdateInput = {
    uuid?: StringFieldUpdateOperationsInput | string;
    repo_full_name?: StringFieldUpdateOperationsInput | string;
    pr_number?: IntFieldUpdateOperationsInput | number;
    title?: StringFieldUpdateOperationsInput | string;
    author_login?: StringFieldUpdateOperationsInput | string;
    first_seen_at?: DateTimeFieldUpdateOperationsInput | Date | string;
    first_review_limit_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    last_review_limit_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    last_review_requested_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    last_coderabbit_review_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    last_coderabbit_acknowledged_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    retrigger_count?: IntFieldUpdateOperationsInput | number;
    review_count?: IntFieldUpdateOperationsInput | number;
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string;
    queueItems?: ReviewQueueUpdateManyWithoutPullRequestNestedInput;
    events?: EventUpdateManyWithoutPullRequestNestedInput;
  };

  export type PullRequestUncheckedUpdateInput = {
    id?: IntFieldUpdateOperationsInput | number;
    uuid?: StringFieldUpdateOperationsInput | string;
    repo_full_name?: StringFieldUpdateOperationsInput | string;
    pr_number?: IntFieldUpdateOperationsInput | number;
    title?: StringFieldUpdateOperationsInput | string;
    author_login?: StringFieldUpdateOperationsInput | string;
    first_seen_at?: DateTimeFieldUpdateOperationsInput | Date | string;
    first_review_limit_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    last_review_limit_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    last_review_requested_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    last_coderabbit_review_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    last_coderabbit_acknowledged_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    retrigger_count?: IntFieldUpdateOperationsInput | number;
    review_count?: IntFieldUpdateOperationsInput | number;
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string;
    queueItems?: ReviewQueueUncheckedUpdateManyWithoutPullRequestNestedInput;
    events?: EventUncheckedUpdateManyWithoutPullRequestNestedInput;
  };

  export type PullRequestCreateManyInput = {
    id?: number;
    uuid?: string;
    repo_full_name: string;
    pr_number: number;
    title: string;
    author_login: string;
    first_seen_at: Date | string;
    first_review_limit_at?: Date | string | null;
    last_review_limit_at?: Date | string | null;
    last_review_requested_at?: Date | string | null;
    last_coderabbit_review_at?: Date | string | null;
    last_coderabbit_acknowledged_at?: Date | string | null;
    retrigger_count?: number;
    review_count?: number;
    created_at?: Date | string;
    updated_at?: Date | string;
  };

  export type PullRequestUpdateManyMutationInput = {
    uuid?: StringFieldUpdateOperationsInput | string;
    repo_full_name?: StringFieldUpdateOperationsInput | string;
    pr_number?: IntFieldUpdateOperationsInput | number;
    title?: StringFieldUpdateOperationsInput | string;
    author_login?: StringFieldUpdateOperationsInput | string;
    first_seen_at?: DateTimeFieldUpdateOperationsInput | Date | string;
    first_review_limit_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    last_review_limit_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    last_review_requested_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    last_coderabbit_review_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    last_coderabbit_acknowledged_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    retrigger_count?: IntFieldUpdateOperationsInput | number;
    review_count?: IntFieldUpdateOperationsInput | number;
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type PullRequestUncheckedUpdateManyInput = {
    id?: IntFieldUpdateOperationsInput | number;
    uuid?: StringFieldUpdateOperationsInput | string;
    repo_full_name?: StringFieldUpdateOperationsInput | string;
    pr_number?: IntFieldUpdateOperationsInput | number;
    title?: StringFieldUpdateOperationsInput | string;
    author_login?: StringFieldUpdateOperationsInput | string;
    first_seen_at?: DateTimeFieldUpdateOperationsInput | Date | string;
    first_review_limit_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    last_review_limit_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    last_review_requested_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    last_coderabbit_review_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    last_coderabbit_acknowledged_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    retrigger_count?: IntFieldUpdateOperationsInput | number;
    review_count?: IntFieldUpdateOperationsInput | number;
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type ReviewQueueCreateInput = {
    uuid?: string;
    repo_full_name: string;
    pr_number: number;
    pr_title: string;
    status?: string;
    not_before: Date | string;
    attempts?: number;
    source_comment_url: string;
    source_comment_id: number;
    trigger_source?: string;
    retrigger_comment_url?: string | null;
    retriggered_at?: Date | string | null;
    failed_at?: Date | string | null;
    reviewed_at?: Date | string | null;
    created_at?: Date | string;
    updated_at?: Date | string;
    queueOrder?: QueueOrderCreateNestedOneWithoutQueueItemInput;
    pullRequest?: PullRequestCreateNestedOneWithoutQueueItemsInput;
  };

  export type ReviewQueueUncheckedCreateInput = {
    id?: number;
    uuid?: string;
    pull_request_id?: number | null;
    repo_full_name: string;
    pr_number: number;
    pr_title: string;
    status?: string;
    not_before: Date | string;
    attempts?: number;
    source_comment_url: string;
    source_comment_id: number;
    trigger_source?: string;
    retrigger_comment_url?: string | null;
    retriggered_at?: Date | string | null;
    failed_at?: Date | string | null;
    reviewed_at?: Date | string | null;
    created_at?: Date | string;
    updated_at?: Date | string;
    queueOrder?: QueueOrderUncheckedCreateNestedOneWithoutQueueItemInput;
  };

  export type ReviewQueueUpdateInput = {
    uuid?: StringFieldUpdateOperationsInput | string;
    repo_full_name?: StringFieldUpdateOperationsInput | string;
    pr_number?: IntFieldUpdateOperationsInput | number;
    pr_title?: StringFieldUpdateOperationsInput | string;
    status?: StringFieldUpdateOperationsInput | string;
    not_before?: DateTimeFieldUpdateOperationsInput | Date | string;
    attempts?: IntFieldUpdateOperationsInput | number;
    source_comment_url?: StringFieldUpdateOperationsInput | string;
    source_comment_id?: IntFieldUpdateOperationsInput | number;
    trigger_source?: StringFieldUpdateOperationsInput | string;
    retrigger_comment_url?: NullableStringFieldUpdateOperationsInput | string | null;
    retriggered_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    failed_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    reviewed_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string;
    queueOrder?: QueueOrderUpdateOneWithoutQueueItemNestedInput;
    pullRequest?: PullRequestUpdateOneWithoutQueueItemsNestedInput;
  };

  export type ReviewQueueUncheckedUpdateInput = {
    id?: IntFieldUpdateOperationsInput | number;
    uuid?: StringFieldUpdateOperationsInput | string;
    pull_request_id?: NullableIntFieldUpdateOperationsInput | number | null;
    repo_full_name?: StringFieldUpdateOperationsInput | string;
    pr_number?: IntFieldUpdateOperationsInput | number;
    pr_title?: StringFieldUpdateOperationsInput | string;
    status?: StringFieldUpdateOperationsInput | string;
    not_before?: DateTimeFieldUpdateOperationsInput | Date | string;
    attempts?: IntFieldUpdateOperationsInput | number;
    source_comment_url?: StringFieldUpdateOperationsInput | string;
    source_comment_id?: IntFieldUpdateOperationsInput | number;
    trigger_source?: StringFieldUpdateOperationsInput | string;
    retrigger_comment_url?: NullableStringFieldUpdateOperationsInput | string | null;
    retriggered_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    failed_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    reviewed_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string;
    queueOrder?: QueueOrderUncheckedUpdateOneWithoutQueueItemNestedInput;
  };

  export type ReviewQueueCreateManyInput = {
    id?: number;
    uuid?: string;
    pull_request_id?: number | null;
    repo_full_name: string;
    pr_number: number;
    pr_title: string;
    status?: string;
    not_before: Date | string;
    attempts?: number;
    source_comment_url: string;
    source_comment_id: number;
    trigger_source?: string;
    retrigger_comment_url?: string | null;
    retriggered_at?: Date | string | null;
    failed_at?: Date | string | null;
    reviewed_at?: Date | string | null;
    created_at?: Date | string;
    updated_at?: Date | string;
  };

  export type ReviewQueueUpdateManyMutationInput = {
    uuid?: StringFieldUpdateOperationsInput | string;
    repo_full_name?: StringFieldUpdateOperationsInput | string;
    pr_number?: IntFieldUpdateOperationsInput | number;
    pr_title?: StringFieldUpdateOperationsInput | string;
    status?: StringFieldUpdateOperationsInput | string;
    not_before?: DateTimeFieldUpdateOperationsInput | Date | string;
    attempts?: IntFieldUpdateOperationsInput | number;
    source_comment_url?: StringFieldUpdateOperationsInput | string;
    source_comment_id?: IntFieldUpdateOperationsInput | number;
    trigger_source?: StringFieldUpdateOperationsInput | string;
    retrigger_comment_url?: NullableStringFieldUpdateOperationsInput | string | null;
    retriggered_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    failed_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    reviewed_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type ReviewQueueUncheckedUpdateManyInput = {
    id?: IntFieldUpdateOperationsInput | number;
    uuid?: StringFieldUpdateOperationsInput | string;
    pull_request_id?: NullableIntFieldUpdateOperationsInput | number | null;
    repo_full_name?: StringFieldUpdateOperationsInput | string;
    pr_number?: IntFieldUpdateOperationsInput | number;
    pr_title?: StringFieldUpdateOperationsInput | string;
    status?: StringFieldUpdateOperationsInput | string;
    not_before?: DateTimeFieldUpdateOperationsInput | Date | string;
    attempts?: IntFieldUpdateOperationsInput | number;
    source_comment_url?: StringFieldUpdateOperationsInput | string;
    source_comment_id?: IntFieldUpdateOperationsInput | number;
    trigger_source?: StringFieldUpdateOperationsInput | string;
    retrigger_comment_url?: NullableStringFieldUpdateOperationsInput | string | null;
    retriggered_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    failed_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    reviewed_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type EventCreateInput = {
    uuid?: string;
    ts?: Date | string;
    type: string;
    repo_full_name: string;
    pr_number: number;
    correlation_id: string;
    request_id?: string | null;
    version: string;
    payload: string;
    metadata?: string | null;
    pullRequest?: PullRequestCreateNestedOneWithoutEventsInput;
  };

  export type EventUncheckedCreateInput = {
    id?: number;
    uuid?: string;
    ts?: Date | string;
    type: string;
    pull_request_id?: number | null;
    repo_full_name: string;
    pr_number: number;
    correlation_id: string;
    request_id?: string | null;
    version: string;
    payload: string;
    metadata?: string | null;
  };

  export type EventUpdateInput = {
    uuid?: StringFieldUpdateOperationsInput | string;
    ts?: DateTimeFieldUpdateOperationsInput | Date | string;
    type?: StringFieldUpdateOperationsInput | string;
    repo_full_name?: StringFieldUpdateOperationsInput | string;
    pr_number?: IntFieldUpdateOperationsInput | number;
    correlation_id?: StringFieldUpdateOperationsInput | string;
    request_id?: NullableStringFieldUpdateOperationsInput | string | null;
    version?: StringFieldUpdateOperationsInput | string;
    payload?: StringFieldUpdateOperationsInput | string;
    metadata?: NullableStringFieldUpdateOperationsInput | string | null;
    pullRequest?: PullRequestUpdateOneWithoutEventsNestedInput;
  };

  export type EventUncheckedUpdateInput = {
    id?: IntFieldUpdateOperationsInput | number;
    uuid?: StringFieldUpdateOperationsInput | string;
    ts?: DateTimeFieldUpdateOperationsInput | Date | string;
    type?: StringFieldUpdateOperationsInput | string;
    pull_request_id?: NullableIntFieldUpdateOperationsInput | number | null;
    repo_full_name?: StringFieldUpdateOperationsInput | string;
    pr_number?: IntFieldUpdateOperationsInput | number;
    correlation_id?: StringFieldUpdateOperationsInput | string;
    request_id?: NullableStringFieldUpdateOperationsInput | string | null;
    version?: StringFieldUpdateOperationsInput | string;
    payload?: StringFieldUpdateOperationsInput | string;
    metadata?: NullableStringFieldUpdateOperationsInput | string | null;
  };

  export type EventCreateManyInput = {
    id?: number;
    uuid?: string;
    ts?: Date | string;
    type: string;
    pull_request_id?: number | null;
    repo_full_name: string;
    pr_number: number;
    correlation_id: string;
    request_id?: string | null;
    version: string;
    payload: string;
    metadata?: string | null;
  };

  export type EventUpdateManyMutationInput = {
    uuid?: StringFieldUpdateOperationsInput | string;
    ts?: DateTimeFieldUpdateOperationsInput | Date | string;
    type?: StringFieldUpdateOperationsInput | string;
    repo_full_name?: StringFieldUpdateOperationsInput | string;
    pr_number?: IntFieldUpdateOperationsInput | number;
    correlation_id?: StringFieldUpdateOperationsInput | string;
    request_id?: NullableStringFieldUpdateOperationsInput | string | null;
    version?: StringFieldUpdateOperationsInput | string;
    payload?: StringFieldUpdateOperationsInput | string;
    metadata?: NullableStringFieldUpdateOperationsInput | string | null;
  };

  export type EventUncheckedUpdateManyInput = {
    id?: IntFieldUpdateOperationsInput | number;
    uuid?: StringFieldUpdateOperationsInput | string;
    ts?: DateTimeFieldUpdateOperationsInput | Date | string;
    type?: StringFieldUpdateOperationsInput | string;
    pull_request_id?: NullableIntFieldUpdateOperationsInput | number | null;
    repo_full_name?: StringFieldUpdateOperationsInput | string;
    pr_number?: IntFieldUpdateOperationsInput | number;
    correlation_id?: StringFieldUpdateOperationsInput | string;
    request_id?: NullableStringFieldUpdateOperationsInput | string | null;
    version?: StringFieldUpdateOperationsInput | string;
    payload?: StringFieldUpdateOperationsInput | string;
    metadata?: NullableStringFieldUpdateOperationsInput | string | null;
  };

  export type QueueOrderCreateInput = {
    position?: number | null;
    created_at?: Date | string;
    updated_at?: Date | string;
    queueItem: ReviewQueueCreateNestedOneWithoutQueueOrderInput;
  };

  export type QueueOrderUncheckedCreateInput = {
    id?: number;
    queue_item_id: number;
    position?: number | null;
    created_at?: Date | string;
    updated_at?: Date | string;
  };

  export type QueueOrderUpdateInput = {
    position?: NullableIntFieldUpdateOperationsInput | number | null;
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string;
    queueItem?: ReviewQueueUpdateOneRequiredWithoutQueueOrderNestedInput;
  };

  export type QueueOrderUncheckedUpdateInput = {
    id?: IntFieldUpdateOperationsInput | number;
    queue_item_id?: IntFieldUpdateOperationsInput | number;
    position?: NullableIntFieldUpdateOperationsInput | number | null;
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type QueueOrderCreateManyInput = {
    id?: number;
    queue_item_id: number;
    position?: number | null;
    created_at?: Date | string;
    updated_at?: Date | string;
  };

  export type QueueOrderUpdateManyMutationInput = {
    position?: NullableIntFieldUpdateOperationsInput | number | null;
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type QueueOrderUncheckedUpdateManyInput = {
    id?: IntFieldUpdateOperationsInput | number;
    queue_item_id?: IntFieldUpdateOperationsInput | number;
    position?: NullableIntFieldUpdateOperationsInput | number | null;
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type SystemStateCreateInput = {
    state_key: string;
    value_text?: string | null;
    value_integer?: number | null;
    value_float?: number | null;
    value_datetime?: string | null;
    updated_at: string;
  };

  export type SystemStateUncheckedCreateInput = {
    state_key: string;
    value_text?: string | null;
    value_integer?: number | null;
    value_float?: number | null;
    value_datetime?: string | null;
    updated_at: string;
  };

  export type SystemStateUpdateInput = {
    state_key?: StringFieldUpdateOperationsInput | string;
    value_text?: NullableStringFieldUpdateOperationsInput | string | null;
    value_integer?: NullableIntFieldUpdateOperationsInput | number | null;
    value_float?: NullableFloatFieldUpdateOperationsInput | number | null;
    value_datetime?: NullableStringFieldUpdateOperationsInput | string | null;
    updated_at?: StringFieldUpdateOperationsInput | string;
  };

  export type SystemStateUncheckedUpdateInput = {
    state_key?: StringFieldUpdateOperationsInput | string;
    value_text?: NullableStringFieldUpdateOperationsInput | string | null;
    value_integer?: NullableIntFieldUpdateOperationsInput | number | null;
    value_float?: NullableFloatFieldUpdateOperationsInput | number | null;
    value_datetime?: NullableStringFieldUpdateOperationsInput | string | null;
    updated_at?: StringFieldUpdateOperationsInput | string;
  };

  export type SystemStateCreateManyInput = {
    state_key: string;
    value_text?: string | null;
    value_integer?: number | null;
    value_float?: number | null;
    value_datetime?: string | null;
    updated_at: string;
  };

  export type SystemStateUpdateManyMutationInput = {
    state_key?: StringFieldUpdateOperationsInput | string;
    value_text?: NullableStringFieldUpdateOperationsInput | string | null;
    value_integer?: NullableIntFieldUpdateOperationsInput | number | null;
    value_float?: NullableFloatFieldUpdateOperationsInput | number | null;
    value_datetime?: NullableStringFieldUpdateOperationsInput | string | null;
    updated_at?: StringFieldUpdateOperationsInput | string;
  };

  export type SystemStateUncheckedUpdateManyInput = {
    state_key?: StringFieldUpdateOperationsInput | string;
    value_text?: NullableStringFieldUpdateOperationsInput | string | null;
    value_integer?: NullableIntFieldUpdateOperationsInput | number | null;
    value_float?: NullableFloatFieldUpdateOperationsInput | number | null;
    value_datetime?: NullableStringFieldUpdateOperationsInput | string | null;
    updated_at?: StringFieldUpdateOperationsInput | string;
  };

  export type IntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>;
    in?: number[];
    notIn?: number[];
    lt?: number | IntFieldRefInput<$PrismaModel>;
    lte?: number | IntFieldRefInput<$PrismaModel>;
    gt?: number | IntFieldRefInput<$PrismaModel>;
    gte?: number | IntFieldRefInput<$PrismaModel>;
    not?: NestedIntFilter<$PrismaModel> | number;
  };

  export type StringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>;
    in?: string[];
    notIn?: string[];
    lt?: string | StringFieldRefInput<$PrismaModel>;
    lte?: string | StringFieldRefInput<$PrismaModel>;
    gt?: string | StringFieldRefInput<$PrismaModel>;
    gte?: string | StringFieldRefInput<$PrismaModel>;
    contains?: string | StringFieldRefInput<$PrismaModel>;
    startsWith?: string | StringFieldRefInput<$PrismaModel>;
    endsWith?: string | StringFieldRefInput<$PrismaModel>;
    not?: NestedStringFilter<$PrismaModel> | string;
  };

  export type DateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    in?: Date[] | string[];
    notIn?: Date[] | string[];
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string;
  };

  export type DateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null;
    in?: Date[] | string[] | null;
    notIn?: Date[] | string[] | null;
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null;
  };

  export type ReviewQueueListRelationFilter = {
    every?: ReviewQueueWhereInput;
    some?: ReviewQueueWhereInput;
    none?: ReviewQueueWhereInput;
  };

  export type EventListRelationFilter = {
    every?: EventWhereInput;
    some?: EventWhereInput;
    none?: EventWhereInput;
  };

  export type SortOrderInput = {
    sort: SortOrder;
    nulls?: NullsOrder;
  };

  export type ReviewQueueOrderByRelationAggregateInput = {
    _count?: SortOrder;
  };

  export type EventOrderByRelationAggregateInput = {
    _count?: SortOrder;
  };

  export type PullRequestRepo_full_namePr_numberCompoundUniqueInput = {
    repo_full_name: string;
    pr_number: number;
  };

  export type PullRequestCountOrderByAggregateInput = {
    id?: SortOrder;
    uuid?: SortOrder;
    repo_full_name?: SortOrder;
    pr_number?: SortOrder;
    title?: SortOrder;
    author_login?: SortOrder;
    first_seen_at?: SortOrder;
    first_review_limit_at?: SortOrder;
    last_review_limit_at?: SortOrder;
    last_review_requested_at?: SortOrder;
    last_coderabbit_review_at?: SortOrder;
    last_coderabbit_acknowledged_at?: SortOrder;
    retrigger_count?: SortOrder;
    review_count?: SortOrder;
    created_at?: SortOrder;
    updated_at?: SortOrder;
  };

  export type PullRequestAvgOrderByAggregateInput = {
    id?: SortOrder;
    pr_number?: SortOrder;
    retrigger_count?: SortOrder;
    review_count?: SortOrder;
  };

  export type PullRequestMaxOrderByAggregateInput = {
    id?: SortOrder;
    uuid?: SortOrder;
    repo_full_name?: SortOrder;
    pr_number?: SortOrder;
    title?: SortOrder;
    author_login?: SortOrder;
    first_seen_at?: SortOrder;
    first_review_limit_at?: SortOrder;
    last_review_limit_at?: SortOrder;
    last_review_requested_at?: SortOrder;
    last_coderabbit_review_at?: SortOrder;
    last_coderabbit_acknowledged_at?: SortOrder;
    retrigger_count?: SortOrder;
    review_count?: SortOrder;
    created_at?: SortOrder;
    updated_at?: SortOrder;
  };

  export type PullRequestMinOrderByAggregateInput = {
    id?: SortOrder;
    uuid?: SortOrder;
    repo_full_name?: SortOrder;
    pr_number?: SortOrder;
    title?: SortOrder;
    author_login?: SortOrder;
    first_seen_at?: SortOrder;
    first_review_limit_at?: SortOrder;
    last_review_limit_at?: SortOrder;
    last_review_requested_at?: SortOrder;
    last_coderabbit_review_at?: SortOrder;
    last_coderabbit_acknowledged_at?: SortOrder;
    retrigger_count?: SortOrder;
    review_count?: SortOrder;
    created_at?: SortOrder;
    updated_at?: SortOrder;
  };

  export type PullRequestSumOrderByAggregateInput = {
    id?: SortOrder;
    pr_number?: SortOrder;
    retrigger_count?: SortOrder;
    review_count?: SortOrder;
  };

  export type IntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>;
    in?: number[];
    notIn?: number[];
    lt?: number | IntFieldRefInput<$PrismaModel>;
    lte?: number | IntFieldRefInput<$PrismaModel>;
    gt?: number | IntFieldRefInput<$PrismaModel>;
    gte?: number | IntFieldRefInput<$PrismaModel>;
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number;
    _count?: NestedIntFilter<$PrismaModel>;
    _avg?: NestedFloatFilter<$PrismaModel>;
    _sum?: NestedIntFilter<$PrismaModel>;
    _min?: NestedIntFilter<$PrismaModel>;
    _max?: NestedIntFilter<$PrismaModel>;
  };

  export type StringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>;
    in?: string[];
    notIn?: string[];
    lt?: string | StringFieldRefInput<$PrismaModel>;
    lte?: string | StringFieldRefInput<$PrismaModel>;
    gt?: string | StringFieldRefInput<$PrismaModel>;
    gte?: string | StringFieldRefInput<$PrismaModel>;
    contains?: string | StringFieldRefInput<$PrismaModel>;
    startsWith?: string | StringFieldRefInput<$PrismaModel>;
    endsWith?: string | StringFieldRefInput<$PrismaModel>;
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedStringFilter<$PrismaModel>;
    _max?: NestedStringFilter<$PrismaModel>;
  };

  export type DateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    in?: Date[] | string[];
    notIn?: Date[] | string[];
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedDateTimeFilter<$PrismaModel>;
    _max?: NestedDateTimeFilter<$PrismaModel>;
  };

  export type DateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null;
    in?: Date[] | string[] | null;
    notIn?: Date[] | string[] | null;
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null;
    _count?: NestedIntNullableFilter<$PrismaModel>;
    _min?: NestedDateTimeNullableFilter<$PrismaModel>;
    _max?: NestedDateTimeNullableFilter<$PrismaModel>;
  };

  export type IntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null;
    in?: number[] | null;
    notIn?: number[] | null;
    lt?: number | IntFieldRefInput<$PrismaModel>;
    lte?: number | IntFieldRefInput<$PrismaModel>;
    gt?: number | IntFieldRefInput<$PrismaModel>;
    gte?: number | IntFieldRefInput<$PrismaModel>;
    not?: NestedIntNullableFilter<$PrismaModel> | number | null;
  };

  export type StringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null;
    in?: string[] | null;
    notIn?: string[] | null;
    lt?: string | StringFieldRefInput<$PrismaModel>;
    lte?: string | StringFieldRefInput<$PrismaModel>;
    gt?: string | StringFieldRefInput<$PrismaModel>;
    gte?: string | StringFieldRefInput<$PrismaModel>;
    contains?: string | StringFieldRefInput<$PrismaModel>;
    startsWith?: string | StringFieldRefInput<$PrismaModel>;
    endsWith?: string | StringFieldRefInput<$PrismaModel>;
    not?: NestedStringNullableFilter<$PrismaModel> | string | null;
  };

  export type QueueOrderNullableScalarRelationFilter = {
    is?: QueueOrderWhereInput | null;
    isNot?: QueueOrderWhereInput | null;
  };

  export type PullRequestNullableScalarRelationFilter = {
    is?: PullRequestWhereInput | null;
    isNot?: PullRequestWhereInput | null;
  };

  export type ReviewQueueCountOrderByAggregateInput = {
    id?: SortOrder;
    uuid?: SortOrder;
    pull_request_id?: SortOrder;
    repo_full_name?: SortOrder;
    pr_number?: SortOrder;
    pr_title?: SortOrder;
    status?: SortOrder;
    not_before?: SortOrder;
    attempts?: SortOrder;
    source_comment_url?: SortOrder;
    source_comment_id?: SortOrder;
    trigger_source?: SortOrder;
    retrigger_comment_url?: SortOrder;
    retriggered_at?: SortOrder;
    failed_at?: SortOrder;
    reviewed_at?: SortOrder;
    created_at?: SortOrder;
    updated_at?: SortOrder;
  };

  export type ReviewQueueAvgOrderByAggregateInput = {
    id?: SortOrder;
    pull_request_id?: SortOrder;
    pr_number?: SortOrder;
    attempts?: SortOrder;
    source_comment_id?: SortOrder;
  };

  export type ReviewQueueMaxOrderByAggregateInput = {
    id?: SortOrder;
    uuid?: SortOrder;
    pull_request_id?: SortOrder;
    repo_full_name?: SortOrder;
    pr_number?: SortOrder;
    pr_title?: SortOrder;
    status?: SortOrder;
    not_before?: SortOrder;
    attempts?: SortOrder;
    source_comment_url?: SortOrder;
    source_comment_id?: SortOrder;
    trigger_source?: SortOrder;
    retrigger_comment_url?: SortOrder;
    retriggered_at?: SortOrder;
    failed_at?: SortOrder;
    reviewed_at?: SortOrder;
    created_at?: SortOrder;
    updated_at?: SortOrder;
  };

  export type ReviewQueueMinOrderByAggregateInput = {
    id?: SortOrder;
    uuid?: SortOrder;
    pull_request_id?: SortOrder;
    repo_full_name?: SortOrder;
    pr_number?: SortOrder;
    pr_title?: SortOrder;
    status?: SortOrder;
    not_before?: SortOrder;
    attempts?: SortOrder;
    source_comment_url?: SortOrder;
    source_comment_id?: SortOrder;
    trigger_source?: SortOrder;
    retrigger_comment_url?: SortOrder;
    retriggered_at?: SortOrder;
    failed_at?: SortOrder;
    reviewed_at?: SortOrder;
    created_at?: SortOrder;
    updated_at?: SortOrder;
  };

  export type ReviewQueueSumOrderByAggregateInput = {
    id?: SortOrder;
    pull_request_id?: SortOrder;
    pr_number?: SortOrder;
    attempts?: SortOrder;
    source_comment_id?: SortOrder;
  };

  export type IntNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null;
    in?: number[] | null;
    notIn?: number[] | null;
    lt?: number | IntFieldRefInput<$PrismaModel>;
    lte?: number | IntFieldRefInput<$PrismaModel>;
    gt?: number | IntFieldRefInput<$PrismaModel>;
    gte?: number | IntFieldRefInput<$PrismaModel>;
    not?: NestedIntNullableWithAggregatesFilter<$PrismaModel> | number | null;
    _count?: NestedIntNullableFilter<$PrismaModel>;
    _avg?: NestedFloatNullableFilter<$PrismaModel>;
    _sum?: NestedIntNullableFilter<$PrismaModel>;
    _min?: NestedIntNullableFilter<$PrismaModel>;
    _max?: NestedIntNullableFilter<$PrismaModel>;
  };

  export type StringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null;
    in?: string[] | null;
    notIn?: string[] | null;
    lt?: string | StringFieldRefInput<$PrismaModel>;
    lte?: string | StringFieldRefInput<$PrismaModel>;
    gt?: string | StringFieldRefInput<$PrismaModel>;
    gte?: string | StringFieldRefInput<$PrismaModel>;
    contains?: string | StringFieldRefInput<$PrismaModel>;
    startsWith?: string | StringFieldRefInput<$PrismaModel>;
    endsWith?: string | StringFieldRefInput<$PrismaModel>;
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null;
    _count?: NestedIntNullableFilter<$PrismaModel>;
    _min?: NestedStringNullableFilter<$PrismaModel>;
    _max?: NestedStringNullableFilter<$PrismaModel>;
  };

  export type EventCountOrderByAggregateInput = {
    id?: SortOrder;
    uuid?: SortOrder;
    ts?: SortOrder;
    type?: SortOrder;
    pull_request_id?: SortOrder;
    repo_full_name?: SortOrder;
    pr_number?: SortOrder;
    correlation_id?: SortOrder;
    request_id?: SortOrder;
    version?: SortOrder;
    payload?: SortOrder;
    metadata?: SortOrder;
  };

  export type EventAvgOrderByAggregateInput = {
    id?: SortOrder;
    pull_request_id?: SortOrder;
    pr_number?: SortOrder;
  };

  export type EventMaxOrderByAggregateInput = {
    id?: SortOrder;
    uuid?: SortOrder;
    ts?: SortOrder;
    type?: SortOrder;
    pull_request_id?: SortOrder;
    repo_full_name?: SortOrder;
    pr_number?: SortOrder;
    correlation_id?: SortOrder;
    request_id?: SortOrder;
    version?: SortOrder;
    payload?: SortOrder;
    metadata?: SortOrder;
  };

  export type EventMinOrderByAggregateInput = {
    id?: SortOrder;
    uuid?: SortOrder;
    ts?: SortOrder;
    type?: SortOrder;
    pull_request_id?: SortOrder;
    repo_full_name?: SortOrder;
    pr_number?: SortOrder;
    correlation_id?: SortOrder;
    request_id?: SortOrder;
    version?: SortOrder;
    payload?: SortOrder;
    metadata?: SortOrder;
  };

  export type EventSumOrderByAggregateInput = {
    id?: SortOrder;
    pull_request_id?: SortOrder;
    pr_number?: SortOrder;
  };

  export type ReviewQueueScalarRelationFilter = {
    is?: ReviewQueueWhereInput;
    isNot?: ReviewQueueWhereInput;
  };

  export type QueueOrderCountOrderByAggregateInput = {
    id?: SortOrder;
    queue_item_id?: SortOrder;
    position?: SortOrder;
    created_at?: SortOrder;
    updated_at?: SortOrder;
  };

  export type QueueOrderAvgOrderByAggregateInput = {
    id?: SortOrder;
    queue_item_id?: SortOrder;
    position?: SortOrder;
  };

  export type QueueOrderMaxOrderByAggregateInput = {
    id?: SortOrder;
    queue_item_id?: SortOrder;
    position?: SortOrder;
    created_at?: SortOrder;
    updated_at?: SortOrder;
  };

  export type QueueOrderMinOrderByAggregateInput = {
    id?: SortOrder;
    queue_item_id?: SortOrder;
    position?: SortOrder;
    created_at?: SortOrder;
    updated_at?: SortOrder;
  };

  export type QueueOrderSumOrderByAggregateInput = {
    id?: SortOrder;
    queue_item_id?: SortOrder;
    position?: SortOrder;
  };

  export type FloatNullableFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null;
    in?: number[] | null;
    notIn?: number[] | null;
    lt?: number | FloatFieldRefInput<$PrismaModel>;
    lte?: number | FloatFieldRefInput<$PrismaModel>;
    gt?: number | FloatFieldRefInput<$PrismaModel>;
    gte?: number | FloatFieldRefInput<$PrismaModel>;
    not?: NestedFloatNullableFilter<$PrismaModel> | number | null;
  };

  export type SystemStateCountOrderByAggregateInput = {
    state_key?: SortOrder;
    value_text?: SortOrder;
    value_integer?: SortOrder;
    value_float?: SortOrder;
    value_datetime?: SortOrder;
    updated_at?: SortOrder;
  };

  export type SystemStateAvgOrderByAggregateInput = {
    value_integer?: SortOrder;
    value_float?: SortOrder;
  };

  export type SystemStateMaxOrderByAggregateInput = {
    state_key?: SortOrder;
    value_text?: SortOrder;
    value_integer?: SortOrder;
    value_float?: SortOrder;
    value_datetime?: SortOrder;
    updated_at?: SortOrder;
  };

  export type SystemStateMinOrderByAggregateInput = {
    state_key?: SortOrder;
    value_text?: SortOrder;
    value_integer?: SortOrder;
    value_float?: SortOrder;
    value_datetime?: SortOrder;
    updated_at?: SortOrder;
  };

  export type SystemStateSumOrderByAggregateInput = {
    value_integer?: SortOrder;
    value_float?: SortOrder;
  };

  export type FloatNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null;
    in?: number[] | null;
    notIn?: number[] | null;
    lt?: number | FloatFieldRefInput<$PrismaModel>;
    lte?: number | FloatFieldRefInput<$PrismaModel>;
    gt?: number | FloatFieldRefInput<$PrismaModel>;
    gte?: number | FloatFieldRefInput<$PrismaModel>;
    not?: NestedFloatNullableWithAggregatesFilter<$PrismaModel> | number | null;
    _count?: NestedIntNullableFilter<$PrismaModel>;
    _avg?: NestedFloatNullableFilter<$PrismaModel>;
    _sum?: NestedFloatNullableFilter<$PrismaModel>;
    _min?: NestedFloatNullableFilter<$PrismaModel>;
    _max?: NestedFloatNullableFilter<$PrismaModel>;
  };

  export type ReviewQueueCreateNestedManyWithoutPullRequestInput = {
    create?:
      | XOR<ReviewQueueCreateWithoutPullRequestInput, ReviewQueueUncheckedCreateWithoutPullRequestInput>
      | ReviewQueueCreateWithoutPullRequestInput[]
      | ReviewQueueUncheckedCreateWithoutPullRequestInput[];
    connectOrCreate?: ReviewQueueCreateOrConnectWithoutPullRequestInput | ReviewQueueCreateOrConnectWithoutPullRequestInput[];
    createMany?: ReviewQueueCreateManyPullRequestInputEnvelope;
    connect?: ReviewQueueWhereUniqueInput | ReviewQueueWhereUniqueInput[];
  };

  export type EventCreateNestedManyWithoutPullRequestInput = {
    create?:
      | XOR<EventCreateWithoutPullRequestInput, EventUncheckedCreateWithoutPullRequestInput>
      | EventCreateWithoutPullRequestInput[]
      | EventUncheckedCreateWithoutPullRequestInput[];
    connectOrCreate?: EventCreateOrConnectWithoutPullRequestInput | EventCreateOrConnectWithoutPullRequestInput[];
    createMany?: EventCreateManyPullRequestInputEnvelope;
    connect?: EventWhereUniqueInput | EventWhereUniqueInput[];
  };

  export type ReviewQueueUncheckedCreateNestedManyWithoutPullRequestInput = {
    create?:
      | XOR<ReviewQueueCreateWithoutPullRequestInput, ReviewQueueUncheckedCreateWithoutPullRequestInput>
      | ReviewQueueCreateWithoutPullRequestInput[]
      | ReviewQueueUncheckedCreateWithoutPullRequestInput[];
    connectOrCreate?: ReviewQueueCreateOrConnectWithoutPullRequestInput | ReviewQueueCreateOrConnectWithoutPullRequestInput[];
    createMany?: ReviewQueueCreateManyPullRequestInputEnvelope;
    connect?: ReviewQueueWhereUniqueInput | ReviewQueueWhereUniqueInput[];
  };

  export type EventUncheckedCreateNestedManyWithoutPullRequestInput = {
    create?:
      | XOR<EventCreateWithoutPullRequestInput, EventUncheckedCreateWithoutPullRequestInput>
      | EventCreateWithoutPullRequestInput[]
      | EventUncheckedCreateWithoutPullRequestInput[];
    connectOrCreate?: EventCreateOrConnectWithoutPullRequestInput | EventCreateOrConnectWithoutPullRequestInput[];
    createMany?: EventCreateManyPullRequestInputEnvelope;
    connect?: EventWhereUniqueInput | EventWhereUniqueInput[];
  };

  export type StringFieldUpdateOperationsInput = {
    set?: string;
  };

  export type IntFieldUpdateOperationsInput = {
    set?: number;
    increment?: number;
    decrement?: number;
    multiply?: number;
    divide?: number;
  };

  export type DateTimeFieldUpdateOperationsInput = {
    set?: Date | string;
  };

  export type NullableDateTimeFieldUpdateOperationsInput = {
    set?: Date | string | null;
  };

  export type ReviewQueueUpdateManyWithoutPullRequestNestedInput = {
    create?:
      | XOR<ReviewQueueCreateWithoutPullRequestInput, ReviewQueueUncheckedCreateWithoutPullRequestInput>
      | ReviewQueueCreateWithoutPullRequestInput[]
      | ReviewQueueUncheckedCreateWithoutPullRequestInput[];
    connectOrCreate?: ReviewQueueCreateOrConnectWithoutPullRequestInput | ReviewQueueCreateOrConnectWithoutPullRequestInput[];
    upsert?: ReviewQueueUpsertWithWhereUniqueWithoutPullRequestInput | ReviewQueueUpsertWithWhereUniqueWithoutPullRequestInput[];
    createMany?: ReviewQueueCreateManyPullRequestInputEnvelope;
    set?: ReviewQueueWhereUniqueInput | ReviewQueueWhereUniqueInput[];
    disconnect?: ReviewQueueWhereUniqueInput | ReviewQueueWhereUniqueInput[];
    delete?: ReviewQueueWhereUniqueInput | ReviewQueueWhereUniqueInput[];
    connect?: ReviewQueueWhereUniqueInput | ReviewQueueWhereUniqueInput[];
    update?: ReviewQueueUpdateWithWhereUniqueWithoutPullRequestInput | ReviewQueueUpdateWithWhereUniqueWithoutPullRequestInput[];
    updateMany?: ReviewQueueUpdateManyWithWhereWithoutPullRequestInput | ReviewQueueUpdateManyWithWhereWithoutPullRequestInput[];
    deleteMany?: ReviewQueueScalarWhereInput | ReviewQueueScalarWhereInput[];
  };

  export type EventUpdateManyWithoutPullRequestNestedInput = {
    create?:
      | XOR<EventCreateWithoutPullRequestInput, EventUncheckedCreateWithoutPullRequestInput>
      | EventCreateWithoutPullRequestInput[]
      | EventUncheckedCreateWithoutPullRequestInput[];
    connectOrCreate?: EventCreateOrConnectWithoutPullRequestInput | EventCreateOrConnectWithoutPullRequestInput[];
    upsert?: EventUpsertWithWhereUniqueWithoutPullRequestInput | EventUpsertWithWhereUniqueWithoutPullRequestInput[];
    createMany?: EventCreateManyPullRequestInputEnvelope;
    set?: EventWhereUniqueInput | EventWhereUniqueInput[];
    disconnect?: EventWhereUniqueInput | EventWhereUniqueInput[];
    delete?: EventWhereUniqueInput | EventWhereUniqueInput[];
    connect?: EventWhereUniqueInput | EventWhereUniqueInput[];
    update?: EventUpdateWithWhereUniqueWithoutPullRequestInput | EventUpdateWithWhereUniqueWithoutPullRequestInput[];
    updateMany?: EventUpdateManyWithWhereWithoutPullRequestInput | EventUpdateManyWithWhereWithoutPullRequestInput[];
    deleteMany?: EventScalarWhereInput | EventScalarWhereInput[];
  };

  export type ReviewQueueUncheckedUpdateManyWithoutPullRequestNestedInput = {
    create?:
      | XOR<ReviewQueueCreateWithoutPullRequestInput, ReviewQueueUncheckedCreateWithoutPullRequestInput>
      | ReviewQueueCreateWithoutPullRequestInput[]
      | ReviewQueueUncheckedCreateWithoutPullRequestInput[];
    connectOrCreate?: ReviewQueueCreateOrConnectWithoutPullRequestInput | ReviewQueueCreateOrConnectWithoutPullRequestInput[];
    upsert?: ReviewQueueUpsertWithWhereUniqueWithoutPullRequestInput | ReviewQueueUpsertWithWhereUniqueWithoutPullRequestInput[];
    createMany?: ReviewQueueCreateManyPullRequestInputEnvelope;
    set?: ReviewQueueWhereUniqueInput | ReviewQueueWhereUniqueInput[];
    disconnect?: ReviewQueueWhereUniqueInput | ReviewQueueWhereUniqueInput[];
    delete?: ReviewQueueWhereUniqueInput | ReviewQueueWhereUniqueInput[];
    connect?: ReviewQueueWhereUniqueInput | ReviewQueueWhereUniqueInput[];
    update?: ReviewQueueUpdateWithWhereUniqueWithoutPullRequestInput | ReviewQueueUpdateWithWhereUniqueWithoutPullRequestInput[];
    updateMany?: ReviewQueueUpdateManyWithWhereWithoutPullRequestInput | ReviewQueueUpdateManyWithWhereWithoutPullRequestInput[];
    deleteMany?: ReviewQueueScalarWhereInput | ReviewQueueScalarWhereInput[];
  };

  export type EventUncheckedUpdateManyWithoutPullRequestNestedInput = {
    create?:
      | XOR<EventCreateWithoutPullRequestInput, EventUncheckedCreateWithoutPullRequestInput>
      | EventCreateWithoutPullRequestInput[]
      | EventUncheckedCreateWithoutPullRequestInput[];
    connectOrCreate?: EventCreateOrConnectWithoutPullRequestInput | EventCreateOrConnectWithoutPullRequestInput[];
    upsert?: EventUpsertWithWhereUniqueWithoutPullRequestInput | EventUpsertWithWhereUniqueWithoutPullRequestInput[];
    createMany?: EventCreateManyPullRequestInputEnvelope;
    set?: EventWhereUniqueInput | EventWhereUniqueInput[];
    disconnect?: EventWhereUniqueInput | EventWhereUniqueInput[];
    delete?: EventWhereUniqueInput | EventWhereUniqueInput[];
    connect?: EventWhereUniqueInput | EventWhereUniqueInput[];
    update?: EventUpdateWithWhereUniqueWithoutPullRequestInput | EventUpdateWithWhereUniqueWithoutPullRequestInput[];
    updateMany?: EventUpdateManyWithWhereWithoutPullRequestInput | EventUpdateManyWithWhereWithoutPullRequestInput[];
    deleteMany?: EventScalarWhereInput | EventScalarWhereInput[];
  };

  export type QueueOrderCreateNestedOneWithoutQueueItemInput = {
    create?: XOR<QueueOrderCreateWithoutQueueItemInput, QueueOrderUncheckedCreateWithoutQueueItemInput>;
    connectOrCreate?: QueueOrderCreateOrConnectWithoutQueueItemInput;
    connect?: QueueOrderWhereUniqueInput;
  };

  export type PullRequestCreateNestedOneWithoutQueueItemsInput = {
    create?: XOR<PullRequestCreateWithoutQueueItemsInput, PullRequestUncheckedCreateWithoutQueueItemsInput>;
    connectOrCreate?: PullRequestCreateOrConnectWithoutQueueItemsInput;
    connect?: PullRequestWhereUniqueInput;
  };

  export type QueueOrderUncheckedCreateNestedOneWithoutQueueItemInput = {
    create?: XOR<QueueOrderCreateWithoutQueueItemInput, QueueOrderUncheckedCreateWithoutQueueItemInput>;
    connectOrCreate?: QueueOrderCreateOrConnectWithoutQueueItemInput;
    connect?: QueueOrderWhereUniqueInput;
  };

  export type NullableStringFieldUpdateOperationsInput = {
    set?: string | null;
  };

  export type QueueOrderUpdateOneWithoutQueueItemNestedInput = {
    create?: XOR<QueueOrderCreateWithoutQueueItemInput, QueueOrderUncheckedCreateWithoutQueueItemInput>;
    connectOrCreate?: QueueOrderCreateOrConnectWithoutQueueItemInput;
    upsert?: QueueOrderUpsertWithoutQueueItemInput;
    disconnect?: QueueOrderWhereInput | boolean;
    delete?: QueueOrderWhereInput | boolean;
    connect?: QueueOrderWhereUniqueInput;
    update?: XOR<
      XOR<QueueOrderUpdateToOneWithWhereWithoutQueueItemInput, QueueOrderUpdateWithoutQueueItemInput>,
      QueueOrderUncheckedUpdateWithoutQueueItemInput
    >;
  };

  export type PullRequestUpdateOneWithoutQueueItemsNestedInput = {
    create?: XOR<PullRequestCreateWithoutQueueItemsInput, PullRequestUncheckedCreateWithoutQueueItemsInput>;
    connectOrCreate?: PullRequestCreateOrConnectWithoutQueueItemsInput;
    upsert?: PullRequestUpsertWithoutQueueItemsInput;
    disconnect?: PullRequestWhereInput | boolean;
    delete?: PullRequestWhereInput | boolean;
    connect?: PullRequestWhereUniqueInput;
    update?: XOR<
      XOR<PullRequestUpdateToOneWithWhereWithoutQueueItemsInput, PullRequestUpdateWithoutQueueItemsInput>,
      PullRequestUncheckedUpdateWithoutQueueItemsInput
    >;
  };

  export type NullableIntFieldUpdateOperationsInput = {
    set?: number | null;
    increment?: number;
    decrement?: number;
    multiply?: number;
    divide?: number;
  };

  export type QueueOrderUncheckedUpdateOneWithoutQueueItemNestedInput = {
    create?: XOR<QueueOrderCreateWithoutQueueItemInput, QueueOrderUncheckedCreateWithoutQueueItemInput>;
    connectOrCreate?: QueueOrderCreateOrConnectWithoutQueueItemInput;
    upsert?: QueueOrderUpsertWithoutQueueItemInput;
    disconnect?: QueueOrderWhereInput | boolean;
    delete?: QueueOrderWhereInput | boolean;
    connect?: QueueOrderWhereUniqueInput;
    update?: XOR<
      XOR<QueueOrderUpdateToOneWithWhereWithoutQueueItemInput, QueueOrderUpdateWithoutQueueItemInput>,
      QueueOrderUncheckedUpdateWithoutQueueItemInput
    >;
  };

  export type PullRequestCreateNestedOneWithoutEventsInput = {
    create?: XOR<PullRequestCreateWithoutEventsInput, PullRequestUncheckedCreateWithoutEventsInput>;
    connectOrCreate?: PullRequestCreateOrConnectWithoutEventsInput;
    connect?: PullRequestWhereUniqueInput;
  };

  export type PullRequestUpdateOneWithoutEventsNestedInput = {
    create?: XOR<PullRequestCreateWithoutEventsInput, PullRequestUncheckedCreateWithoutEventsInput>;
    connectOrCreate?: PullRequestCreateOrConnectWithoutEventsInput;
    upsert?: PullRequestUpsertWithoutEventsInput;
    disconnect?: PullRequestWhereInput | boolean;
    delete?: PullRequestWhereInput | boolean;
    connect?: PullRequestWhereUniqueInput;
    update?: XOR<XOR<PullRequestUpdateToOneWithWhereWithoutEventsInput, PullRequestUpdateWithoutEventsInput>, PullRequestUncheckedUpdateWithoutEventsInput>;
  };

  export type ReviewQueueCreateNestedOneWithoutQueueOrderInput = {
    create?: XOR<ReviewQueueCreateWithoutQueueOrderInput, ReviewQueueUncheckedCreateWithoutQueueOrderInput>;
    connectOrCreate?: ReviewQueueCreateOrConnectWithoutQueueOrderInput;
    connect?: ReviewQueueWhereUniqueInput;
  };

  export type ReviewQueueUpdateOneRequiredWithoutQueueOrderNestedInput = {
    create?: XOR<ReviewQueueCreateWithoutQueueOrderInput, ReviewQueueUncheckedCreateWithoutQueueOrderInput>;
    connectOrCreate?: ReviewQueueCreateOrConnectWithoutQueueOrderInput;
    upsert?: ReviewQueueUpsertWithoutQueueOrderInput;
    connect?: ReviewQueueWhereUniqueInput;
    update?: XOR<
      XOR<ReviewQueueUpdateToOneWithWhereWithoutQueueOrderInput, ReviewQueueUpdateWithoutQueueOrderInput>,
      ReviewQueueUncheckedUpdateWithoutQueueOrderInput
    >;
  };

  export type NullableFloatFieldUpdateOperationsInput = {
    set?: number | null;
    increment?: number;
    decrement?: number;
    multiply?: number;
    divide?: number;
  };

  export type NestedIntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>;
    in?: number[];
    notIn?: number[];
    lt?: number | IntFieldRefInput<$PrismaModel>;
    lte?: number | IntFieldRefInput<$PrismaModel>;
    gt?: number | IntFieldRefInput<$PrismaModel>;
    gte?: number | IntFieldRefInput<$PrismaModel>;
    not?: NestedIntFilter<$PrismaModel> | number;
  };

  export type NestedStringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>;
    in?: string[];
    notIn?: string[];
    lt?: string | StringFieldRefInput<$PrismaModel>;
    lte?: string | StringFieldRefInput<$PrismaModel>;
    gt?: string | StringFieldRefInput<$PrismaModel>;
    gte?: string | StringFieldRefInput<$PrismaModel>;
    contains?: string | StringFieldRefInput<$PrismaModel>;
    startsWith?: string | StringFieldRefInput<$PrismaModel>;
    endsWith?: string | StringFieldRefInput<$PrismaModel>;
    not?: NestedStringFilter<$PrismaModel> | string;
  };

  export type NestedDateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    in?: Date[] | string[];
    notIn?: Date[] | string[];
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string;
  };

  export type NestedDateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null;
    in?: Date[] | string[] | null;
    notIn?: Date[] | string[] | null;
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null;
  };

  export type NestedIntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>;
    in?: number[];
    notIn?: number[];
    lt?: number | IntFieldRefInput<$PrismaModel>;
    lte?: number | IntFieldRefInput<$PrismaModel>;
    gt?: number | IntFieldRefInput<$PrismaModel>;
    gte?: number | IntFieldRefInput<$PrismaModel>;
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number;
    _count?: NestedIntFilter<$PrismaModel>;
    _avg?: NestedFloatFilter<$PrismaModel>;
    _sum?: NestedIntFilter<$PrismaModel>;
    _min?: NestedIntFilter<$PrismaModel>;
    _max?: NestedIntFilter<$PrismaModel>;
  };

  export type NestedFloatFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>;
    in?: number[];
    notIn?: number[];
    lt?: number | FloatFieldRefInput<$PrismaModel>;
    lte?: number | FloatFieldRefInput<$PrismaModel>;
    gt?: number | FloatFieldRefInput<$PrismaModel>;
    gte?: number | FloatFieldRefInput<$PrismaModel>;
    not?: NestedFloatFilter<$PrismaModel> | number;
  };

  export type NestedStringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>;
    in?: string[];
    notIn?: string[];
    lt?: string | StringFieldRefInput<$PrismaModel>;
    lte?: string | StringFieldRefInput<$PrismaModel>;
    gt?: string | StringFieldRefInput<$PrismaModel>;
    gte?: string | StringFieldRefInput<$PrismaModel>;
    contains?: string | StringFieldRefInput<$PrismaModel>;
    startsWith?: string | StringFieldRefInput<$PrismaModel>;
    endsWith?: string | StringFieldRefInput<$PrismaModel>;
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedStringFilter<$PrismaModel>;
    _max?: NestedStringFilter<$PrismaModel>;
  };

  export type NestedDateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    in?: Date[] | string[];
    notIn?: Date[] | string[];
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string;
    _count?: NestedIntFilter<$PrismaModel>;
    _min?: NestedDateTimeFilter<$PrismaModel>;
    _max?: NestedDateTimeFilter<$PrismaModel>;
  };

  export type NestedDateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null;
    in?: Date[] | string[] | null;
    notIn?: Date[] | string[] | null;
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>;
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null;
    _count?: NestedIntNullableFilter<$PrismaModel>;
    _min?: NestedDateTimeNullableFilter<$PrismaModel>;
    _max?: NestedDateTimeNullableFilter<$PrismaModel>;
  };

  export type NestedIntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null;
    in?: number[] | null;
    notIn?: number[] | null;
    lt?: number | IntFieldRefInput<$PrismaModel>;
    lte?: number | IntFieldRefInput<$PrismaModel>;
    gt?: number | IntFieldRefInput<$PrismaModel>;
    gte?: number | IntFieldRefInput<$PrismaModel>;
    not?: NestedIntNullableFilter<$PrismaModel> | number | null;
  };

  export type NestedStringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null;
    in?: string[] | null;
    notIn?: string[] | null;
    lt?: string | StringFieldRefInput<$PrismaModel>;
    lte?: string | StringFieldRefInput<$PrismaModel>;
    gt?: string | StringFieldRefInput<$PrismaModel>;
    gte?: string | StringFieldRefInput<$PrismaModel>;
    contains?: string | StringFieldRefInput<$PrismaModel>;
    startsWith?: string | StringFieldRefInput<$PrismaModel>;
    endsWith?: string | StringFieldRefInput<$PrismaModel>;
    not?: NestedStringNullableFilter<$PrismaModel> | string | null;
  };

  export type NestedIntNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null;
    in?: number[] | null;
    notIn?: number[] | null;
    lt?: number | IntFieldRefInput<$PrismaModel>;
    lte?: number | IntFieldRefInput<$PrismaModel>;
    gt?: number | IntFieldRefInput<$PrismaModel>;
    gte?: number | IntFieldRefInput<$PrismaModel>;
    not?: NestedIntNullableWithAggregatesFilter<$PrismaModel> | number | null;
    _count?: NestedIntNullableFilter<$PrismaModel>;
    _avg?: NestedFloatNullableFilter<$PrismaModel>;
    _sum?: NestedIntNullableFilter<$PrismaModel>;
    _min?: NestedIntNullableFilter<$PrismaModel>;
    _max?: NestedIntNullableFilter<$PrismaModel>;
  };

  export type NestedFloatNullableFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null;
    in?: number[] | null;
    notIn?: number[] | null;
    lt?: number | FloatFieldRefInput<$PrismaModel>;
    lte?: number | FloatFieldRefInput<$PrismaModel>;
    gt?: number | FloatFieldRefInput<$PrismaModel>;
    gte?: number | FloatFieldRefInput<$PrismaModel>;
    not?: NestedFloatNullableFilter<$PrismaModel> | number | null;
  };

  export type NestedStringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null;
    in?: string[] | null;
    notIn?: string[] | null;
    lt?: string | StringFieldRefInput<$PrismaModel>;
    lte?: string | StringFieldRefInput<$PrismaModel>;
    gt?: string | StringFieldRefInput<$PrismaModel>;
    gte?: string | StringFieldRefInput<$PrismaModel>;
    contains?: string | StringFieldRefInput<$PrismaModel>;
    startsWith?: string | StringFieldRefInput<$PrismaModel>;
    endsWith?: string | StringFieldRefInput<$PrismaModel>;
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null;
    _count?: NestedIntNullableFilter<$PrismaModel>;
    _min?: NestedStringNullableFilter<$PrismaModel>;
    _max?: NestedStringNullableFilter<$PrismaModel>;
  };

  export type NestedFloatNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null;
    in?: number[] | null;
    notIn?: number[] | null;
    lt?: number | FloatFieldRefInput<$PrismaModel>;
    lte?: number | FloatFieldRefInput<$PrismaModel>;
    gt?: number | FloatFieldRefInput<$PrismaModel>;
    gte?: number | FloatFieldRefInput<$PrismaModel>;
    not?: NestedFloatNullableWithAggregatesFilter<$PrismaModel> | number | null;
    _count?: NestedIntNullableFilter<$PrismaModel>;
    _avg?: NestedFloatNullableFilter<$PrismaModel>;
    _sum?: NestedFloatNullableFilter<$PrismaModel>;
    _min?: NestedFloatNullableFilter<$PrismaModel>;
    _max?: NestedFloatNullableFilter<$PrismaModel>;
  };

  export type ReviewQueueCreateWithoutPullRequestInput = {
    uuid?: string;
    repo_full_name: string;
    pr_number: number;
    pr_title: string;
    status?: string;
    not_before: Date | string;
    attempts?: number;
    source_comment_url: string;
    source_comment_id: number;
    trigger_source?: string;
    retrigger_comment_url?: string | null;
    retriggered_at?: Date | string | null;
    failed_at?: Date | string | null;
    reviewed_at?: Date | string | null;
    created_at?: Date | string;
    updated_at?: Date | string;
    queueOrder?: QueueOrderCreateNestedOneWithoutQueueItemInput;
  };

  export type ReviewQueueUncheckedCreateWithoutPullRequestInput = {
    id?: number;
    uuid?: string;
    repo_full_name: string;
    pr_number: number;
    pr_title: string;
    status?: string;
    not_before: Date | string;
    attempts?: number;
    source_comment_url: string;
    source_comment_id: number;
    trigger_source?: string;
    retrigger_comment_url?: string | null;
    retriggered_at?: Date | string | null;
    failed_at?: Date | string | null;
    reviewed_at?: Date | string | null;
    created_at?: Date | string;
    updated_at?: Date | string;
    queueOrder?: QueueOrderUncheckedCreateNestedOneWithoutQueueItemInput;
  };

  export type ReviewQueueCreateOrConnectWithoutPullRequestInput = {
    where: ReviewQueueWhereUniqueInput;
    create: XOR<ReviewQueueCreateWithoutPullRequestInput, ReviewQueueUncheckedCreateWithoutPullRequestInput>;
  };

  export type ReviewQueueCreateManyPullRequestInputEnvelope = {
    data: ReviewQueueCreateManyPullRequestInput | ReviewQueueCreateManyPullRequestInput[];
  };

  export type EventCreateWithoutPullRequestInput = {
    uuid?: string;
    ts?: Date | string;
    type: string;
    repo_full_name: string;
    pr_number: number;
    correlation_id: string;
    request_id?: string | null;
    version: string;
    payload: string;
    metadata?: string | null;
  };

  export type EventUncheckedCreateWithoutPullRequestInput = {
    id?: number;
    uuid?: string;
    ts?: Date | string;
    type: string;
    repo_full_name: string;
    pr_number: number;
    correlation_id: string;
    request_id?: string | null;
    version: string;
    payload: string;
    metadata?: string | null;
  };

  export type EventCreateOrConnectWithoutPullRequestInput = {
    where: EventWhereUniqueInput;
    create: XOR<EventCreateWithoutPullRequestInput, EventUncheckedCreateWithoutPullRequestInput>;
  };

  export type EventCreateManyPullRequestInputEnvelope = {
    data: EventCreateManyPullRequestInput | EventCreateManyPullRequestInput[];
  };

  export type ReviewQueueUpsertWithWhereUniqueWithoutPullRequestInput = {
    where: ReviewQueueWhereUniqueInput;
    update: XOR<ReviewQueueUpdateWithoutPullRequestInput, ReviewQueueUncheckedUpdateWithoutPullRequestInput>;
    create: XOR<ReviewQueueCreateWithoutPullRequestInput, ReviewQueueUncheckedCreateWithoutPullRequestInput>;
  };

  export type ReviewQueueUpdateWithWhereUniqueWithoutPullRequestInput = {
    where: ReviewQueueWhereUniqueInput;
    data: XOR<ReviewQueueUpdateWithoutPullRequestInput, ReviewQueueUncheckedUpdateWithoutPullRequestInput>;
  };

  export type ReviewQueueUpdateManyWithWhereWithoutPullRequestInput = {
    where: ReviewQueueScalarWhereInput;
    data: XOR<ReviewQueueUpdateManyMutationInput, ReviewQueueUncheckedUpdateManyWithoutPullRequestInput>;
  };

  export type ReviewQueueScalarWhereInput = {
    AND?: ReviewQueueScalarWhereInput | ReviewQueueScalarWhereInput[];
    OR?: ReviewQueueScalarWhereInput[];
    NOT?: ReviewQueueScalarWhereInput | ReviewQueueScalarWhereInput[];
    id?: IntFilter<'ReviewQueue'> | number;
    uuid?: StringFilter<'ReviewQueue'> | string;
    pull_request_id?: IntNullableFilter<'ReviewQueue'> | number | null;
    repo_full_name?: StringFilter<'ReviewQueue'> | string;
    pr_number?: IntFilter<'ReviewQueue'> | number;
    pr_title?: StringFilter<'ReviewQueue'> | string;
    status?: StringFilter<'ReviewQueue'> | string;
    not_before?: DateTimeFilter<'ReviewQueue'> | Date | string;
    attempts?: IntFilter<'ReviewQueue'> | number;
    source_comment_url?: StringFilter<'ReviewQueue'> | string;
    source_comment_id?: IntFilter<'ReviewQueue'> | number;
    trigger_source?: StringFilter<'ReviewQueue'> | string;
    retrigger_comment_url?: StringNullableFilter<'ReviewQueue'> | string | null;
    retriggered_at?: DateTimeNullableFilter<'ReviewQueue'> | Date | string | null;
    failed_at?: DateTimeNullableFilter<'ReviewQueue'> | Date | string | null;
    reviewed_at?: DateTimeNullableFilter<'ReviewQueue'> | Date | string | null;
    created_at?: DateTimeFilter<'ReviewQueue'> | Date | string;
    updated_at?: DateTimeFilter<'ReviewQueue'> | Date | string;
  };

  export type EventUpsertWithWhereUniqueWithoutPullRequestInput = {
    where: EventWhereUniqueInput;
    update: XOR<EventUpdateWithoutPullRequestInput, EventUncheckedUpdateWithoutPullRequestInput>;
    create: XOR<EventCreateWithoutPullRequestInput, EventUncheckedCreateWithoutPullRequestInput>;
  };

  export type EventUpdateWithWhereUniqueWithoutPullRequestInput = {
    where: EventWhereUniqueInput;
    data: XOR<EventUpdateWithoutPullRequestInput, EventUncheckedUpdateWithoutPullRequestInput>;
  };

  export type EventUpdateManyWithWhereWithoutPullRequestInput = {
    where: EventScalarWhereInput;
    data: XOR<EventUpdateManyMutationInput, EventUncheckedUpdateManyWithoutPullRequestInput>;
  };

  export type EventScalarWhereInput = {
    AND?: EventScalarWhereInput | EventScalarWhereInput[];
    OR?: EventScalarWhereInput[];
    NOT?: EventScalarWhereInput | EventScalarWhereInput[];
    id?: IntFilter<'Event'> | number;
    uuid?: StringFilter<'Event'> | string;
    ts?: DateTimeFilter<'Event'> | Date | string;
    type?: StringFilter<'Event'> | string;
    pull_request_id?: IntNullableFilter<'Event'> | number | null;
    repo_full_name?: StringFilter<'Event'> | string;
    pr_number?: IntFilter<'Event'> | number;
    correlation_id?: StringFilter<'Event'> | string;
    request_id?: StringNullableFilter<'Event'> | string | null;
    version?: StringFilter<'Event'> | string;
    payload?: StringFilter<'Event'> | string;
    metadata?: StringNullableFilter<'Event'> | string | null;
  };

  export type QueueOrderCreateWithoutQueueItemInput = {
    position?: number | null;
    created_at?: Date | string;
    updated_at?: Date | string;
  };

  export type QueueOrderUncheckedCreateWithoutQueueItemInput = {
    id?: number;
    position?: number | null;
    created_at?: Date | string;
    updated_at?: Date | string;
  };

  export type QueueOrderCreateOrConnectWithoutQueueItemInput = {
    where: QueueOrderWhereUniqueInput;
    create: XOR<QueueOrderCreateWithoutQueueItemInput, QueueOrderUncheckedCreateWithoutQueueItemInput>;
  };

  export type PullRequestCreateWithoutQueueItemsInput = {
    uuid?: string;
    repo_full_name: string;
    pr_number: number;
    title: string;
    author_login: string;
    first_seen_at: Date | string;
    first_review_limit_at?: Date | string | null;
    last_review_limit_at?: Date | string | null;
    last_review_requested_at?: Date | string | null;
    last_coderabbit_review_at?: Date | string | null;
    last_coderabbit_acknowledged_at?: Date | string | null;
    retrigger_count?: number;
    review_count?: number;
    created_at?: Date | string;
    updated_at?: Date | string;
    events?: EventCreateNestedManyWithoutPullRequestInput;
  };

  export type PullRequestUncheckedCreateWithoutQueueItemsInput = {
    id?: number;
    uuid?: string;
    repo_full_name: string;
    pr_number: number;
    title: string;
    author_login: string;
    first_seen_at: Date | string;
    first_review_limit_at?: Date | string | null;
    last_review_limit_at?: Date | string | null;
    last_review_requested_at?: Date | string | null;
    last_coderabbit_review_at?: Date | string | null;
    last_coderabbit_acknowledged_at?: Date | string | null;
    retrigger_count?: number;
    review_count?: number;
    created_at?: Date | string;
    updated_at?: Date | string;
    events?: EventUncheckedCreateNestedManyWithoutPullRequestInput;
  };

  export type PullRequestCreateOrConnectWithoutQueueItemsInput = {
    where: PullRequestWhereUniqueInput;
    create: XOR<PullRequestCreateWithoutQueueItemsInput, PullRequestUncheckedCreateWithoutQueueItemsInput>;
  };

  export type QueueOrderUpsertWithoutQueueItemInput = {
    update: XOR<QueueOrderUpdateWithoutQueueItemInput, QueueOrderUncheckedUpdateWithoutQueueItemInput>;
    create: XOR<QueueOrderCreateWithoutQueueItemInput, QueueOrderUncheckedCreateWithoutQueueItemInput>;
    where?: QueueOrderWhereInput;
  };

  export type QueueOrderUpdateToOneWithWhereWithoutQueueItemInput = {
    where?: QueueOrderWhereInput;
    data: XOR<QueueOrderUpdateWithoutQueueItemInput, QueueOrderUncheckedUpdateWithoutQueueItemInput>;
  };

  export type QueueOrderUpdateWithoutQueueItemInput = {
    position?: NullableIntFieldUpdateOperationsInput | number | null;
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type QueueOrderUncheckedUpdateWithoutQueueItemInput = {
    id?: IntFieldUpdateOperationsInput | number;
    position?: NullableIntFieldUpdateOperationsInput | number | null;
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type PullRequestUpsertWithoutQueueItemsInput = {
    update: XOR<PullRequestUpdateWithoutQueueItemsInput, PullRequestUncheckedUpdateWithoutQueueItemsInput>;
    create: XOR<PullRequestCreateWithoutQueueItemsInput, PullRequestUncheckedCreateWithoutQueueItemsInput>;
    where?: PullRequestWhereInput;
  };

  export type PullRequestUpdateToOneWithWhereWithoutQueueItemsInput = {
    where?: PullRequestWhereInput;
    data: XOR<PullRequestUpdateWithoutQueueItemsInput, PullRequestUncheckedUpdateWithoutQueueItemsInput>;
  };

  export type PullRequestUpdateWithoutQueueItemsInput = {
    uuid?: StringFieldUpdateOperationsInput | string;
    repo_full_name?: StringFieldUpdateOperationsInput | string;
    pr_number?: IntFieldUpdateOperationsInput | number;
    title?: StringFieldUpdateOperationsInput | string;
    author_login?: StringFieldUpdateOperationsInput | string;
    first_seen_at?: DateTimeFieldUpdateOperationsInput | Date | string;
    first_review_limit_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    last_review_limit_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    last_review_requested_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    last_coderabbit_review_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    last_coderabbit_acknowledged_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    retrigger_count?: IntFieldUpdateOperationsInput | number;
    review_count?: IntFieldUpdateOperationsInput | number;
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string;
    events?: EventUpdateManyWithoutPullRequestNestedInput;
  };

  export type PullRequestUncheckedUpdateWithoutQueueItemsInput = {
    id?: IntFieldUpdateOperationsInput | number;
    uuid?: StringFieldUpdateOperationsInput | string;
    repo_full_name?: StringFieldUpdateOperationsInput | string;
    pr_number?: IntFieldUpdateOperationsInput | number;
    title?: StringFieldUpdateOperationsInput | string;
    author_login?: StringFieldUpdateOperationsInput | string;
    first_seen_at?: DateTimeFieldUpdateOperationsInput | Date | string;
    first_review_limit_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    last_review_limit_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    last_review_requested_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    last_coderabbit_review_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    last_coderabbit_acknowledged_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    retrigger_count?: IntFieldUpdateOperationsInput | number;
    review_count?: IntFieldUpdateOperationsInput | number;
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string;
    events?: EventUncheckedUpdateManyWithoutPullRequestNestedInput;
  };

  export type PullRequestCreateWithoutEventsInput = {
    uuid?: string;
    repo_full_name: string;
    pr_number: number;
    title: string;
    author_login: string;
    first_seen_at: Date | string;
    first_review_limit_at?: Date | string | null;
    last_review_limit_at?: Date | string | null;
    last_review_requested_at?: Date | string | null;
    last_coderabbit_review_at?: Date | string | null;
    last_coderabbit_acknowledged_at?: Date | string | null;
    retrigger_count?: number;
    review_count?: number;
    created_at?: Date | string;
    updated_at?: Date | string;
    queueItems?: ReviewQueueCreateNestedManyWithoutPullRequestInput;
  };

  export type PullRequestUncheckedCreateWithoutEventsInput = {
    id?: number;
    uuid?: string;
    repo_full_name: string;
    pr_number: number;
    title: string;
    author_login: string;
    first_seen_at: Date | string;
    first_review_limit_at?: Date | string | null;
    last_review_limit_at?: Date | string | null;
    last_review_requested_at?: Date | string | null;
    last_coderabbit_review_at?: Date | string | null;
    last_coderabbit_acknowledged_at?: Date | string | null;
    retrigger_count?: number;
    review_count?: number;
    created_at?: Date | string;
    updated_at?: Date | string;
    queueItems?: ReviewQueueUncheckedCreateNestedManyWithoutPullRequestInput;
  };

  export type PullRequestCreateOrConnectWithoutEventsInput = {
    where: PullRequestWhereUniqueInput;
    create: XOR<PullRequestCreateWithoutEventsInput, PullRequestUncheckedCreateWithoutEventsInput>;
  };

  export type PullRequestUpsertWithoutEventsInput = {
    update: XOR<PullRequestUpdateWithoutEventsInput, PullRequestUncheckedUpdateWithoutEventsInput>;
    create: XOR<PullRequestCreateWithoutEventsInput, PullRequestUncheckedCreateWithoutEventsInput>;
    where?: PullRequestWhereInput;
  };

  export type PullRequestUpdateToOneWithWhereWithoutEventsInput = {
    where?: PullRequestWhereInput;
    data: XOR<PullRequestUpdateWithoutEventsInput, PullRequestUncheckedUpdateWithoutEventsInput>;
  };

  export type PullRequestUpdateWithoutEventsInput = {
    uuid?: StringFieldUpdateOperationsInput | string;
    repo_full_name?: StringFieldUpdateOperationsInput | string;
    pr_number?: IntFieldUpdateOperationsInput | number;
    title?: StringFieldUpdateOperationsInput | string;
    author_login?: StringFieldUpdateOperationsInput | string;
    first_seen_at?: DateTimeFieldUpdateOperationsInput | Date | string;
    first_review_limit_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    last_review_limit_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    last_review_requested_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    last_coderabbit_review_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    last_coderabbit_acknowledged_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    retrigger_count?: IntFieldUpdateOperationsInput | number;
    review_count?: IntFieldUpdateOperationsInput | number;
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string;
    queueItems?: ReviewQueueUpdateManyWithoutPullRequestNestedInput;
  };

  export type PullRequestUncheckedUpdateWithoutEventsInput = {
    id?: IntFieldUpdateOperationsInput | number;
    uuid?: StringFieldUpdateOperationsInput | string;
    repo_full_name?: StringFieldUpdateOperationsInput | string;
    pr_number?: IntFieldUpdateOperationsInput | number;
    title?: StringFieldUpdateOperationsInput | string;
    author_login?: StringFieldUpdateOperationsInput | string;
    first_seen_at?: DateTimeFieldUpdateOperationsInput | Date | string;
    first_review_limit_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    last_review_limit_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    last_review_requested_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    last_coderabbit_review_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    last_coderabbit_acknowledged_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    retrigger_count?: IntFieldUpdateOperationsInput | number;
    review_count?: IntFieldUpdateOperationsInput | number;
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string;
    queueItems?: ReviewQueueUncheckedUpdateManyWithoutPullRequestNestedInput;
  };

  export type ReviewQueueCreateWithoutQueueOrderInput = {
    uuid?: string;
    repo_full_name: string;
    pr_number: number;
    pr_title: string;
    status?: string;
    not_before: Date | string;
    attempts?: number;
    source_comment_url: string;
    source_comment_id: number;
    trigger_source?: string;
    retrigger_comment_url?: string | null;
    retriggered_at?: Date | string | null;
    failed_at?: Date | string | null;
    reviewed_at?: Date | string | null;
    created_at?: Date | string;
    updated_at?: Date | string;
    pullRequest?: PullRequestCreateNestedOneWithoutQueueItemsInput;
  };

  export type ReviewQueueUncheckedCreateWithoutQueueOrderInput = {
    id?: number;
    uuid?: string;
    pull_request_id?: number | null;
    repo_full_name: string;
    pr_number: number;
    pr_title: string;
    status?: string;
    not_before: Date | string;
    attempts?: number;
    source_comment_url: string;
    source_comment_id: number;
    trigger_source?: string;
    retrigger_comment_url?: string | null;
    retriggered_at?: Date | string | null;
    failed_at?: Date | string | null;
    reviewed_at?: Date | string | null;
    created_at?: Date | string;
    updated_at?: Date | string;
  };

  export type ReviewQueueCreateOrConnectWithoutQueueOrderInput = {
    where: ReviewQueueWhereUniqueInput;
    create: XOR<ReviewQueueCreateWithoutQueueOrderInput, ReviewQueueUncheckedCreateWithoutQueueOrderInput>;
  };

  export type ReviewQueueUpsertWithoutQueueOrderInput = {
    update: XOR<ReviewQueueUpdateWithoutQueueOrderInput, ReviewQueueUncheckedUpdateWithoutQueueOrderInput>;
    create: XOR<ReviewQueueCreateWithoutQueueOrderInput, ReviewQueueUncheckedCreateWithoutQueueOrderInput>;
    where?: ReviewQueueWhereInput;
  };

  export type ReviewQueueUpdateToOneWithWhereWithoutQueueOrderInput = {
    where?: ReviewQueueWhereInput;
    data: XOR<ReviewQueueUpdateWithoutQueueOrderInput, ReviewQueueUncheckedUpdateWithoutQueueOrderInput>;
  };

  export type ReviewQueueUpdateWithoutQueueOrderInput = {
    uuid?: StringFieldUpdateOperationsInput | string;
    repo_full_name?: StringFieldUpdateOperationsInput | string;
    pr_number?: IntFieldUpdateOperationsInput | number;
    pr_title?: StringFieldUpdateOperationsInput | string;
    status?: StringFieldUpdateOperationsInput | string;
    not_before?: DateTimeFieldUpdateOperationsInput | Date | string;
    attempts?: IntFieldUpdateOperationsInput | number;
    source_comment_url?: StringFieldUpdateOperationsInput | string;
    source_comment_id?: IntFieldUpdateOperationsInput | number;
    trigger_source?: StringFieldUpdateOperationsInput | string;
    retrigger_comment_url?: NullableStringFieldUpdateOperationsInput | string | null;
    retriggered_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    failed_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    reviewed_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string;
    pullRequest?: PullRequestUpdateOneWithoutQueueItemsNestedInput;
  };

  export type ReviewQueueUncheckedUpdateWithoutQueueOrderInput = {
    id?: IntFieldUpdateOperationsInput | number;
    uuid?: StringFieldUpdateOperationsInput | string;
    pull_request_id?: NullableIntFieldUpdateOperationsInput | number | null;
    repo_full_name?: StringFieldUpdateOperationsInput | string;
    pr_number?: IntFieldUpdateOperationsInput | number;
    pr_title?: StringFieldUpdateOperationsInput | string;
    status?: StringFieldUpdateOperationsInput | string;
    not_before?: DateTimeFieldUpdateOperationsInput | Date | string;
    attempts?: IntFieldUpdateOperationsInput | number;
    source_comment_url?: StringFieldUpdateOperationsInput | string;
    source_comment_id?: IntFieldUpdateOperationsInput | number;
    trigger_source?: StringFieldUpdateOperationsInput | string;
    retrigger_comment_url?: NullableStringFieldUpdateOperationsInput | string | null;
    retriggered_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    failed_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    reviewed_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type ReviewQueueCreateManyPullRequestInput = {
    id?: number;
    uuid?: string;
    repo_full_name: string;
    pr_number: number;
    pr_title: string;
    status?: string;
    not_before: Date | string;
    attempts?: number;
    source_comment_url: string;
    source_comment_id: number;
    trigger_source?: string;
    retrigger_comment_url?: string | null;
    retriggered_at?: Date | string | null;
    failed_at?: Date | string | null;
    reviewed_at?: Date | string | null;
    created_at?: Date | string;
    updated_at?: Date | string;
  };

  export type EventCreateManyPullRequestInput = {
    id?: number;
    uuid?: string;
    ts?: Date | string;
    type: string;
    repo_full_name: string;
    pr_number: number;
    correlation_id: string;
    request_id?: string | null;
    version: string;
    payload: string;
    metadata?: string | null;
  };

  export type ReviewQueueUpdateWithoutPullRequestInput = {
    uuid?: StringFieldUpdateOperationsInput | string;
    repo_full_name?: StringFieldUpdateOperationsInput | string;
    pr_number?: IntFieldUpdateOperationsInput | number;
    pr_title?: StringFieldUpdateOperationsInput | string;
    status?: StringFieldUpdateOperationsInput | string;
    not_before?: DateTimeFieldUpdateOperationsInput | Date | string;
    attempts?: IntFieldUpdateOperationsInput | number;
    source_comment_url?: StringFieldUpdateOperationsInput | string;
    source_comment_id?: IntFieldUpdateOperationsInput | number;
    trigger_source?: StringFieldUpdateOperationsInput | string;
    retrigger_comment_url?: NullableStringFieldUpdateOperationsInput | string | null;
    retriggered_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    failed_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    reviewed_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string;
    queueOrder?: QueueOrderUpdateOneWithoutQueueItemNestedInput;
  };

  export type ReviewQueueUncheckedUpdateWithoutPullRequestInput = {
    id?: IntFieldUpdateOperationsInput | number;
    uuid?: StringFieldUpdateOperationsInput | string;
    repo_full_name?: StringFieldUpdateOperationsInput | string;
    pr_number?: IntFieldUpdateOperationsInput | number;
    pr_title?: StringFieldUpdateOperationsInput | string;
    status?: StringFieldUpdateOperationsInput | string;
    not_before?: DateTimeFieldUpdateOperationsInput | Date | string;
    attempts?: IntFieldUpdateOperationsInput | number;
    source_comment_url?: StringFieldUpdateOperationsInput | string;
    source_comment_id?: IntFieldUpdateOperationsInput | number;
    trigger_source?: StringFieldUpdateOperationsInput | string;
    retrigger_comment_url?: NullableStringFieldUpdateOperationsInput | string | null;
    retriggered_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    failed_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    reviewed_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string;
    queueOrder?: QueueOrderUncheckedUpdateOneWithoutQueueItemNestedInput;
  };

  export type ReviewQueueUncheckedUpdateManyWithoutPullRequestInput = {
    id?: IntFieldUpdateOperationsInput | number;
    uuid?: StringFieldUpdateOperationsInput | string;
    repo_full_name?: StringFieldUpdateOperationsInput | string;
    pr_number?: IntFieldUpdateOperationsInput | number;
    pr_title?: StringFieldUpdateOperationsInput | string;
    status?: StringFieldUpdateOperationsInput | string;
    not_before?: DateTimeFieldUpdateOperationsInput | Date | string;
    attempts?: IntFieldUpdateOperationsInput | number;
    source_comment_url?: StringFieldUpdateOperationsInput | string;
    source_comment_id?: IntFieldUpdateOperationsInput | number;
    trigger_source?: StringFieldUpdateOperationsInput | string;
    retrigger_comment_url?: NullableStringFieldUpdateOperationsInput | string | null;
    retriggered_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    failed_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    reviewed_at?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    created_at?: DateTimeFieldUpdateOperationsInput | Date | string;
    updated_at?: DateTimeFieldUpdateOperationsInput | Date | string;
  };

  export type EventUpdateWithoutPullRequestInput = {
    uuid?: StringFieldUpdateOperationsInput | string;
    ts?: DateTimeFieldUpdateOperationsInput | Date | string;
    type?: StringFieldUpdateOperationsInput | string;
    repo_full_name?: StringFieldUpdateOperationsInput | string;
    pr_number?: IntFieldUpdateOperationsInput | number;
    correlation_id?: StringFieldUpdateOperationsInput | string;
    request_id?: NullableStringFieldUpdateOperationsInput | string | null;
    version?: StringFieldUpdateOperationsInput | string;
    payload?: StringFieldUpdateOperationsInput | string;
    metadata?: NullableStringFieldUpdateOperationsInput | string | null;
  };

  export type EventUncheckedUpdateWithoutPullRequestInput = {
    id?: IntFieldUpdateOperationsInput | number;
    uuid?: StringFieldUpdateOperationsInput | string;
    ts?: DateTimeFieldUpdateOperationsInput | Date | string;
    type?: StringFieldUpdateOperationsInput | string;
    repo_full_name?: StringFieldUpdateOperationsInput | string;
    pr_number?: IntFieldUpdateOperationsInput | number;
    correlation_id?: StringFieldUpdateOperationsInput | string;
    request_id?: NullableStringFieldUpdateOperationsInput | string | null;
    version?: StringFieldUpdateOperationsInput | string;
    payload?: StringFieldUpdateOperationsInput | string;
    metadata?: NullableStringFieldUpdateOperationsInput | string | null;
  };

  export type EventUncheckedUpdateManyWithoutPullRequestInput = {
    id?: IntFieldUpdateOperationsInput | number;
    uuid?: StringFieldUpdateOperationsInput | string;
    ts?: DateTimeFieldUpdateOperationsInput | Date | string;
    type?: StringFieldUpdateOperationsInput | string;
    repo_full_name?: StringFieldUpdateOperationsInput | string;
    pr_number?: IntFieldUpdateOperationsInput | number;
    correlation_id?: StringFieldUpdateOperationsInput | string;
    request_id?: NullableStringFieldUpdateOperationsInput | string | null;
    version?: StringFieldUpdateOperationsInput | string;
    payload?: StringFieldUpdateOperationsInput | string;
    metadata?: NullableStringFieldUpdateOperationsInput | string | null;
  };

  /**
   * Batch Payload for updateMany & deleteMany & createMany
   */

  export type BatchPayload = {
    count: number;
  };

  /**
   * DMMF
   */
  export const dmmf: runtime.BaseDMMF;
}
