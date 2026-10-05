const STAGE_NAMES: Record<string, string> = {
  '1A': 'Early base',
  '1B': 'Ready to rise',
  '2A': 'Early uptrend',
  '2B': 'Uptrend',
  '2C': 'Extended uptrend',
  '3': 'Topping out',
  '4': 'Falling',
};

/** The cycle a stage belongs to: 1 resting, 2 rising, 3 topping, 4 falling. */
export const stageCycle = (stage: string | null | undefined): number | null =>
  stage ? Number(stage[0]) || null : null;

export const stageName = (stage: string | null | undefined): string =>
  (stage ? STAGE_NAMES[stage] : undefined) ?? 'Not staged';

/** The one name a stage goes by on the page: "Stage 2A · Early uptrend". */
export const stageLabel = (stage: string | null | undefined): string =>
  stage ? `Stage ${stage} · ${stageName(stage)}` : stageName(stage);

export const STAGE_CYCLE = [
  {cycle: 1, label: 'Base'},
  {cycle: 2, label: 'Uptrend'},
  {cycle: 3, label: 'Topping'},
  {cycle: 4, label: 'Falling'},
] as const;

const WARNINGS: Record<string, string> = {
  market_not_confirmed: "The overall market isn't in a confirmed uptrend.",
  volume_distribution: 'Heavy selling in recent weeks.',
  piotroski_weak: 'Weak accounts.',
};

export const warningText = (w: string): string => WARNINGS[w] ?? w;

export const MARKET_LABELS: Record<string, string> = {
  confirmed_uptrend: 'Confirmed uptrend',
  under_pressure: 'Uptrend under pressure',
  correction: 'Correction',
};

/** "Top 1.4%" — finer under 10% where the rank is the point, whole numbers above. */
export const formatTopPct = (topPct: number): string =>
  `Top ${topPct < 10 ? Math.max(topPct, 0.1).toFixed(1) : Math.round(topPct)}%`;
