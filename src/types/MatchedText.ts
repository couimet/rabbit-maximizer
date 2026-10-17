/**
 * A configured phrase that a comment body holds, with the zero-based index of
 * its first occurrence in that body. The offset locates the phrase inside
 * CodeRabbit's wording, which helps an operator confirm a match.
 */
export interface MatchedText {
  readonly phrase: string;
  readonly offset: number;
}
