export const repoUrl = (repoFullName: string): string => `https://github.com/${repoFullName}`;

export const prUrl = (repoFullName: string, prNumber: number): string => `https://github.com/${repoFullName}/pull/${prNumber}`;
