export interface DashboardSystemState {
  readonly paused: boolean;
  readonly lastSchedulerTickAt: Date | undefined;
  readonly nextReviewAvailableAt: Date | undefined;
}
