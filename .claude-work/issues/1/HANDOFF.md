# CodeRabbit Optimizer — Handoff

One-line purpose: a personal, single-tenant tool that re-requests CodeRabbit reviews on your PRs after you hit CodeRabbit's hourly rate limit, spacing the retries so they actually go through.

Origin: spawned from https://github.com/couimet/idea-garden/issues/4 (idea-garden). This repo's tracking issue is created at spawn time and linked from the README bootstrap banner.

## TL;DR for the agent

- What this is: detect CodeRabbit "Rate limit exceeded" comments on your PRs, queue the affected PRs, and later re-post `@coderabbitai full review` (spaced out) so the throttled review runs. Optional local UI to reprioritize the queue.
- Current status: design complete, no code yet. Greenfield build in TypeScript/Node/pnpm.
- Do this first: scaffold the project (config loader with fail-fast validation, `.env.example`), then detection in poll mode (the shipped default), then the SQLite queue, then the scheduler/poster. Webhook mode and the UI come after the core loop works.
- Hard gotchas you must not miss: (1) Post the retrigger as a HUMAN PAT, never a GitHub App — CodeRabbit silently ignores commands from any account whose login ends in `[bot]`. (2) Detect rate-limit events via the hidden HTML marker `rate limited by coderabbit.ai`, not the visible prose. (3) Tag every comment the tool posts with a hidden marker so detection skips the tool's own comments (prevents a self-trigger loop). (4) Store the SQLite file on a mounted Docker volume (bind mount to a NAS path), never inside the container layer.

## Decisions (locked)

| # | Decision | Why |
|---|----------|-----|
| Architecture | Build BOTH a polling detector and a webhook detector, chosen by a load-time config flag (`DETECTION_MODE=poll|webhook`). | Owner runs webhook as a learning exercise ("fun-geek-factor"); polling exists so a forker can avoid the tunnel. One flag toggles them. |
| Default mode | Ship `poll` as the default in `.env.example`; document webhook as the advanced path. Poll interval ~90s. | A fresh fork runs with just a PAT, no tunnel, no exposed port. Waits are multi-minute so ~90s latency is negligible. |
| Tenancy | Single-tenant self-host, fork-and-run friendly. No central service. | Each person runs an isolated instance against their own GitHub; avoids all data-processor/liability concerns. |
| Config & secrets | Every account-specific value and secret comes from a gitignored `.env`, validated at startup (fail-fast, naming what is missing). Ship a committed `.env.example`. Nothing about any account is hardcoded. | This is what makes fork-and-run real and keeps secrets out of source. |
| Posting identity | Post the retrigger from a regular GitHub USER account via a fine-grained PAT. GitHub App / bot identity is ruled out for posting. | CodeRabbit ignores commands from `[bot]` logins (loop prevention); an App installation token posts as `app[bot]` and would be silently ignored. |
| Retrigger command | Post exactly `@coderabbitai full review`. | Owner's established workflow; forces a complete re-review. |
| Stack | TypeScript, Node, pnpm. | Matches owner's existing tooling (rangeLink). |
| Detection signal | Key off the hidden HTML comment marker `rate limited by coderabbit.ai`. Do NOT parse the visible warning prose. | The hidden marker is machine-written and stable; the GFM warning block is presentation-layer and may be restyled. |
| Scheduling | Optimistic and self-correcting: attempt at a best-effort time; if too early, CodeRabbit posts a fresh rejection with a new wait, so read that and reschedule. Use a fixed `>= 1 hour` only as a fallback when no wait signal can be read. Do not depend on parsing the wait text. | Re-requesting too early is a benign pushback (a new rate-limit comment), not a penalty. The rejection is the authoritative reschedule signal. CodeRabbit advises against parsing the wait wording (not guaranteed stable). |
| Loop safety | Per-PR attempt counter, backoff, max-attempts cap, light jitter. The tool must recognize its own comments and exclude them from detection. | Without this, the tool's own triggered rejection gets re-ingested as a new rate-limit event and ping-pongs. |
| Comment traceability | Every comment the tool posts carries: a visible footer (tool name, repo URL, version, optional git SHA and run/queue id), a hidden HTML marker for self-recognition (e.g. `<!-- coderabbit-optimizer v1.2.3 run=... -->`), and a backlink to the exact CodeRabbit rate-limit comment that triggered it. No secrets in either. | Footer = transparency/audit; hidden marker = self-recognition and loop safety; backlink = "why did the tool post this?" answerable from the PR thread. |
| Persistence | SQLite with a bind mount to a known NAS path (e.g. host `/volume1/docker/coderabbit-optimizer/data` mounted at `/data`, DB at `/data/queue.db`). Enable WAL. Keep DB path in config. Optionally add periodic backups (file copy or Litestream). | A volume keeps data outside the container lifecycle: replacing/rebuilding the image or removing the container does not lose it. A separate DB container is NOT needed and would not help (it also needs a volume); SQLite is embedded, not a server. |

## Target design

Components:
- Config loader: reads `.env`, validates required vars at startup, fails fast. Holds `DETECTION_MODE`, `POLL_INTERVAL`, GitHub PAT, repo/org filter, DB path, and (webhook mode only) tunnel URL + webhook secret.
- Detector (poll | webhook): finds CodeRabbit rate-limit comments on the owner's PRs. Poll mode runs a GitHub search on an interval; webhook mode receives `issue_comment` events (needs a tunnel + HMAC signature verification). Detection in both modes keys off the hidden `rate limited by coderabbit.ai` marker and excludes any comment carrying the tool's own marker. Reset detection is poll-only regardless of mode (CodeRabbit exposes no reset event).
- Queue (SQLite): current pending review requests; dedupes a PR that is already pending.
- Scheduler / worker: picks the next due item (respecting any reprioritization), posts `@coderabbitai full review` via the PAT, handles the response (accepted -> mark completed; rejected -> read new wait, bump attempt with backoff/jitter under a cap, reschedule; PR closed/merged -> mark failed).
- Reprioritization UI: a LAN-only local web app over the same SQLite queue; lets the owner reorder pending items. Reached over the LAN or Tailscale; needs NO exposed public port in any mode.
- Event/audit log: append-only history for debugging and traceability (see Data model).

End-to-end flow: detector finds a rate-limit comment -> enqueue the PR (skip if already pending) -> scheduler picks the next item when its time arrives and per priority -> poster posts the retrigger via PAT with footer + hidden marker + backlink -> on rejection, reschedule from the new wait; on success, mark completed. The UI mutates the queue order out of band; the scheduler always reads current state.

## Data model

Keep two concerns separate.

Queue (current state), table `review_queue`:
- `id` (pk), `repo_full_name` (text), `pr_number` (int), `status` (pending|completed|failed), `scheduled_for` (timestamp, UTC), `attempts` (int), `created_at`, `updated_at`.
- Partial unique index on `(repo_full_name, pr_number) WHERE status = 'pending'` so a PR can be re-queued in a later cycle but never double-queued while pending. (Do NOT use a plain full unique constraint; that would block re-enqueue after completion.)

Event/audit log (append-only), table `events`:
- `id` (pk), `ts` (UTC), `type` (detected|enqueued|posted|rejected|completed|failed), `repo_full_name`, `pr_number`, `source_comment_url` (the CodeRabbit rate-limit comment), `posted_comment_url` (the comment the tool created), `attempt_no`, `scheduled_for`, `outcome`, `new_wait`, `detail` (free text/JSON).
- This log is the debugging tape and is what makes the backlinks and loop-prevention auditable after the fact.

Use consistent UTC timestamps throughout to avoid scheduling drift.

## Constraints and gotchas

- Identity: retrigger MUST be posted by a non-`[bot]` account (PAT). This kills the GitHub App for the POSTING path. A GitHub App could still receive webhooks, but since posting needs a PAT anyway and reset detection is poll-only, a PAT-only design is simplest.
- Detection: use the hidden marker, not prose. Do not parse the "Please wait X minutes and Y seconds" text for scheduling (wording not guaranteed stable); treat it as a best-effort optimization at most, never a correctness dependency.
- Loop safety: exclude the tool's own comments from detection via its hidden marker; cap attempts; back off with jitter.
- Rate-limit shape (from CodeRabbit): enforced per developer (committer identity) per organization, on number of commits reviewed per hour, independent of repo/PR count. Window fixed-clock-hour vs rolling 60 min is UNCONFIRMED (wait time implies rolling). Per-plan numeric limits are UNKNOWN — CodeRabbit declined to quote them; check the plans page or support.
- Quota attribution (comment author vs PR author) is UNCONFIRMED; only matters if a shared service account is ever used; moot for personal single-tenant use.
- Secrets: only from `.env`. The GitHub App private key (if ever used for webhooks) is a multi-line PEM — store by file path or base64 in one env var; gitignore `.env` and any `*.pem`. Consider a gitleaks/git-secrets pre-commit hook.
- Persistence: SQLite on a mounted volume (bind mount to NAS path), WAL mode, configurable path; back it up.

## Open questions and deferred items

- For CodeRabbit support (not MVP blockers): exact per-plan numeric limits; fixed vs rolling window; quota attribution between comment author and PR author.
- Build-time decision: confirm the scheduling behavior (recommended: optimistic attempt + rejection-driven reschedule + `>= 1h` fallback). Already the locked direction above; revisit only if it misbehaves in practice.

## Sources

Provenance only. Do NOT depend on these resolving from inside this repo; the facts you need are inlined above and in the Appendix.

- idea-garden issue thread: https://github.com/couimet/idea-garden/issues/4
- CodeRabbit's original 5-phase plan: idea-garden#4 comment 4734344136
- CodeRabbit answers D1-D3 (discovery): idea-garden#4 comment 4735224674
- CodeRabbit answers B1-B3 (build specifics): idea-garden#4 comment 4735295988
- Real rate-limit comment format sample: couimet/rangeLink PR #388 comment 4028108795

## Appendix: verbatim external facts

Inlined so this file is self-contained. Reference, not instructions.

### A. CodeRabbit answers to D1-D3 (discovery), verbatim

| ID | Question (short form) | Answer | Notes |
|----|----------------------|--------|-------|
| D1 | API/endpoint to query remaining quota & next-allowed time | No | There is no public API or endpoint to programmatically check remaining review quota or the timestamp when it resets. The only signal available today is the comment CodeRabbit posts in the PR when the limit is reached. |
| D2 | Webhook/event notification on quota reset | No | There is no supported webhook, callback, or event stream that fires when quota resets. Polling is the only option currently. |
| D3 | Built-in queue or auto-retry for rate-limited reviews | No | CodeRabbit does not currently offer native queuing or auto-retry. When the limit is reached, a human (or your tool) must manually trigger `@coderabbitai full review` once the window reopens. Not on a publicly announced roadmap. |

CodeRabbit's bottom line: all three are "No," so the project is not redundant.

### B. CodeRabbit answers to B1-B3 (build specifics), verbatim

| ID | Question (short form) | Answer | Confidence & Notes |
|----|----------------------|--------|--------------------|
| B1 | Rate-limit scope, window type, per-plan numbers | Partial | Scope: per developer (committer identity) per organization, independent of repo/PR count. Window: not confirmed whether fixed clock-hour or rolling 60 min; the wait time implies rolling anchored to when the limit was hit, but not guaranteed. Per-plan numbers: not provided (would risk being stale); check the plans page or support. |
| B2 | Most stable detection signal | HTML comment marker is safest | Key off the hidden HTML comment `<!-- rate limited by coderabbit.ai -->` rather than the visible `> [!WARNING] ## Rate limit exceeded` heading. The marker is machine-written and far less likely to change; the warning block is presentation-layer. Wait-time text is present in current messages but wording is not guaranteed stable — do not parse it for scheduling; treat the entry as "retry in >= 1 hour" regardless. |
| B3 | Bot/app commands accepted? Loop prevention? Quota attribution? | Partially known, one critical caveat | CodeRabbit processes `@coderabbitai` commands from human or bot authors, EXCEPT it ignores commands from accounts whose login ends in `[bot]` (loop prevention). So an App posting as `your-app[bot]` is silently ignored — post from a regular human-identity account (PAT). Quota attribution (comment author vs PR author) is uncertain; confirm with support before relying on a shared service account. |

CodeRabbit's key action item: post the retrigger from a regular GitHub user account (PAT-based), not a GitHub App installation token whose actor login ends in `[bot]`.

### C. Real rate-limit comment sample (key excerpt), from rangeLink #388

Authored by `coderabbitai[bot]`. Structure (trimmed):

```
<!-- This is an auto-generated comment: rate limited by coderabbit.ai -->
> [!WARNING]
> ## Rate limit exceeded
>
> `@couimet` has exceeded the limit for the number of commits that can be
> reviewed per hour. Please wait **4 minutes and 48 seconds** before requesting
> another review.
> ...
> CodeRabbit enforces hourly rate limits for each developer per organization.
> ...
<!-- end of auto-generated comment: rate limited by coderabbit.ai -->
```

Notes: the wait time is dynamic and embedded (here under 5 minutes, not an hour). The section is wrapped in stable `rate limited by coderabbit.ai` HTML markers. The comment also carries an opaque base64 "internal state" blob and metadata (plan, review profile, run id). The retrigger command suggested inside this particular comment was `@coderabbitai review`, but the owner's chosen command is `@coderabbitai full review`.
