import type { SubmittedReviewFields, SubmittedReviewRaw } from '../types/index.js';

export class SubmittedReview {
  readonly userLogin: string | undefined;
  readonly body: string | undefined;
  readonly submittedAt: string | undefined;
  readonly commitId: string | undefined;
  readonly state?: string;

  private constructor(fields: SubmittedReviewFields) {
    this.userLogin = fields.userLogin;
    this.body = fields.body;
    this.submittedAt = fields.submittedAt;
    this.commitId = fields.commitId;
    this.state = fields.state;
  }

  static from(raw: SubmittedReviewRaw): SubmittedReview {
    return new SubmittedReview({
      userLogin: raw.user?.login ?? undefined,
      body: raw.body ?? undefined,
      submittedAt: raw.submitted_at ?? undefined,
      commitId: raw.commit_id ?? undefined,
      state: raw.state,
    });
  }

  static create(fields: SubmittedReviewFields): SubmittedReview {
    return new SubmittedReview(fields);
  }
}
