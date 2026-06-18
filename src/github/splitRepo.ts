export const splitRepo = (
  fullName: string,
): { owner: string; repo: string } => {
  const [owner, repo] = fullName.split("/");
  return { owner, repo };
};
