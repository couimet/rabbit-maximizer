# Queue Status

State diagram and resolution reasons for the `QueueStatus` values. For authoritative behavior, read the source: [`QueueStatus`](../src/QueueStatus.ts), [`Resolution`](../src/Resolution.ts), [`queueRepository.enqueue()`](../src/db/queueRepository.ts), [`queueOrderRepository`](../src/db/queueOrderRepository.ts).

```mermaid
stateDiagram-v2
    [*] --> pending: rate-limit or skip comment detected
    pending --> retriggered: scheduler or dashboard posts retrigger
    pending --> resolved: PR unavailable (404/410), max attempts
    retriggered --> resolved: review completed, PR merged/closed, max attempts, or stale
    pending --> resolved: CodeRabbit refuses permanently
    retriggered --> resolved: CodeRabbit refuses permanently
    resolved --> pending: operator re-queues a refused item
    resolved --> [*]: every other resolution
```

Resolution reasons:

- `review_completed` — CodeRabbit completed a review after the request.
- `manual_review` — a human marked the item reviewed from the dashboard.
- `pr_merged` / `pr_closed_without_merge` — the PR left the open state.
- `failed` — max trigger attempts reached, terminal HTTP failure, or the retriggered item went stale.
- `skipped` — CodeRabbit re-skipped the review after the request.
- `stale_comment` — the source comment is gone and no replacement exists.
- `permanently_refused` — CodeRabbit refused the review for a cause only an organization administrator can clear, such as a missing review seat. The item never reopens on its own, and the PR leaves the recovery path until an operator re-queues it.

`permanently_refused` is not reopenable. An operator returns the item to `pending` through the dashboard re-queue action after clearing the refusal cause; the item gets a fresh attempt budget and rejoins the queue order.

`EFFECTIVE_ORDER_STATUSES` includes both `pending` and `retriggered` — both appear in Queue Order. When a new rate-limit comment arrives on a `retriggered` item, the source comment is updated in place; no new item is created. When the same comment is re-edited with a new CodeRabbit Run ID, the item's run tracking is updated in place and the retrigger clock restarts; no new item is created and no new retrigger comment is posted.
