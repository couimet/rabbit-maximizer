# Probes

Domain probes keep business logic readable by pulling observability and audit concerns out of the code that triggers them. Instead of a caller poking at a logger, a metrics client, and the database itself, it calls a probe whose methods are named for what happened in the domain, and the probe handles the rest. This is Martin Fowler's domain-oriented observability pattern (linked below); the implementation here is our own.

## What a probe represents

A probe is one business action worth recording, like detecting a rate-limited PR. It exposes a short lifecycle:

- `processStarted()` records that the action was attempted.
- `processCompleted(tx?)` records the outcome.

It carries what the action needs (the domain inputs, plus the ambient correlation id, request id, and app version from the observation-context provider) and hands the write off to a single-table repository such as `EventRepository`. Callers never touch the events table, the logger, or a future metrics client themselves.

## Construction and wiring

`ProbeFactory` is the one place that builds probes, injecting the repository and logger each one needs. A caller asks the factory for a probe, drives its lifecycle, and stays out of the persistence and logging mechanics.

## Failure handling

What a probe does when something goes wrong depends on what it records:

- Event-recording probes like `DetectedProbe` write to the audit log inside the caller's transaction, so a failed write fails the whole operation. A state change and the event describing it have to agree.
- Observational-only probes, like a future metrics emitter, should swallow their own errors. Losing a metric should never break a business flow.

## Reference

- [Domain-Oriented Observability (Martin Fowler)](https://martinfowler.com/articles/domain-oriented-observability.html)
