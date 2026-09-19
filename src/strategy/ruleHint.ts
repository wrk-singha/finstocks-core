import type {FSMRule} from '../types/trade.ts';
import {STRATEGY_INDICATOR_OPTIONS} from './strategyIndicators.ts';

// The compiler writes conditions the engine can evaluate, not ones a trader can read: a 5%
// take-profit compiles to `$entry_price * 1.05`. These turn such an expression back into words for
// display beside the field, never in place of it — the stored expression is what the engine runs,
// and only it is edited.
//
// Every name resolves through STRATEGY_INDICATOR_OPTIONS, the same catalog the pickers offer, so a
// newly-computed column reads correctly here without a second list to maintain. Only the shape of an
// expression is parsed; nothing about which names exist is stated twice.

const LABELS = new Map(
  STRATEGY_INDICATOR_OPTIONS.map(({value, label}) => [
    value,
    label.toLowerCase(),
  ]),
);

// Affixes the engine puts on a column name, none of which change what it is: `:1d` names the bar it
// is read from, `_price` is the OHLC columns' engine spelling, and `prev_` is the bar before this
// one.
const TIMEFRAME = /:[a-z0-9]+$/i;
const PRICE_SUFFIX = /_price$/;
/** A plain prefix rather than a pattern: core's lint prefers `startsWith` over `/^prev_/.test`. */
const PREVIOUS = 'prev_';
const SCALED = /^(\S+)\s*\*\s*([\d.]+)$/;

function lookup(name: string): string | null {
  return LABELS.get(name) ?? LABELS.get(name.replace(PRICE_SUFFIX, '')) ?? null;
}

function label(name: string): string | null {
  const bare = name.replace(TIMEFRAME, '');
  const known = lookup(bare);
  if (known) return known;

  if (!bare.startsWith(PREVIOUS)) return null;
  const base = lookup(bare.slice(PREVIOUS.length));
  return base ? `previous ${base}` : null;
}

const round = (n: number): string => String(Number(n.toFixed(4)));

/**
 * A phrase for the value, or null when it already reads plainly — a bare number, an unrecognised
 * name, or an expression too involved to restate without risking a wrong reading.
 */
export function valueHint(value: string): string | null {
  const raw = value.trim();
  if (!raw || !Number.isNaN(Number(raw))) return null;

  const scaled = SCALED.exec(raw);
  if (!scaled) return label(raw);

  const [, name, factorText] = scaled;
  if (name === undefined || factorText === undefined) return null;
  const base = label(name);
  if (!base) return null;

  // Only entry price carries a meaningful "x% above/below": a multiple of an average volume is a
  // multiple, and saying "50% above" of it reads as a different measure than the one being compared.
  const factor = Number(factorText);
  if (name === '$entry_price' && factor !== 1) {
    const pct = round(Math.abs(factor - 1) * 100);
    return `${pct}% ${factor > 1 ? 'above' : 'below'} ${base}`;
  }
  return `${round(factor)} × ${base}`;
}

// Only a comment that quantifies the exit describes the value beside it. The compiler writes many
// that name the transition instead ("Entry", "Phase 2: Momentum"), and those belong to the rule, not
// to this field.
const QUANTIFIED = /\d+(\.\d+)?%/;

const EXIT_LABELS: Partial<Record<NonNullable<FSMRule['exit_type']>, string>> =
  {
    take_profit: 'Take profit',
    stop_loss: 'Stop loss',
  };

/** Prefers the compiler's own words, which state the intent exactly. */
export function exitHint(rule: FSMRule, value: string): string | null {
  if (rule.comment && QUANTIFIED.test(rule.comment)) {
    return rule.comment.replace(/\.0%/g, '%');
  }

  const label = rule.exit_type && EXIT_LABELS[rule.exit_type];
  if (label && rule.pct != null) return `${label} at ${rule.pct}%`;

  return valueHint(value);
}
