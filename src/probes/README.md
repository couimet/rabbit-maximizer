# Probes

Domain probes keep business logic readable by pulling observability and audit concerns out of the code that triggers them. Instead of a caller poking at a logger, a metrics client, and the database itself, it calls a probe whose methods are named for what happened in the domain, and the probe handles the rest. This is Martin Fowler's domain-oriented observability pattern (linked below); the implementation here is our own.

## What a probe represents

A probe is one business action worth recording, like detecting a rate-limited PR or marking a queue item completed. It is created before work begins, then driven through domain-named lifecycle methods at each branch:

```typescript
const probe = this.probeFactory.createMarkQueueItemCompletedProbe(uuid);

const row = await findRow(uuid);
if (!row) {
  probe.queueItemNotFound();
  return undefined;
}

const updated = await markCompleted(row);
await probe.queueItemMarkedCompleted(updated, tx);
```

The caller describes what happened (`queueItemNotFound`, `queueItemMarkedCompleted`). The probe owns how to record it (event table writes, logging, future metrics). Callers never touch the events table, the logger, or a future metrics client themselves.

Every probe method is named for what happened in the domain. The method set forms the probe's lifecycle — there is no fixed `processStarted`/`processCompleted` contract. Each probe exposes the vocabulary its business process needs.

## What it means in this project

### Single-entity callers

Each repository should deal with exactly one entity. `QueueRepositoryImpl` only touches `reviewQueue` rows. Cross-entity concerns (event recording, observation context) live in probes.

### Construction and wiring

`ProbeFactory` is the single entry point. It injects the repositories and providers each probe needs, so callers never assemble probes by hand. The factory owns the `ObservationContextProvider`; callers don't extract the current context themselves.

### Naming

Probe class names include the entity: `MarkQueueItemCompletedProbe`, `QueueItemProbe`. Method names use domain vocabulary: `queueItemNotFound()`, `queueItemMarkedCompleted()`, `processRetriggered()`, `processStarted()`, `processCompleted()`. A developer reading the caller should understand the business process without opening the probe.

## Failure handling

What a probe does when something goes wrong depends on what it records:

- Event-recording probes write to the audit log inside the caller's transaction. A failed write fails the whole operation; the state change and the event describing it must agree.
- Observational-only probes, like a future metrics emitter, should swallow their own errors. Losing a metric must never break a business flow.

## Reference

- [Domain-Oriented Observability (Martin Fowler)](https://martinfowler.com/articles/domain-oriented-observability.html)
