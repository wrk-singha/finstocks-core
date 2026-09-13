import type {Recommendation} from '../types/market.ts';

export type EntryState = 'in_zone' | 'above_zone' | 'below_zone' | 'unknown';

export interface EntryStatus {
  state: EntryState;
  label: string;
}

export interface TradeGeometry {
  risk: number | null;
  reward: number | null;
  ratio: number | null;
}

export interface LadderPoint {
  key: 'stop' | 'entry' | 'cmp' | 'target';
  /** 0..1 along the stop→target axis. */
  pos: number;
  price: number;
}

type SetupFields = Pick<
  Recommendation,
  'cmp' | 'entry_min' | 'entry_max' | 'stop_loss' | 'target_price'
>;

// Where CMP sits against the backend's own entry band, so "can I still take
// this?" is answered with the numbers the pick was written with rather than a
// tolerance invented here.
export function entryStatus(reco: SetupFields): EntryStatus {
  const {cmp, entry_min: min} = reco;
  const max = reco.entry_max ?? min;
  if (cmp == null || min == null || max == null) {
    return {state: 'unknown', label: 'Entry zone unavailable'};
  }

  const low = Math.min(min, max);
  const high = Math.max(min, max);
  if (cmp >= low && cmp <= high)
    return {state: 'in_zone', label: 'In entry zone'};

  const above = cmp > high;
  const edge = above ? high : low;
  const drift = edge === 0 ? 0 : Math.abs(((cmp - edge) / edge) * 100);
  return {
    state: above ? 'above_zone' : 'below_zone',
    label: `${drift.toFixed(1)}% ${above ? 'above' : 'below'} entry`,
  };
}

// Null legs stay null: a plan with no stop has unknown risk, never zero.
export function tradeGeometry(reco: SetupFields): TradeGeometry {
  const {entry_min: entry, stop_loss: stop, target_price: target} = reco;
  if (entry == null) return {risk: null, reward: null, ratio: null};

  const risk = stop == null ? null : Math.abs(entry - stop);
  const reward = target == null ? null : Math.abs(target - entry);
  const ratio =
    risk != null && reward != null && risk > 0 ? reward / risk : null;
  return {risk, reward, ratio};
}

// Null when the span is degenerate, where a proportional axis would be a lie.
export function ladderPoints(reco: SetupFields): LadderPoint[] | null {
  const {entry_min: entry, stop_loss: stop, target_price: target, cmp} = reco;
  if (entry == null || stop == null || target == null) return null;

  const lo = Math.min(stop, target);
  const span = Math.max(stop, target) - lo;
  if (span <= 0) return null;

  const at = (price: number) => (price - lo) / span;
  return [
    {key: 'stop', pos: at(stop), price: stop},
    {key: 'entry', pos: at(entry), price: entry},
    {key: 'target', pos: at(target), price: target},
    // Clamped so a price that has run past a level still renders on the track.
    ...(cmp != null
      ? [
          {
            key: 'cmp' as const,
            pos: Math.min(1, Math.max(0, at(cmp))),
            price: cmp,
          },
        ]
      : []),
  ];
}
