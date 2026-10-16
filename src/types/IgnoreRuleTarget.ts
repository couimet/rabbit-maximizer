/** The pull request fields the ignore rules match. The title is the current one, so a retitle stops a title rule from matching. */
export interface IgnoreRuleTarget {
  readonly authorLogin: string;
  readonly title: string;
}
