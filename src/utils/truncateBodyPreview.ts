export const truncateBodyPreview = (body: string | null | undefined, maxLength: number): string | undefined =>
  body != null ? body.slice(0, maxLength) : undefined;
