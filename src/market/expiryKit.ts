import {byExpiryDate} from './optionChain.ts';
import {monthlyExpiries} from './optionContract.ts';

// Read off the underlying's own expiry list, not a calendar rule: expiry weekdays move with holidays and SEBI.

/** 15:30 IST is 10:00 UTC. */
const SETTLE_UTC_HOUR = 10;

/** The instant an expiry settles, epoch ms (15:30 IST on the date). */
export function expiryInstant(expiry: string): number {
  const [y, m, d] = expiry.split('-').map(Number);
  // `||` as web has it: a missing, zero or unreadable month or day is read as the first, which
  // `??` would only do for a missing one.
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  return Date.UTC(y ?? NaN, (m || 1) - 1, d || 1, SETTLE_UTC_HOUR);
}

/**
 * Which chip this is, for a host that translates the label: `label` is web's
 * English, and stays what web prints.
 */
export type ExpiryChipKind =
  'weekly' | 'nextWeekly' | 'monthly' | 'thisMonth' | 'nextMonth' | 'farMonth';

export interface ExpiryChip {
  expiry: string;
  /** "Weekly", "Next weekly", "Monthly" — or the three months for a monthly-only underlying. */
  label: string;
  kind: ExpiryChipKind;
}

const CHIP_LABEL: Record<ExpiryChipKind, string> = {
  weekly: 'Weekly',
  nextWeekly: 'Next weekly',
  monthly: 'Monthly',
  thisMonth: 'This month',
  nextMonth: 'Next month',
  farMonth: 'Far month',
};

const chip = (expiry: string, kind: ExpiryChipKind): ExpiryChip => ({
  expiry,
  label: CHIP_LABEL[kind],
  kind,
});

const MONTH_KINDS = ['thisMonth', 'nextMonth', 'farMonth'] as const;

/** The unsettled expiries, nearest first. */
export function liveExpiries(
  expiries: readonly string[],
  now = Date.now(),
): string[] {
  return [...new Set(expiries)]
    .filter(e => expiryInstant(e) > now)
    .sort(byExpiryDate);
}

/** Whether the list carries weeklies (any expiry that is not its month's monthly). */
export function hasWeeklies(expiries: readonly string[]): boolean {
  const monthly = monthlyExpiries(expiries);
  return expiries.some(e => !monthly.has(e));
}

/**
 * Weekly underlyings: the next two weeklies and the nearest monthly (by
 * monthlyExpiries, the order speller's rule). Monthly-only: near, next, far.
 */
export function expiryChips(
  expiries: readonly string[],
  now = Date.now(),
): ExpiryChip[] {
  const live = liveExpiries(expiries, now);
  if (live.length === 0) return [];
  // Judged against the whole list, not only the live part: a settled date can
  // be what makes a month's last expiry its monthly.
  const monthly = monthlyExpiries(expiries);
  if (!hasWeeklies(live)) {
    return live
      .slice(0, 3)
      .map((expiry, i) => chip(expiry, MONTH_KINDS[i] ?? 'farMonth'));
  }
  const weeklies = live.filter(e => !monthly.has(e)).slice(0, 2);
  const month = live.find(e => monthly.has(e));
  const chips: ExpiryChip[] = weeklies.map((expiry, i) =>
    chip(expiry, i === 0 ? 'weekly' : 'nextWeekly'),
  );
  if (month) chips.push(chip(month, 'monthly'));
  return chips.sort((a, b) => byExpiryDate(a.expiry, b.expiry));
}

/** "Weekly" or "Monthly" for one expiry in its list, for a picker's hint; null when the list can't say. */
export function expiryRole(
  expiry: string,
  expiries: readonly string[],
): 'Weekly' | 'Monthly' | null {
  if (expiries.length === 0) return null;
  const monthly = monthlyExpiries(expiries);
  if (monthly.has(expiry)) return 'Monthly';
  return hasWeeklies(expiries) && expiries.includes(expiry) ? 'Weekly' : null;
}
