const DAYS_PER_YEAR = 365.25;
const MS_PER_DAY = 86_400_000;

/** Calendar years between two YYYY-MM-DD dates, fractional. */
export const yearsBetween = (from: string, to: string): number =>
  (new Date(to).getTime() - new Date(from).getTime()) /
  MS_PER_DAY /
  DAYS_PER_YEAR;
