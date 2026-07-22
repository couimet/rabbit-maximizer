export class SubmittedComment {
  readonly userLogin: string | undefined;
  readonly body: string | undefined;

  private constructor(fields: { userLogin: string | undefined; body: string | undefined }) {
    this.userLogin = fields.userLogin;
    this.body = fields.body;
  }

  static from(raw: { user?: { login?: string } | null; body?: string | null }): SubmittedComment {
    return new SubmittedComment({
      userLogin: raw.user?.login ?? undefined,
      body: raw.body ?? undefined,
    });
  }

  static create(fields: { userLogin: string | undefined; body: string | undefined }): SubmittedComment {
    return new SubmittedComment(fields);
  }
}
