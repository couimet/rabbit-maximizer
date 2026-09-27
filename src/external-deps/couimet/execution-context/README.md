# @couimet/execution-context

Incubation of the validated-attribute additions to the published `@couimet/execution-context`.

This folder is not a copy of the package. It holds only what the published version does not have yet,
layered on top of it, plus the tests for it. The app imports it directly. The day the additions ship
in the published package this folder is deleted and the call sites move back to
`@couimet/execution-context`, which is why nothing else here re-exports the package's own primitives.

## Contents

`attributes.ts` holds the declaration types. One declaration per attribute carries the key it writes
under and an optional rule that decides which values may enter. `isValid` is a type predicate, so a
declaration that carries a rule also carries the type of its value, and a declaration that omits the
rule accepts every value.

The file also holds the two error codes the validated write and the validated read throw. They are
local constants because TypeScript cannot add a member to an enum a dependency declares. Each one
carries the string it will carry upstream, so adoption changes the import and leaves the assertions
alone.

`getAttribute.ts` reads one attribute and throws when no writer set it. A declaration that carries a
rule verifies the value; a raw key runs no rule and returns `unknown`.

`withAttributes.ts` layers a bag over the active context for the duration of a callback. It checks
the shape of the bag, not the values in it.

`validateAttributes.ts` builds that bag. It takes the registry and the entries keyed by declaration
name, verifies every value against its own rule, and throws before any value is written. A caller
that writes declared attributes calls it and passes the result to `withAttributes`, so validation
stays a separate step from layering.

## Registry ownership

The registry and the predicate stay with the consumer. The package must not name `run_id` or
`version`, so this folder ships the mechanism and the application ships its own vocabulary.
