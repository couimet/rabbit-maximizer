export interface GitHubQuota {
  readonly resource: string;
  readonly limit: number;
  readonly remaining: number;
  readonly used: number;
  readonly resetEpoch: number;
}
