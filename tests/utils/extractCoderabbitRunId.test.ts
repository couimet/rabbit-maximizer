import { CODERABBIT_RUN_ID_MAX_LENGTH } from '../../src/schemas/index.js';
import { extractCoderabbitRunId } from '../../src/utils/index.js';

import { getUniqueString, getUuid } from '@couimet/dynamic-testing';
import { describe, expect, it } from '@jest/globals';

const SKIP_TEMPLATE_RUN_ID = getUuid();
const WALKTHROUGH_RUN_ID = getUuid();
const CHECKBOX_ID = getUniqueString();
const RUN_ID_EXCEEDS_MAX_BY = 10;
const LONG_RUN_ID = 'a'.repeat(CODERABBIT_RUN_ID_MAX_LENGTH + RUN_ID_EXCEEDS_MAX_BY);
const LONG_RUN_ID_PREFIX = LONG_RUN_ID.slice(0, CODERABBIT_RUN_ID_MAX_LENGTH);

const LONG_RUN_ID_BODY = `> **Run ID**: \`${LONG_RUN_ID}\``;

const SKIP_TEMPLATE_BODY = `<!-- This is an auto-generated comment: summarize by coderabbit.ai -->
<!-- review_stack_entry_start -->

[![Review Change Stack](https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg)](https://app.coderabbit.ai/change-stack/couimet/rabbit-maximizer/pull/296?utm_source=github_walkthrough&utm_medium=github&utm_campaign=change_stack)

<!-- review_stack_entry_end -->
<!-- This is an auto-generated comment: skip review by coderabbit.ai -->

> [!IMPORTANT]
> - [ ] <!-- {"checkboxId":"${CHECKBOX_ID}"} --> 🔍 Trigger review
>
> This repository does not receive automatic reviews because it has fewer than 10 stars.
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
> **Run ID**: \`${SKIP_TEMPLATE_RUN_ID}\`
>
> </details>

<!-- end of auto-generated comment: skip review by coderabbit.ai -->`;

const WALKTHROUGH_BODY = `<!-- This is an auto-generated comment: summarize by coderabbit.ai -->
<!-- review_stack_entry_start -->

[![Review Change Stack](https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg)](https://app.coderabbit.ai/change-stack/couimet/ts-npm-packages/pull/95?utm_source=github_walkthrough&utm_medium=github&utm_campaign=change_stack)

<!-- review_stack_entry_end -->
No actionable comments were generated in the recent review. 🎉

<details>
<summary>ℹ️ Recent review info</summary>

<details>
<summary>⚙️ Run configuration</summary>

**Configuration used**: defaults

**Review profile**: CHILL

**Plan**: Pro

**Run ID**: \`${WALKTHROUGH_RUN_ID}\`

</details>

<details>
<summary>📥 Commits</summary>

Reviewing files that changed from the base of the PR and between e7331bb15e72dca5b5e8a63147c09208f61dd4a4 and b8403e14891d4f52cb7f622c1a999c88759a733b.

</details>

</details>

---

<details>
<summary>✨ Finishing Touches</summary>

- [ ] <!-- {"checkboxId": "${CHECKBOX_ID}", "radioGroupId": "utg-output-choice-group-4964841424"} -->   Create PR with unit tests

</details>`;

describe('extractCoderabbitRunId', () => {
  it('extracts the run ID from the skip template body', () => {
    expect(extractCoderabbitRunId(SKIP_TEMPLATE_BODY)).toBe(SKIP_TEMPLATE_RUN_ID);
  });

  it('extracts the run ID from a walkthrough-style body', () => {
    expect(extractCoderabbitRunId(WALKTHROUGH_BODY)).toBe(WALKTHROUGH_RUN_ID);
  });

  it('truncates a run ID longer than the max length', () => {
    expect(extractCoderabbitRunId(LONG_RUN_ID_BODY)).toBe(LONG_RUN_ID_PREFIX);
  });

  it('returns undefined when the body has no Run ID line', () => {
    const body = getUniqueString();

    expect(extractCoderabbitRunId(body)).toBeUndefined();
  });

  it('returns undefined for a body containing only a checkboxId block', () => {
    const body = `Use the checkbox below for a quick retry:
- [ ] <!-- {"checkboxId": "${CHECKBOX_ID}"} -->`;

    expect(extractCoderabbitRunId(body)).toBeUndefined();
  });
});
