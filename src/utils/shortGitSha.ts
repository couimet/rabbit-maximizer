// Matches SHORT_SHA_LENGTH in scripts/docker/derive-image-tags.sh, so the
// logged value joins the published `sha-<short>` image tag without a lookup.
const SHORT_SHA_LENGTH = 7;

/**
 * Reduces a commit SHA to the length the image tag uses. The publish workflow
 * passes the full commit, and one place knows the length.
 */
export const shortGitSha = (value: string | undefined): string => {
  const commit = value?.trim() ?? '';

  return commit === '' ? 'unknown' : commit.slice(0, SHORT_SHA_LENGTH);
};
