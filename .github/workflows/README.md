# Workflows

Workflows in this directory are candidates for extraction to [couimet/github-actions](https://github.com/couimet/github-actions) once stabilized.

## Available workflows

Listed alphabetically.

### `rabbit-maximizer-restacker`

Detects when a PR's base branch changes to `main` (typically because the original base was deleted after a parent PR merge) and posts a `@coderabbitai full review` comment to trigger CodeRabbit. Designed for repos that use stacked PRs with `delete_branch_on_merge` enabled, where `.coderabbit.yaml` restricts auto-reviews to `base_branches: [main]`.

Triggered by `pull_request_target` `edited` events where `changes.base.ref.to == 'main'`. Each comment includes structured metadata (trigger name, timestamp, previous base) in an HTML marker block, letting downstream systems distinguish restacker-triggered reviews from other sources.

Comment posting is delegated to the standalone [`request-coderabbit-full-review`](../.github/actions/request-coderabbit-full-review/) composite action.
