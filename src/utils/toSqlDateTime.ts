/**
 * Render a Date in the TEXT form that Prisma stores in a SQLite DATETIME column, so a
 * raw query can compare it with a stored value. `toISOString` writes a trailing `Z`,
 * and the stored rows carry `+00:00`; the two forms differ at the last character.
 */
export const toSqlDateTime = (date: Date): string => date.toISOString().replace('Z', '+00:00');
