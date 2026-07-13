# Probes

Domain probes keep business logic readable by pulling observability and audit concerns out of the code that triggers them. Instead of a caller poking at a logger, a metrics client, and the database itself, it calls a probe whose methods are named for what happened in the domain, and the probe handles the rest. This is Martin Fowler's domain-oriented observability pattern (linked below); the implementation here is our own.

## What a probe represents

A probe is one business action worth recording, like detecting a rate-limited PR or marking a queue item completed. It is created before work begins, then driven through domain-named lifecycle methods at each branch:

```typescript
const probe = this.probeFactory.createMarkQueueItemReviewedProbe(uuid);

const row = await findRow(uuid);
if (!row) {
  probe.queueItemNotFound();
  return undefined;
}

const updated = await markReviewed(row);
await probe.queueItemMarkedReviewed(updated, tx);
```

The caller describes what happened (`queueItemNotFound`, `queueItemMarkedReviewed`). The probe owns how to record it (event table writes, logging, future metrics). Callers never touch the events table, the logger, or a future metrics client themselves.

Every probe method is named for what happened in the domain. The method set forms the probe's lifecycle — there is no fixed `processStarted`/`processCompleted` contract. Each probe exposes the vocabulary its business process needs.

## What it means in this project

### One probe per business process

A business process (a scheduler tick, an enqueue, a completion detection) creates exactly one probe at the top, then drives it through domain-named lifecycle methods. If you find yourself creating two probes for the same process, the probe boundaries are wrong — merge them. The probe represents the process; its methods represent the outcomes.

A probe MUST NOT be reused across business processes. Each probe is tied to exactly one process. If two processes happen to record similar events, they still get separate probes — the probe name documents which process produced the event.

### Single-entity callers

Each repository should deal with exactly one entity. `QueueRepositoryImpl` only touches `reviewQueue` rows. Cross-entity concerns (event recording, observation context) live in probes.

### Construction and wiring

`ProbeFactory` is the single entry point. It injects the repositories and providers each probe needs, so callers never assemble probes by hand. The factory owns the `ObservationContextProvider`; callers never extract the current context themselves and generally never pass an `ObservationContext` to a factory method. With one exception: `createDetectedProbe` accepts `ObservationContext` when the same instance must be shared with `queue.enqueue()` (see C011). For all other probes, callers pass only their domain object (a `QueueItem`, a `uuid`) to the factory.

### What belongs in a probe

A probe owns ALL observability for its business process. That includes:

- **Event recording** — every call to `EventRepository.record()` lives in a probe method, never in a caller.
- **Business outcome logging** — every log statement that describes what happened in the domain (success, failure, backoff, not-found) lives in the probe. The caller does not duplicate these logs. This holds even when a branch records no event (e.g. a transient failure with backoff) — the log describing that outcome still belongs in the probe.

A probe never mutates the entity it observes. It records what happened and logs the outcome; the caller is responsible for changing state.

### What stays in the caller

- **Operational decisions** — pruning, pausing, skipping. These describe the caller's control flow, not a business outcome.
- **Entity mutations** — all of them. The caller owns state changes (`queue.markRetriggered`, `queue.markFailed`, `queue.markCompleted`). The probe records what happened and logs the outcome; it never touches the entity. `QueueRepositoryImpl.markReviewedByUuid` shows the pattern: update the row, then tell the probe.
- **Control flow** — if/switch/try-catch branches. The probe receives the outcome of each branch; it does not decide which branch to take.

### Naming

Probe class names name the process: `SchedulerProbe`, `MarkQueueItemReviewedProbe`, `CompletionProbe`, `EnqueueProbe`. Method names are past-tense domain verbs that describe what happened: `retriggered()`, `failed()`, `backedOff()`, `queueItemNotFound()`, `queueItemMarkedReviewed()`. Never prefix method names with `record` — the caller describes the outcome, not the mechanism. A developer reading the caller should understand the business process without opening the probe.

## Failure handling

What a probe does when something goes wrong depends on what it records:

- Event-recording probes write to the audit log inside the caller's transaction. A failed write fails the whole operation; the state change and the event describing it must agree.
- Observational-only probes, like a future metrics emitter, should swallow their own errors. Losing a metric must never break a business flow.

## Reference

- [Domain-Oriented Observability (Martin Fowler)](https://martinfowler.com/articles/domain-oriented-observability.html)
