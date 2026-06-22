export interface PaginatedResult<T> {
  readonly items: T[];
  readonly total: number;
}
