# Business Rules

Rabbit Maximizer finds PRs where CodeRabbit's review was rate-limited or skipped, waits out CodeRabbit's cooldowns, and re-requests the full review. This document states the product's business rules in pure domain terms. Status vocabulary follows [Queue Status](queue-status.md). For authoritative behavior, read the source files referenced at the top of each section.

## Table of Contents

1. [Queue lifecycle](#br-1)
2. [Detection](#2-detection)
3. [Enqueue](#3-enqueue)
4. [Scheduler selection and skip reasons](#4-scheduler-selection-and-skip-reasons)
5. [Trigger paths](#5-trigger-paths)
6. [Review detector and edit detection](#6-review-detector-and-edit-detection)
7. [Queue order and dashboard retrigger](#7-queue-order-and-dashboard-retrigger)
8. [Pruning](#br-8)
9. [System state, pause, and account guard](#9-system-state-pause-and-account-guard)
10. [Fewer-than-10-stars behavior](#10-fewer-than-10-stars-behavior)
11. [Configuration reference](#br-11)
12. [Invariants](#br-12)

<a id="br-1"></a>

## 1. Queue lifecycle

Source: [`QueueStatus`](../src/QueueStatus.ts), [`Resolution`](../src/Resolution.ts), [`queueRepository`](../src/db/queueRepository.ts).

An item is created when a CodeRabbit rate-limit or skip comment is detected. The status vocabulary, state diagram, and resolution reasons live in [Queue Status](queue-status.md), the source of truth for the lifecycle.

Only `pending` and `retriggered` items are active: they appear in the queue order and are subject to scheduling, review detection, and pruning. `resolved` items are terminal.

## 2. Detection

Sources: [`detectorPoll`](../src/detectorPoll.ts), [`prScanner`](../src/prScanner.ts), [`DirectCommentChecker`](../src/DirectCommentChecker.ts), [`coderabbitGitHubClient`](../src/github/coderabbitGitHubClient.ts), [`classifyCoderabbitComment`](../src/github/classifyCoderabbitComment.ts), [`coderabbitConstants`](../src/github/coderabbitConstants.ts).

Detection runs on a fixed poll interval (`POLL_INTERVAL_SEC`). Each tick walks: PR scan, stale-PR recovery, direct comment check, comment search, acknowledgement polling, then records the earliest next review availability.

<a id="br-2-1"></a>

### PR tracking

- The scanner runs at most once per `PR_SCANNER_INTERVAL_SEC` since the last completed scan.
- It searches GitHub for open PRs matching `REPO_FILTER` (`owner/*` resolves to every accessible repo of the owner; `owner/repo` to a single repo) and registers each PR with its title, author, and head sha.
- The head commit time is fetched only when the head sha changed since the last scan — one commit fetch per push.
- PRs previously registered as open that no longer appear in the search are re-checked individually and marked merged or closed.

<a id="br-2-2"></a>

### Comment discovery

Two complementary paths feed the same detection handler:

- **Search path** — GitHub search over the monitored repos for open PRs whose comments mention the rate-limit phrases CodeRabbit uses in its comments ("review limit" or "rate limit") or the on-request skip phrase ("review available"). The full body of every hit is fetched before classification, because the search index returns truncated bodies. The freshness latch (below) suppresses already-seen comments before they reach the detection handler.
- **Direct check path** — for every PR known to the scanner plus recovered PRs, list the PR's comments directly and consider only comments authored by the CodeRabbit bot. This bypasses search-index delay. The number of directly checked PRs per tick is capped (125); beyond the cap, coverage falls back to the search path.

<a id="br-2-3"></a>

### Comment classification

CodeRabbit's comment bodies carry hidden markers that drive classification, in this precedence order:

1. Skip marker → `review_skipped` — CodeRabbit refused the review permanently.
2. Completion signals → `review_approved` (no-actionable-comments signal) or `review_changes_suggested` (actionable-comments signal) — a verdict was rendered.
3. Rate-limit marker → `review_limited` — CodeRabbit refused due to its review quota, usually stating a wait time ("Please wait X minutes and Y seconds before requesting another review").
4. None of the above → `unknown`.

Classification outcome at detection:

| Comment classification                           | Detection outcome                                              |
| ------------------------------------------------ | -------------------------------------------------------------- |
| `review_limited`                                 | Forwarded; contributes to the earliest-next-review computation |
| `review_limited` with the maximizer's own marker | Skipped — never self-retrigger                                 |
| `review_skipped`                                 | Forwarded                                                      |
| `review_approved` / `review_changes_suggested`   | Forwarded (handled as a verdict at enqueue)                    |
| `unknown`                                        | Skipped — never acted on                                       |

<a id="br-2-4"></a>

### Freshness latch

Every comment the maximizer processes — detection, dismissal, and edit detection alike — latches a last-seen marker. A comment whose update time is no newer than the last-seen marker is treated as already seen and is not processed again. The latch is what stops both the direct check and the search path from re-detecting a comment on every tick.

<a id="br-2-5"></a>

### Run ID observation

CodeRabbit stamps each comment with a Run ID that changes on every run. The maximizer records the Run ID with each detection and observes first-seen, changed, and cleared transitions as evidence. Run ID observation is diagnosis only — it never overrides the update-time freshness decision.

<a id="br-2-6"></a>

### Additional poll duties

- Comments on PRs the scanner has not yet registered are ignored until the scanner registers the PR.
- After the maximizer posts a request, the poll loop watches for CodeRabbit's acknowledgement reply and records it when found.
- From every detected rate-limit comment, the earliest next review availability is computed as comment update time plus the stated wait (`REVIEW_LIMIT_FALLBACK_WAIT_SEC` when no wait is stated). The recorded availability only ever moves later, never earlier.
- When GitHub's API quota is exhausted (403/429 with zero quota remaining), the poll loop suppresses all ticks until the quota reset time.

## 3. Enqueue

Sources: [`EnqueueService`](../src/EnqueueService.ts), [`queueRepository`](../src/db/queueRepository.ts).

Every detected comment flows through one handler that decides, in order: dismissal, classification branch, then enqueue.

<a id="br-3-1"></a>

### Already-reviewed dismissal

A completed review only dismisses comments from runs it already saw. CodeRabbit edits its comment in place per push, so an edit newer than the recorded verdict is a new run and must flow through the normal branches. When a completed review is already recorded for the PR and the comment's update time is not newer than that recorded review's update time, the comment is dismissed as already reviewed. The dismissal still advances the freshness latch, or the direct check would re-detect the comment on every scan.

<a id="br-3-2"></a>

### Classification branches

| Comment classification                         | Enqueue behavior                                                                                                                        |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `review_limited`                               | Enqueue with a per-item cooldown: the comment's update time plus its stated wait (`REVIEW_LIMIT_FALLBACK_WAIT_SEC` when none is stated) |
| `review_skipped`                               | Enqueue with no cooldown — the skip is a permanent refusal, and a full-review request is the only path to a review                      |
| `review_approved` / `review_changes_suggested` | Never enqueue — record the completed review (verdict, comment, and head sha at review time)                                             |
| `unknown`                                      | Never reaches this point (filtered at detection)                                                                                        |

<a id="br-3-3"></a>

### Deduplication

The enqueue decision depends on the existing item for the same PR and source comment:

| Existing item | Condition                                                                                                        | Outcome                                                                                                                                                                 |
| ------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `retriggered` | Same source comment, same run ID                                                                                 | No-op — already retriggered                                                                                                                                             |
| `retriggered` | Same source comment, incoming run ID absent                                                                      | No-op — stored run ID preserved                                                                                                                                         |
| `retriggered` | Same source comment, incoming run ID known and differing from (or absent in) the stored run ID                   | Adopt in place — update `source_comment_run_id` and refresh `retriggered_at`; the in-flight run fulfills the outstanding trigger; no new item, no new retrigger comment |
| `retriggered` | Different source comment                                                                                         | Recycle — the item adopts the new source comment (and its run ID) in place; no new item is created                                                                      |
| `resolved`    | Same source comment, resolved within the last 5 minutes                                                          | No-op — recently-resolved loop guard                                                                                                                                    |
| `resolved`    | Same source comment, still inside the cooldown window                                                            | No-op                                                                                                                                                                   |
| `resolved`    | Reopenable resolution (`review_completed`, `failed`, `skipped`) and the comment was updated after the resolution | Reopen as `pending`; attempts and skip bookkeeping reset; the item keeps or rejoins the queue order                                                                     |
| `resolved`    | Comment not updated since the resolution                                                                         | No-op                                                                                                                                                                   |
| `pending`     | Any (creation conflict)                                                                                          | No-op — already queued                                                                                                                                                  |
| None          | —                                                                                                                | Create a `pending` item and append it to the end of the queue order                                                                                                     |

New items join the queue order at the end (behind every positioned item, in creation order).

## 4. Scheduler selection and skip reasons

Sources: [`scheduler`](../src/scheduler.ts), [`computeSchedulerBackoff`](../src/utils/computeSchedulerBackoff.ts), [`queueRepository`](../src/db/queueRepository.ts), [`systemStateRepository`](../src/db/systemStateRepository.ts).

The scheduler runs on `SCHEDULER_TICK_INTERVAL_SEC` and triggers at most one item per tick. Each tick applies the gates in order:

1. Prune terminal PRs.
2. Resolve stale retriggered items — any item still `retriggered` after `SCHEDULER_MAX_RETRIGGER_AGE_SEC` resolves as `failed`.
3. Pause — while the scheduler is paused, the tick stops before any selection or trigger.
4. Awaiting-acknowledgement hold — while the oldest outstanding request is younger than `SCHEDULER_RETRIGGER_SPACING_SEC`, the tick stops. This is the global spacing rule: no new request while a prior request may still be being processed.
5. Account cooldown — while the recorded next-review-available time is in the future, the tick stops.
6. Select and trigger one item.

<a id="br-4-1"></a>

### Per-candidate selection

Candidates come from the effective order (pending and retriggered), restricted to `pending`, in queue order. For each candidate in order:

| Candidate condition                                     | Action                                                 |
| ------------------------------------------------------- | ------------------------------------------------------ |
| Per-item cooldown still running                         | Skip (`cooldown`); the skip is recorded with a counter |
| Created less than `SCHEDULER_RETRIGGER_SPACING_SEC` ago | Skip (`settling`); the skip is recorded with a counter |
| PR merged                                               | Resolve `pr_merged`                                    |
| PR closed without merge                                 | Resolve `pr_closed_without_merge`                      |
| Otherwise                                               | Select and trigger                                     |

A skip is only recorded if the item is still `pending` — a concurrently resolved item is not re-skipped.

<a id="br-4-2"></a>

### Attempts and backoff

- Attempts increment on every trigger outcome, success and failure alike, so the item always reaches the cap.
- When attempts reach `MAX_RETRIGGER_ATTEMPTS` the item resolves as `failed` — including when every trigger succeeded, capping total retriggers to prevent indefinite loops.
- On failure: `RETRIGGER_ITEM_NOT_PENDING` races are skipped; a rescheduled item is moved to its replacement source comment; a stale-comment skip resolves as `stale_comment`; terminal HTTP (404/410) resolves as `failed`; anything else backs off — the item parks as `retriggered` with an incremented attempt count and is left to the review detector or the stale-retriggered timeout, never re-selected by the scheduler.
- The backoff schedule is exponential: base times 2 to the attempt power, capped at the maximum (`SCHEDULER_RETRY_BACKOFF_BASE_SEC`, `SCHEDULER_RETRY_BACKOFF_MAX_SEC`).

The last scheduler tick time is recorded after every tick; the dashboard uses it to flag a stale scheduler.

## 5. Trigger paths

Sources: [`ReviewTrigger`](../src/ReviewTrigger.ts), [`StalePrRecoverer`](../src/StalePrRecoverer.ts), [`coderabbitGitHubClient`](../src/github/coderabbitGitHubClient.ts), [`buildCommentBody`](../src/github/buildCommentBody.ts).

Only `pending` items can be triggered. Both the scheduler and the dashboard call the same trigger; they differ only in the trigger source recorded on the posted comment (scheduler triggers include a diagnosis line; dashboard triggers do not).

<a id="br-5-1"></a>

### The posted request

The trigger posts one comment containing the full-review command (`@coderabbitai full review`) plus metadata: a generated run id, the trigger source, and — for scheduler triggers — the diagnosis (source comment state, stated wait). It is posted as a reply to the source comment when one exists and is still actionable, or with no reply target when the source comment is gone.

<a id="br-5-2"></a>

### Source comment decision

The trigger first refetches the source comment that caused the enqueue:

| Source comment state                                                  | Action                                                                 |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Still a rate-limit comment (no own marker)                            | Post the retrigger replying to it                                      |
| Now classified `review_skipped`                                       | Post the retrigger replying to it — skip becomes a full-review request |
| Gone (404/410) and no newer rate-limit comment on the PR              | Post the retrigger with no reply target                                |
| Gone (404/410) and a newer rate-limit comment exists                  | Reschedule the item onto the newer comment                             |
| Replaced by a newer rate-limit comment                                | Reschedule the item onto the replacement                               |
| No longer a rate-limit comment and no newer rate-limit comment exists | Resolve `stale_comment` — nothing left to request against              |
| Replacement comment deleted between listing and fetch                 | Backoff and retry later                                                |

<a id="br-5-3"></a>

### Cooldown after posting

Every posted request starts an account cooldown of `CODERABBIT_ACCOUNT_COOLDOWN_SEC`: the next-review-available time is set to the later of its current value and now plus the cooldown. The PR's request count and last-request time are updated.

<a id="br-5-4"></a>

### Rescheduling onto a replacement comment

When the source comment was replaced, the item adopts the replacement's comment id and URL, its attempt count increments, and the next-review-available time extends to the replacement's update time plus its stated wait (`REVIEW_LIMIT_FALLBACK_WAIT_SEC` when none) plus `REVIEW_LIMIT_BUFFER_SEC`.

<a id="br-5-5"></a>

### Recovery from a deleted comment

PRs that had a request posted but never received a review or acknowledgement, have no active item, and were not resolved in the last 5 minutes are recovered: a synthetic rate-limit comment is fed through detection, so the PR re-enters the queue and receives a retrigger with no reply target. This restores PRs whose rate-limit comment was deleted.

## 6. Review detector and edit detection

Sources: [`ReviewDetector`](../src/ReviewDetector.ts), [`EditDetector`](../src/EditDetector.ts), [`coderabbitGitHubClient`](../src/github/coderabbitGitHubClient.ts).

The review detector watches `retriggered` items on `POLL_INTERVAL_SEC` and resolves them when CodeRabbit completes its review. An item whose PR is already merged or closed resolves immediately.

<a id="br-6-1"></a>

### Edit detection

CodeRabbit edits its comment in place per run. The detector refetches the source comment and acts only when the fresh update time is newer than the last sighting:

| Fresh comment classification                                      | Action                                                                                                   |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Verdict (`review_approved` / `review_changes_suggested`)          | Resolve `review_completed`; record the review (comment, verdict, head sha at review time)                |
| `review_skipped` with an unchanged run                            | Resolve `skipped`                                                                                        |
| `review_skipped` with a new run                                   | Adopt the run in place (update `source_comment_run_id`, restart the retrigger clock); stay `retriggered` |
| Still a rate-limit comment, or not edited since the last sighting | No resolution — fall through to the reviews-API fallback                                                 |

<a id="br-6-2"></a>

### Reviews-API fallback

When edit detection cannot resolve the item, the detector looks back `REVIEW_DETECTION_LOOKBACK_SEC` from the retrigger time and consults the GitHub reviews API for a completed review by the CodeRabbit bot. The API returns reviews oldest-first, so the detector scans every page and keeps the newest accepted review. A review is accepted in tier order:

1. Its body Run ID equals the item's adopted run (`source_comment_run_id`) — the review from the run this trigger was posted for.
2. When no run is known, its commit matches the PR head (`head_sha`, refreshed by the scanner every `PR_SCANNER_INTERVAL_SEC` — the DB head can lag a push by up to that window).
3. When neither a run nor a head is known (legacy rows), any completed review is accepted.

Tier 1 is exclusive: when a run is known, a review from any other run is rejected even if its commit matches — an earlier run's review was generated against an older push. The `last_coderabbit_review_at` fallback (a recorded review inside the same window also resolves the item as `review_completed`) applies only when no run is known; a known run that produced nothing must stay `retriggered` so the stale-retriggered sweep can fail it after `SCHEDULER_MAX_RETRIGGER_AGE_SEC`. If nothing matches, the item stays `retriggered` and is checked again on a later tick.

<a id="br-6-3"></a>

### Startup and recovery after downtime

The app survives downtime of minutes to days by converging through the existing sequential boot (detection and review-limit polling → review evaluation → scheduler sweep, each awaited with an immediate first tick; see `main.ts`):

- A comment re-edited during downtime carries a new CodeRabbit run ID. The first detection tick re-detects it (its freshness latch has not seen the edit) and the enqueue adoption rule above rewrites the still-`retriggered` item's run tracking in place, restarting the retrigger clock.
- The first review tick then evaluates the item run-aware: only a review from the adopted run (or, legacy, the current head) resolves it. A review from a run started before the trigger was posted can no longer resolve the item.
- The scheduler's stale-retriggered sweep resolves as `failed` only items whose adopted run genuinely produced nothing after `SCHEDULER_MAX_RETRIGGER_AGE_SEC`.

No dedicated reconciliation process exists by design. The same decision logic covers boot after downtime and steady-state operation. Writers that can race the review detector are guarded: the detector resolves only via `markResolvedIfStillRetriggered` (a lost race logs `resolutionLostRace` and skips the resolution), and the scheduler's stale sweep already uses a status-guarded `updateMany`. The pruner's unguarded `markResolved` is deliberate — terminal PR states take precedence over `review_completed` (invariant 9), so its overwrite direction is safe.

## 7. Queue order and dashboard retrigger

Sources: [`queueOrderRepository`](../src/db/queueOrderRepository.ts), [`queueOrderRoutes`](../src/routes/queueOrderRoutes.ts).

<a id="br-7-1"></a>

### Effective order

The effective order contains exactly the `pending` and `retriggered` items, sorted by position and then by creation order. Resolved items never appear. New items append at the end. Positions are renumbered on every move.

<a id="br-7-2"></a>

### Moving items

- Items move by UUID, one position per call, toward the requested boundary (`up` or `down`); multiple items may move together, preserving their relative order; items at the edge do not move.
- Any non-resolved item (pending or retriggered) can be moved to the top; resolved items are rejected.
- Reordering never affects cooldowns — cooldowns are enforced at trigger time by the scheduler, not by position.

<a id="br-7-3"></a>

### Retrigger now

The dashboard can trigger a `pending` item immediately, outside the scheduler's selection:

| State            | Retrigger-now outcome                                                |
| ---------------- | -------------------------------------------------------------------- |
| `pending`        | Trigger posted; the posted request still starts the account cooldown |
| `retriggered`    | Rejected — in retrigger cooldown                                     |
| `resolved`       | Rejected                                                             |
| Scheduler paused | Rejected unless an explicit pause override is supplied               |

Retrigger-now bypasses the scheduler gates (spacing, acknowledgement hold, account cooldown) — it is a manual act — but the posted request sets the same account-cooldown gate as a scheduler trigger.

<a id="br-7-4"></a>

### Mark reviewed

The dashboard can resolve any item as `manual_review` — a human attests the review is complete.

<a id="br-8"></a>

## 8. Pruning

Sources: [`Pruner`](../src/Pruner.ts), [`PruneEvaluator`](../src/PruneEvaluator.ts).

Pruning runs at the start of every scheduler tick. It inspects the active items (pending and retriggered), fetches each PR's state in batches of five concurrent fetches, and resolves:

| PR state                   | Resolution                |
| -------------------------- | ------------------------- |
| Merged                     | `pr_merged`               |
| Closed without merge       | `pr_closed_without_merge` |
| Open, or state unfetchable | Kept — no action          |

Terminal resolutions remove the item from the effective order. Unfetchable state is treated as "still open" and rechecked on a later tick.

## 9. System state, pause, and account guard

Sources: [`systemStateRepository`](../src/db/systemStateRepository.ts), [`setPaused`](../src/routes/setPaused.ts), [`validateGitHubToken`](../src/validateGitHubToken.ts), [`parseGitHubRateLimitError`](../src/github/parseGitHubRateLimitError.ts), [`getDashboardState`](../src/routes/getDashboardState.ts).

<a id="br-9-1"></a>

### Pause

The scheduler can be paused and resumed via the API. While paused, the scheduler stops before any selection or trigger; the only posting that remains possible is the dashboard retrigger with an explicit pause override.

<a id="br-9-2"></a>

### Global availability gate

A single next-review-available time gates every scheduler tick. It is set by detection (only ever later) and by every posted request (now plus the account cooldown), and it naturally expires as time passes. The dashboard displays it only while it is in the future.

<a id="br-9-3"></a>

### Scheduler staleness

The last scheduler tick time is recorded after every tick. The dashboard flags the scheduler as stale when the heartbeat is older than `SCHEDULER_STALE_TICK_MULTIPLIER` times the tick interval. This is a display signal, not a control rule.

<a id="br-9-4"></a>

### Startup token validation

On startup the maximizer verifies the GitHub token authenticates and that the repo filter resolves to at least one accessible repository. Validation failure is advisory — the app still starts, and posting may fail until the token is fixed.

<a id="br-9-5"></a>

### Account guard (GitHub API quota)

When GitHub responds with a quota-exhausted status (403 or 429 with zero quota remaining), the poll loop stops all GitHub work until the quota reset time. This is the account guard that stops detection — and therefore posting — while the token is rate-limited.

<a id="br-9-6"></a>

### Dashboard surfaces

- Tracked PRs: open PRs never acknowledged by CodeRabbit and with no active item — the "awaiting acknowledgement" view. PRs CodeRabbit never touched appear too, sorted by last review time. When a walkthrough-summary comment (`review_stack_entry_start`) appears on such a PR, its comment time is recorded as `last_coderabbit_review_at` — evidence of the walkthrough without classifying it as a verdict.
- Skipped items: the most recent items the scheduler skipped for cooldown or settling.

## 10. Fewer-than-10-stars behavior

Sources: [`EnqueueService`](../src/EnqueueService.ts), [`DirectCommentChecker`](../src/DirectCommentChecker.ts), [`detectorPoll`](../src/detectorPoll.ts), [`extractCoderabbitRunId`](../src/utils/extractCoderabbitRunId.ts), [`schemas/lengths`](../src/schemas/lengths.ts), [`pullRequestRepository`](../src/db/pullRequestRepository.ts).

On repos with fewer than 10 stars, CodeRabbit posts a "Review available on request" comment instead of reviewing. The comment search path also searches the "review available" phrase, so the skip comment is discoverable even on PRs beyond the direct-check cap. The maximizer must turn that comment into a full-review request — without ever pressuring CodeRabbit while it is working.

Rabbit Maximizer never proactively requests a review on an observed push. It lets CodeRabbit detect the push, waits out CodeRabbit's processing, and acts only on the comment CodeRabbit adds or updates for the new head. It must never post a request while CodeRabbit is still processing a new push.

<a id="br-10-1"></a>

### The two holds

- **Acknowledgement hold** — after the maximizer's own request, CodeRabbit replies with an auto-generated acknowledgement ("auto-generated reply by CodeRabbit"). The poll loop watches for that reply and records it; until it is seen, the scheduler holds new requests until the request is older than `SCHEDULER_RETRIGGER_SPACING_SEC`. This covers the maximizer's own requests.
- **Push-processing hold (sha-based inference)** — a push produces no acknowledgement: CodeRabbit silently processes it, then adds or updates a comment. Push processing is therefore inferred from the head sha. The maximizer tracks the head sha, the head commit's time, and the sha at the last recorded review (`head_sha`, `head_committed_at`, `reviewed_head_sha`), and keeps an append-only history of every observed sha. A push is a head sha change; a push after a recorded review is `head_sha != reviewed_head_sha`. These signals are the evidence trail — the enforcement is the rule above: the maximizer never acts on a push, only on the comment CodeRabbit adds or updates for the new head.

<a id="br-10-2"></a>

### Act only on the comment

Every action in the system starts from a CodeRabbit comment for the current head. Comment bodies are the input contract: classification markers (rate limit, skip, completion signals) and the stated wait time are all read from the comment.

<a id="br-10-3"></a>

### The Run ID as the per-run evidence key

CodeRabbit stamps each comment with a Run ID that changes on every run. The maximizer records the Run ID with every detection and observes transitions (first seen, changed, cleared) as evidence of CodeRabbit runs. Run IDs are capped at 75 characters. The Run ID never drives the freshness decision — a run also bumps the comment's update time, and the update-time comparison is the decision input.

<a id="br-10-4"></a>

### Decision table: comment classification by run freshness

A comment is fresh when the maximizer has not seen it at or after its current update time, and when it is newer than the recorded review (if any). A comment is stale when the maximizer already processed it at or after its current update time.

| Classification             | Fresh run                                                | Stale (already seen)                             |
| -------------------------- | -------------------------------------------------------- | ------------------------------------------------ |
| `review_limited`           | Enqueue with per-item cooldown from the stated wait      | Ignored — latch and dedupe suppress reprocessing |
| `review_skipped`           | Enqueue with no cooldown — full-review request warranted | Ignored                                          |
| `review_approved`          | Record the completed review; never enqueue               | Ignored                                          |
| `review_changes_suggested` | Record the completed review; never enqueue               | Ignored                                          |
| `unknown`                  | Ignored — never acted on                                 | Ignored                                          |

A comment whose update time is not newer than the recorded review is dismissed as already reviewed — an older run's comment must not re-open work that a newer run already completed.

<a id="br-11"></a>

## 11. Configuration reference

All keys are environment variables. Defaults are stated; validation invariants follow.

| Key                                                                              | Meaning                                                                                                           | Default                           |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `REPO_FILTER`                                                                    | Repos to monitor: `owner/*` (all accessible repos of the owner) or `owner/repo` (single repo)                     | Required                          |
| `GITHUB_PAT`                                                                     | GitHub token for search, comment, and posting calls                                                               | Required                          |
| `POLL_INTERVAL_SEC`                                                              | Detection tick interval                                                                                           | 90                                |
| `PR_SCANNER_INTERVAL_SEC`                                                        | Minimum interval between PR scans                                                                                 | 300                               |
| `SCHEDULER_TICK_INTERVAL_SEC`                                                    | Scheduler tick interval                                                                                           | 10                                |
| `SCHEDULER_RETRIGGER_SPACING_SEC`                                                | Minimum spacing between review requests; also the settling wait for new items and the acknowledgement hold window | 180                               |
| `CODERABBIT_ACCOUNT_COOLDOWN_SEC`                                                | Account cooldown after each posted request                                                                        | 3600                              |
| `REVIEW_LIMIT_FALLBACK_WAIT_SEC`                                                 | Wait applied when a rate-limit comment states no wait                                                             | 3600                              |
| `REVIEW_LIMIT_BUFFER_SEC`                                                        | Extra wait added when rescheduling onto a replacement comment                                                     | 60                                |
| `MAX_RETRIGGER_ATTEMPTS`                                                         | Attempt cap per item; the item resolves as failed at the cap                                                      | 10                                |
| `SCHEDULER_MAX_RETRIGGER_AGE_SEC`                                                | Age at which a retriggered item resolves as failed                                                                | 259200                            |
| `SCHEDULER_RETRY_BACKOFF_BASE_SEC`                                               | Base of the exponential failure backoff                                                                           | 60                                |
| `SCHEDULER_RETRY_BACKOFF_MAX_SEC`                                                | Cap of the exponential failure backoff                                                                            | 3600                              |
| `REVIEW_DETECTION_LOOKBACK_SEC`                                                  | Lookback window for the reviews-API fallback                                                                      | 7200                              |
| `SCHEDULER_STALE_TICK_MULTIPLIER`                                                | Multiplier for the dashboard staleness signal                                                                     | 4                                 |
| `DETECTION_MODE`                                                                 | `poll` or `webhook`; the app runs the poll detector                                                               | `poll`                            |
| `WEBHOOK_SECRET`, `TUNNEL_URL`                                                   | Required when `DETECTION_MODE=webhook`                                                                            | Unset                             |
| `WEB_PORT`                                                                       | Dashboard API port                                                                                                | 3000                              |
| `GITHUB_API_TIMEOUT_SEC`                                                         | GitHub API call timeout                                                                                           | 10                                |
| `DATABASE_URL`                                                                   | Database location                                                                                                 | `file:./data/rabbit-maximizer.db` |
| `PAUSE_NOTIFICATION_INITIAL_DELAY_SEC`, `PAUSE_NOTIFICATION_REPEAT_INTERVAL_SEC` | Pause-notification timing (dashboard configuration)                                                               | 1800, 900                         |

Validation invariants: backoff max must be at least backoff base; retrigger spacing must be at least the poll interval and strictly less than the account cooldown; the review-detection lookback must be at most twice the account cooldown; webhook mode requires both the webhook secret and the tunnel URL.

<a id="br-12"></a>

## 12. Invariants

These rules must never be violated. Every change to the product must preserve them.

1. Rabbit Maximizer never proactively requests a review on an observed push. It lets CodeRabbit detect the push, waits out CodeRabbit's processing, and acts only on the comment CodeRabbit adds or updates for the new head. It must never post a request while CodeRabbit is still processing a new push.
2. No review request is ever posted while a prior request is unacknowledged and younger than the retrigger spacing window.
3. No review request is ever posted inside the account cooldown.
4. A comment already seen at or after its current update time is never processed again.
5. A comment not newer than the recorded review never re-enqueues — an older run's comment cannot reopen completed work.
6. Comments carrying the maximizer's own marker are never acted on.
7. `unknown` comments are never acted on.
8. An item is never triggered more than `MAX_RETRIGGER_ATTEMPTS` times; at the cap it resolves as `failed`.
9. Terminal PR states always resolve the item: merged, closed without merge, deleted or otherwise unavailable (404/410), and stale retriggered items.
10. A paused scheduler never posts, except the dashboard retrigger with an explicit pause override.
11. When GitHub's API quota is exhausted, all polling stops until the quota reset time.
12. Resolved items never appear in the queue order and can never be reordered or retriggered.
13. The maximizer never posts a review request except in direct response to a detected CodeRabbit comment (or a recovery synthesized from a deleted one).
14. A review from a run other than the item's adopted run never resolves the item; when no run is known, the newest review on the current PR head does.
