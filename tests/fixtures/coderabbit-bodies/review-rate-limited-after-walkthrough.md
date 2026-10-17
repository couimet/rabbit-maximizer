<!-- This is an auto-generated comment: summarize by coderabbit.ai -->
<!-- review_stack_entry_start -->

[![Review Change Stack](https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg)](https://app.coderabbit.ai/change-stack/couimet/rangeLink/pull/708?utm_source=github_walkthrough&utm_medium=github&utm_campaign=change_stack)

<!-- review_stack_entry_end -->
<!-- This is an auto-generated comment: rate limited by coderabbit.ai -->

> [!WARNING]
> ## Review limit reached
> 
> `@couimet`, you've reached your PR review limit, so we couldn't start this review.
> 
> **Next review available in:** **52 minutes**
> 
> You've used all free OSS reviews for now. Wait for the free limit to reset to keep reviewing this public repository.
> 
> <details>
> <summary>How can I continue?</summary>
> 
> After more reviews become available, a review can be triggered using the `@coderabbitai review` command as a PR comment. Alternatively, push new commits to this PR.
> 
> To avoid repeated limits, reduce automatic review volume by pausing incremental auto-reviews earlier, using label-based review opt-in, excluding WIP or generated PR titles, or requesting reviews manually when the PR is ready. If your team needs uninterrupted high-volume reviews, an organization admin can enable usage-based reviews.
> 
> </details>
> 
> 
> <details>
> <summary>How do review limits work?</summary>
> 
> CodeRabbit enforces per-developer PR review limits for each organization. Most developers receive the normal plan review availability.
> 
> For paid Pro and Pro+ PR reviews, CodeRabbit uses adaptive limits for sustained high-volume activity. When a developer's recent PR review activity reaches the 95th percentile or higher among CodeRabbit users, additional reviews become available more gradually as earlier reviews age out of the rolling window.
> 
> Please refer [docs](https://docs.coderabbit.ai/management/plans#rate-limits) for additional details.
> 
> </details>
> 
> <details>
> <summary>Review details</summary>
> 
> <details>
> <summary>⚙️ Run configuration</summary>
> 
> **Configuration used**: Path: .coderabbit.yaml
> 
> **Review profile**: CHILL
> 
> **Plan**: Pro Plus
> 
> **Run ID**: `1f0ba775-f1a9-4886-aa71-58173ff1d47a`
> 
> </details>
> 
> <details>
> <summary>📥 Commits</summary>
> 
> Reviewing files that changed from the base of the PR and between de497e3dc8538f9aea82913eefa9f04515b60325 and 382bf8a06ec537c660b914a6dacb3ce0bf1627a7.
> 
> </details>
> 
> <details>
> <summary>📒 Files selected for processing (51)</summary>
> 
> * `.claude/agents/README.md`
> * `.claude/agents/tc-implement.md`
> * `.claude/agents/test-scope-fixer.md`
> * `.claude/skills/create-demo/SKILL.md`
> * `.claude/skills/qa-suggest/SKILL.md`
> * `.claude/skills/start-issue-hook/SKILL.md`
> * `.claude/skills/tcs-definition/SKILL.md`
> * `.github/actions/check-todos/action.yml`
> * `.github/workflows/ci.yml`
> * `.github/workflows/test-shell-scripts.yml`
> * `.markdownlint-cli2.jsonc`
> * `DEVELOPMENT.md`
> * `bats-tests/shell/check-dirty-tree.bats`
> * `bats-tests/shell/extract-test-stats.bats`
> * `bats-tests/shell/finalize-release.bats`
> * `bats-tests/shell/fixtures/jest-multi-package.txt`
> * `bats-tests/shell/fixtures/jest-snapshots.txt`
> * `bats-tests/shell/fixtures/jest-valid.txt`
> * `bats-tests/shell/fixtures/mocha-failing.txt`
> * `bats-tests/shell/fixtures/mocha-no-match.txt`
> * `bats-tests/shell/fixtures/mocha-valid.txt`
> * `bats-tests/shell/fixtures/mocha-zero-zero.txt`
> * `bats-tests/shell/generate-publishing-instructions.bats`
> * `bats-tests/shell/generate-qa-issue.bats`
> * `bats-tests/shell/generate-release-testing-instructions.bats`
> * `bats-tests/shell/lock-version.bats`
> * `bats-tests/shell/orchestrate-release-lock.bats`
> * `bats-tests/shell/resolve-qa-labels.bats`
> * `bats-tests/shell/run-integration-tests.bats`
> * `bats-tests/shell/start-release.bats`
> * `bats-tests/shell/test_helper.bash`
> * `bats-tests/shell/validate-qa-coverage.bats`
> * `demo/01-basic-usage/QUICK-REFERENCE.md`
> * `demo/01-basic-usage/README.md`
> * `demo/ASSET-STORAGE.md`
> * `docs/ARCHITECTURE.md`
> * `docs/ASSET-MANAGEMENT.md`
> * `docs/BYOD.md`
> * `docs/CEMETERY.md`
> * `docs/ERROR-HANDLING.md`
> * `docs/LINK-FORMATS.md`
> * `docs/LOGGING.md`
> * `docs/PLAN-UNIVERSAL-PASTE.md`
> * `docs/RELEASE-STRATEGY.md`
> * `docs/RESEARCH-CLAUDE-CODE-INTEGRATION-UPDATE.md`
> * `docs/RESEARCH-UNIVERSAL-PASTE.md`
> * `docs/architecture-multi-language.md`
> * `docs/neovim-integration.md`
> * `package.json`
> * `packages/rangelink-vscode-extension/CHANGELOG.md`
> * `packages/rangelink-vscode-extension/README.md`
> 
> </details>
> 
> </details>

<!-- end of auto-generated comment: rate limited by coderabbit.ai -->

<!-- walkthrough_start -->

## Walkthrough

CI now uses reusable TypeScript and shell-test workflows. Bats tests use shared temporary fixtures and expanded coverage. Markdown lint configuration and documentation formatting are updated. Obsolete checks and the standalone shell-test workflow are removed.

### Changes

**CI workflow and test foundation**

|Layer / File(s)|Summary|
|---|---|
|**Reusable CI and Bats workflow integration** <br> `.github/workflows/ci.yml`, `.markdownlint-cli2.jsonc`, `package.json`|CI uses reusable workflows. Markdown linting and the relocated Bats test path are configured.|
|**Shared Bats infrastructure and statistics coverage** <br> `bats-tests/shell/test_helper.bash`, `bats-tests/shell/*`, `bats-tests/shell/fixtures/*`|Temporary fixtures, command stubs, and Jest/Mocha fixtures support isolated shell tests and expanded assertions.|
|**Release and QA automation coverage** <br> `bats-tests/shell/*release*.bats`, `bats-tests/shell/*qa*.bats`, `bats-tests/shell/run-integration-tests.bats`|Release, QA, and integration tests cover generated instructions, version locking, label resolution, temporary output trees, and report generation.|
|**Documentation Markdown formatting** <br> `.claude/*`, `DEVELOPMENT.md`, `demo/*`, `docs/*`, `packages/rangelink-vscode-extension/*.md`|Markdown fences, headings, links, quotations, examples, and lint suppressions are updated.|

**Estimated code review effort:** 4 (Complex) | ~60 minutes

**Possibly related PRs**

- [couimet/rangeLink#576](https://github.com/couimet/rangeLink/pull/576) — Related shell-test fixtures and Bats infrastructure.
- [couimet/rangeLink#608](https://github.com/couimet/rangeLink/pull/608) — Related release-script Bats coverage.
- [couimet/rangeLink#662](https://github.com/couimet/rangeLink/pull/662) — Related Markdown formatting in agent skill documentation.

**Poem**

> A rabbit checks each test in line,  
> While Markdown fences neatly shine.  
> Temporary paths keep dirt away,  
> CI hops through checks today.  
> Safe little burrows guard the run.

<!-- walkthrough_end -->
<!-- pre_merge_checks_walkthrough_start -->

<details>
<summary>🚥 Pre-merge checks | ✅ 2 | ❌ 3</summary>

### ❌ Failed checks (3 warnings)

|         Check name         | Status     | Explanation                                                                                                                                         | Resolution                                                                                                         |
| :------------------------: | :--------- | :-------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------- |
|     Linked Issues check    | ⚠️ Warning | The PR meets `#675`, `#678`, and `#663`, but the summary does not show the required markdownlint-cli2 devDependency from `#664`.                            | Add markdownlint-cli2 as a devDependency, or provide evidence that the reusable workflow supplies this dependency. |
| Out of Scope Changes check | ⚠️ Warning | The PR includes unrelated deletions of universal-paste and Claude Code research documents beyond the linked CI, BATS, and Markdown lint objectives. | Remove unrelated research-document deletions or link issues that explicitly require their removal.                 |
|     Docstring Coverage     | ⚠️ Warning | Docstring coverage is 22.73% which is insufficient. The required threshold is 80.00%.                                                               | Write docstrings for the functions missing them to satisfy the coverage threshold.                                 |

<details>
<summary>✅ Passed checks (2 passed)</summary>

|     Check name    | Status   | Explanation                                                                                                        |
| :---------------: | :------- | :----------------------------------------------------------------------------------------------------------------- |
| Description Check | ✅ Passed | Check skipped - CodeRabbit’s high-level summary is enabled.                                                        |
|    Title check    | ✅ Passed | The title clearly identifies broad CI changes, although it does not name the reusable workflow or specific checks. |

</details>

</details>

<!-- pre_merge_checks_walkthrough_end -->
<!-- finishing_touch_checkbox_start -->

<details>
<summary>✨ Finishing Touches 💡 1</summary>

<!-- finishing_touch_suggestion:docstrings -->
<details>
<summary>📝 Generate docstrings 💡</summary>

- [ ] <!-- {"checkboxId": "7962f53c-55bc-4827-bfbf-6a18da830691"} --> Create stacked PR
- [ ] <!-- {"checkboxId": "3e1879ae-f29b-4d0d-8e06-d12b7ba33d98"} --> Commit on current branch

</details>
<details>
<summary>🧪 Generate unit tests (beta)</summary>

- [ ] <!-- {"checkboxId": "f47ac10b-58cc-4372-a567-0e02b2c3d479", "radioGroupId": "utg-output-choice-group-5168162741"} -->   Create PR with unit tests
- [ ] <!-- {"checkboxId": "6ba7b810-9dad-11d1-80b4-00c04fd430c8", "radioGroupId": "utg-output-choice-group-5168162741"} -->   Commit unit tests in branch `issues/improve-ci`

</details>

</details>

<!-- finishing_touch_checkbox_end -->
<!-- tips_start -->

---

Thanks for using [CodeRabbit](https://coderabbit.ai?utm_source=oss&utm_medium=github&utm_campaign=couimet/rangeLink&utm_content=708)! It's free for OSS, and your support helps us grow. If you like it, consider giving us a shout-out.

<details>
<summary>❤️ Share</summary>

- [X](https://twitter.com/intent/tweet?text=I%20just%20used%20%40coderabbitai%20for%20my%20code%20review%2C%20and%20it%27s%20fantastic%21%20It%27s%20free%20for%20OSS%20and%20offers%20a%20free%20trial%20for%20the%20proprietary%20code.%20Check%20it%20out%3A&url=https%3A//coderabbit.ai)
- [Mastodon](https://mastodon.social/share?text=I%20just%20used%20%40coderabbitai%20for%20my%20code%20review%2C%20and%20it%27s%20fantastic%21%20It%27s%20free%20for%20OSS%20and%20offers%20a%20free%20trial%20for%20the%20proprietary%20code.%20Check%20it%20out%3A%20https%3A%2F%2Fcoderabbit.ai)
- [Reddit](https://www.reddit.com/submit?title=Great%20tool%20for%20code%20review%20-%20CodeRabbit&text=I%20just%20used%20CodeRabbit%20for%20my%20code%20review%2C%20and%20it%27s%20fantastic%21%20It%27s%20free%20for%20OSS%20and%20offers%20a%20free%20trial%20for%20proprietary%20code.%20Check%20it%20out%3A%20https%3A//coderabbit.ai)
- [LinkedIn](https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fcoderabbit.ai&mini=true&title=Great%20tool%20for%20code%20review%20-%20CodeRabbit&summary=I%20just%20used%20CodeRabbit%20for%20my%20code%20review%2C%20and%20it%27s%20fantastic%21%20It%27s%20free%20for%20OSS%20and%20offers%20a%20free%20trial%20for%20proprietary%20code)

</details>


<sub>Comment `@coderabbitai help` to get the list of available commands.</sub>

<!-- tips_end -->
