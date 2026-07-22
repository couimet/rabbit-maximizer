export class SubmittedReview {
  readonly userLogin: string | undefined;
  readonly body: string | undefined;
  readonly submittedAt: string | undefined;
  readonly state?: string;

  private constructor(fields: { userLogin: string | undefined; body: string | undefined; submittedAt: string | undefined; state?: string }) {
    this.userLogin = fields.userLogin;
    this.body = fields.body;
    this.submittedAt = fields.submittedAt;
    this.state = fields.state;
  }

  static from(raw: { user?: { login?: string } | null; body?: string | null; submitted_at?: string | null; state?: string }): SubmittedReview {
    return new SubmittedReview({
      userLogin: raw.user?.login ?? undefined,
      body: raw.body ?? undefined,
      submittedAt: raw.submitted_at ?? undefined,
      state: raw.state,
    });
  }

  static create(fields: { userLogin: string | undefined; body: string | undefined; submittedAt: string | undefined; state?: string }): SubmittedReview {
    return new SubmittedReview(fields);
  }
}
