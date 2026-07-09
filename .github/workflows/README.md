# Workflows

Workflows in this directory are candidates for extraction to [couimet/github-actions](https://github.com/couimet/github-actions) once stabilized.

## Available workflows

Listed alphabetically.

### `rabbit-maximizer-restacker`

Detects when a PR merges, finds open child PRs that had the merged branch as their base, and posts a `@coderabbitai full review` comment on each via the `request-coderabbit-full-review` action. Designed for repos that use stacked PRs with `delete_branch_on_merge` enabled.

Triggered by `pull_request_target` `closed` events. Each comment includes structured metadata (trigger name, merged branch, timestamp) in an HTML marker block, letting downstream systems distinguish restacker-triggered reviews from other sources.

Comment posting is delegated to the standalone [`request-coderabbit-full-review`](../.github/actions/request-coderabbit-full-review/) composite action. Both the workflow and the action are structured for extraction to `couimet/github-actions`.

| Input / env            | Required | Default                 | Description                                                   |
| ---------------------- | -------- | ----------------------- | ------------------------------------------------------------- |
| `GITHUB_RUN_ID`        | auto     | (GitHub Actions run ID) | Run identifier embedded in comment metadata for traceability. |
| `github.event.repo`    | auto     | (event payload)         | Repository full name (e.g. `owner/repo`).                     |
| `github.event.pr.head` | auto     | (event payload)         | The merged PR's head ref, used as the `--base` filter.        |

When extracted to `couimet/github-actions`, the reusable workflow will accept these as explicit inputs:

| Input           | Required | Default | Description                                      |
| --------------- | -------- | ------- | ------------------------------------------------ |
| `repo`          | yes      | —       | Repository full name (e.g. `owner/repo`).        |
| `merged-branch` | yes      | —       | Name of the merged branch to find child PRs for. |

```yaml
# Current (local workflow in rabbit-maximizer):
# Triggered automatically by pull_request_target closed.
# When extracted to couimet/github-actions:

jobs:
  restack:
    uses: couimet/github-actions/.github/workflows/rabbit-maximizer-restacker.yml@main
    with:
      repo: couimet/rabbit-maximizer
      merged-branch: feature/my-stacked-branch
```

The script that performs the PR lookup (`scripts/rabbit-maximizer-restacker.sh`) delegates comment posting to the `request-coderabbit-full-review` action. Extraction is mechanical: move both into the reusable workflow directory and wrap with `action.yml`.
