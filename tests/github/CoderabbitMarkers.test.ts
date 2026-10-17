import type { CoderabbitMarkers } from '../../src/github/index.js';
import { createCoderabbitMarkers } from '../helpers/index.js';

import { getUniqueString } from '@couimet/dynamic-testing';
import { beforeEach, describe, expect, it } from '@jest/globals';

describe('CoderabbitMarkers', () => {
  let acknowledgement: string;
  let approval: string;
  let changesSuggested: string;
  let pause: string;
  let rateLimit: string;
  let refusal: string;
  let skip: string;
  let walkthrough: string;
  let markers: CoderabbitMarkers;

  beforeEach(() => {
    acknowledgement = getUniqueString({ prefix: 'acknowledgement-' });
    approval = getUniqueString({ prefix: 'approval-' });
    changesSuggested = getUniqueString({ prefix: 'changes-' });
    pause = getUniqueString({ prefix: 'pause-' });
    rateLimit = getUniqueString({ prefix: 'rate-limit-' });
    refusal = getUniqueString({ prefix: 'refusal-' });
    skip = getUniqueString({ prefix: 'skip-' });
    walkthrough = getUniqueString({ prefix: 'walkthrough-' });
    markers = createCoderabbitMarkers({
      CODERABBIT_ACKNOWLEDGEMENT_PHRASES: [acknowledgement],
      CODERABBIT_APPROVAL_PHRASES: [approval],
      CODERABBIT_CHANGES_SUGGESTED_PHRASES: [changesSuggested],
      CODERABBIT_PAUSE_PHRASES: [pause],
      CODERABBIT_RATE_LIMIT_PHRASES: [rateLimit],
      CODERABBIT_REFUSAL_PHRASES: [refusal],
      CODERABBIT_SKIP_PHRASES: [skip],
      CODERABBIT_WALKTHROUGH_PHRASES: [walkthrough],
    });
  });

  it('exposes the configured acknowledgement phrases', () => {
    expect(markers.acknowledgement).toStrictEqual([acknowledgement]);
  });

  it('exposes the configured approval phrases', () => {
    expect(markers.approval).toStrictEqual([approval]);
  });

  it('exposes the configured changes-suggested phrases', () => {
    expect(markers.changesSuggested).toStrictEqual([changesSuggested]);
  });

  it('exposes the configured pause phrases', () => {
    expect(markers.pause).toStrictEqual([pause]);
  });

  it('exposes the configured rate-limit phrases', () => {
    expect(markers.rateLimit).toStrictEqual([rateLimit]);
  });

  it('exposes the configured refusal phrases', () => {
    expect(markers.refusal).toStrictEqual([refusal]);
  });

  it('exposes the configured skip phrases', () => {
    expect(markers.skip).toStrictEqual([skip]);
  });

  it('exposes the configured walkthrough phrases', () => {
    expect(markers.walkthrough).toStrictEqual([walkthrough]);
  });

  it('joins the changes-suggested and approval phrases into the completion list', () => {
    expect(markers.completion).toStrictEqual([changesSuggested, approval]);
  });

  it('joins the rate-limit and skip phrases into the rate-limit-or-skip list', () => {
    expect(markers.rateLimitOrSkip).toStrictEqual([rateLimit, skip]);
  });
});
