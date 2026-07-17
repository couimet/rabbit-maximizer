export const truncateBodyPreview = (body: string | null | undefined, maxLength: number): string | undefined => (body ? body.slice(0, maxLength) : undefined);
