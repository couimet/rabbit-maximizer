# request-coderabbit-full-review

Posts a `@coderabbitai full review` comment on a pull request to trigger a fresh CodeRabbit full review.

Part of [rabbit-maximizer](https://github.com/couimet/rabbit-maximizer) — an open source tool that keeps your PR review queue flowing.

## Inputs

| Name        | Required | Default      | Description                                                                                                                               |
| ----------- | -------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `repo`      | no       | current repo | Repository to post the comment on (`owner/repo`). Defaults to the current repository.                                                     |
| `pr-number` | yes      | —            | Pull request number to post the review request on                                                                                         |
| `trigger`   | no       | `workflow`   | What triggered this review request (e.g., `rabbit-maximizer-restacker`, `workflow-dispatch`). Included in comment metadata for debugging. |
| `metadata`  | no       | `{}`         | Additional JSON-serializable metadata to include in the comment. Merged into the hidden metadata block.                                   |

The action uses `${{ github.token }}` automatically. Callers must grant `pull-requests: write` permission on the job that calls this action. To use a different token (e.g., for cross-repo comments), set `GITHUB_TOKEN` as a step-level env var override.

## Outputs

| Name         | Description                                    |
| ------------ | ---------------------------------------------- |
| `comment-id` | GitHub comment ID of the posted review request |

## Example usage

Same repository (default):

```yaml
- uses: couimet/rabbit-maximizer/.github/actions/request-coderabbit-full-review@main
  with:
    pr-number: 42
    trigger: rabbit-maximizer-restacker
    metadata: |
      {
        "parent_pr": "${{ github.event.pull_request.html_url }}"
      }
```

Cross-repository (overrides the default `github.token`):

```yaml
- uses: couimet/rabbit-maximizer/.github/actions/request-coderabbit-full-review@main
  with:
    repo: other-org/other-repo
    pr-number: 99
    trigger: cross-repo-sync
  env:
    GITHUB_TOKEN: ${{ secrets.OTHER_REPO_TOKEN }}
```

## Comment format

```
@coderabbitai full review

⚡ Review requested by rabbit-maximizer-restacker workflow

---

🤖 Requested by [request-coderabbit-full-review](https://github.com/couimet/rabbit-maximizer/tree/main/.github/actions/request-coderabbit-full-review) — an open source GitHub Action. [rabbit-maximizer](https://github.com/couimet/rabbit-maximizer) keeps your review queue flowing.

<!-- request-coderabbit-full-review
{
  "trigger": "rabbit-maximizer-restacker",
  "parent_pr": "https://github.com/couimet/rabbit-maximizer/pull/136",
  "timestamp": "2026-07-09T16:45:00Z"
}
-->
```

The hidden `<!-- request-coderabbit-full-review -->` HTML comment block contains machine-parseable JSON with the trigger name, caller-provided metadata, and a timestamp.
