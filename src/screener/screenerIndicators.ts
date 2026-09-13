import {indicatorSections} from '../data/indicatorsConfig.ts';
import type {
  CustomIndicatorFilter,
  ScreenerIndicator,
} from '../types/screener.ts';

export interface IndicatorOption {
  key: string;
  label: string;
  group: string;
  kind: 'number' | 'boolean';
  description?: string;
  unit?: string;
}

type IndicatorMeta = Omit<IndicatorOption, 'key' | 'kind'>;

const FUNDAMENTALS = 'Fundamentals';

/** Screener columns sourced from in_fundamentals, which indicatorSections omits. */
const FUNDAMENTAL_OPTIONS: Record<string, IndicatorMeta> = {
  price: {
    label: 'Price',
    group: FUNDAMENTALS,
    unit: '₹',
    description: 'Last traded price',
  },
  mkt_cap: {
    label: 'Market cap',
    group: FUNDAMENTALS,
    unit: '₹ Cr',
    description: 'Market capitalisation',
  },
  pe: {
    label: 'P/E (TTM)',
    group: FUNDAMENTALS,
    description: 'Trailing price-to-earnings',
  },
  roe: {
    label: 'ROE',
    group: FUNDAMENTALS,
    unit: '%',
    description: 'Return on equity',
  },
  debt_equity: {
    label: 'Debt / Equity',
    group: FUNDAMENTALS,
    description: 'Total debt over equity',
  },
  div_yield: {
    label: 'Dividend yield',
    group: FUNDAMENTALS,
    unit: '%',
    description: 'Annual dividend over price',
  },
  high_52w: {
    label: '52W high',
    group: FUNDAMENTALS,
    unit: '₹',
    description: 'Highest price in 52 weeks',
  },
  low_52w: {
    label: '52W low',
    group: FUNDAMENTALS,
    unit: '₹',
    description: 'Lowest price in 52 weeks',
  },
};

/** Every technical column the stock-detail indicators panel already labels, keyed by column. */
const TECHNICALS = new Map<string, IndicatorMeta>(
  indicatorSections.flatMap(section =>
    section.fields.map((f): [string, IndicatorMeta] => [
      f.key,
      {
        label: f.label,
        group: section.title,
        ...(f.description !== undefined ? {description: f.description} : {}),
      },
    ]),
  ),
);

const GROUP_ORDER = [
  FUNDAMENTALS,
  ...indicatorSections.map(s => s.title),
  'Other',
];

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Joins the backend's covered-indicator keys (only ~44 of ~190 extended indicators actually have
 * coverage against the fundamentals universe) with the labels the stock-detail indicators panel
 * already defines. An unlabelled key falls back to its column name, so a newly-refreshed
 * indicator stays filterable without an app change.
 */
export function buildIndicatorCatalog(
  indicators: ScreenerIndicator[],
): IndicatorOption[] {
  return indicators.map(({key, kind}) => {
    const meta = FUNDAMENTAL_OPTIONS[key] ?? TECHNICALS.get(key);
    return {
      key,
      kind,
      label: meta?.label ?? key,
      group: meta?.group ?? 'Other',
      ...(meta?.description !== undefined
        ? {description: meta.description}
        : {}),
      ...(meta?.unit !== undefined ? {unit: meta.unit} : {}),
    };
  });
}

/** Filters by search text and buckets the result for display. */
export function groupIndicatorOptions(
  options: IndicatorOption[],
  query = '',
): [string, IndicatorOption[]][] {
  const q = normalize(query);
  const groups = new Map<string, IndicatorOption[]>();

  for (const option of options) {
    if (
      q &&
      !normalize(
        `${option.label} ${option.key} ${option.description ?? ''}`,
      ).includes(q)
    )
      continue;
    const bucket = groups.get(option.group);
    if (bucket) bucket.push(option);
    else groups.set(option.group, [option]);
  }

  return [...groups].sort(
    (a, b) => GROUP_ORDER.indexOf(a[0]) - GROUP_ORDER.indexOf(b[0]),
  );
}

/** Serialises filters into the backend's `ind` param. */
export function serializeIndicatorFilters(
  filters: CustomIndicatorFilter[],
): string {
  return filters
    .map(f =>
      f.flag != null
        ? `${f.key}:${f.flag}`
        : `${f.key}:${f.min ?? ''}:${f.max ?? ''}`,
    )
    .join(',');
}

/** Chip and prompt text, e.g. "RSI 14 30 – 70", "P/E (TTM) ≤ 25", "Doji: Yes". */
export function indicatorFilterLabel(
  filter: CustomIndicatorFilter,
  option?: IndicatorOption,
): string {
  const name = option?.label ?? filter.key;
  const unit = option?.unit ? `${option.unit} ` : '';
  if (filter.flag != null) return `${name}: ${filter.flag ? 'Yes' : 'No'}`;
  if (filter.min && filter.max)
    return `${name} ${unit}${filter.min} – ${filter.max}`;
  if (filter.min) return `${name} ≥ ${unit}${filter.min}`;
  if (filter.max) return `${name} ≤ ${unit}${filter.max}`;
  return name;
}
