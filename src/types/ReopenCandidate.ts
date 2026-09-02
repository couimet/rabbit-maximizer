// Optional so the predicate accepts both QueueItem (retriggered_at?: Date) and Prisma ReviewQueue (retriggered_at: Date | null) shapes.
export interface ReopenCandidate {
  readonly retriggered_at?: Date | null | undefined;
}
