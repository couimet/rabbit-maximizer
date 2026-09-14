# @couimet/execution-context

Incubation of the `withAttributes` addition to the published `@couimet/execution-context`.

This folder is not a copy of the package. It holds only the method the published version does not
have yet, layered on top of it, plus the tests for that method. The app imports it directly. The day
the method ships in the published package this folder is deleted and the call site moves back to
`@couimet/execution-context`, which is why nothing else here re-exports the package's own primitives.
