export const extractRepoFullName = (repositoryUrl: string): string =>
  repositoryUrl.replace("https://api.github.com/repos/", "");
