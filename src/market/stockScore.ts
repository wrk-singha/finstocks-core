import type {StockScore} from '../types/market.ts';
import type {StockScoreResponse} from '../types/scores.ts';

// The scoring endpoint reports the four components as flat fields and the
// verdict as free text; StockScore wants a pillar list and a typed action.
// Shared by every surface that renders the score (buy cards, the drawer
// overview tab) so the verdict→action parsing lives in exactly one place.
// `.includes` (not `===`) because the backend's free-text verdict can read
// "Strong Buy" / "Strong Sell".
export function mapStockScore(
  scoreApi: StockScoreResponse | null | undefined,
): StockScore | null {
  if (!scoreApi) return null;
  // The column is nullable server-side even though the contract types it string.
  const verdict = (scoreApi.verdict as string | null)?.toLowerCase() ?? '';
  const action = verdict.includes('sell')
    ? 'sell'
    : verdict.includes('buy')
      ? 'buy'
      : 'hold';
  return {
    stock_symbol: scoreApi.symbol,
    score: scoreApi.composite_score,
    action,
    conviction_pct: scoreApi.conviction_pct,
    summary: scoreApi.rationale,
    pillars: [
      {
        key: 'valuation',
        label: 'Valuation',
        score: scoreApi.valuation_score,
        tab: 'financials',
      },
      {
        key: 'financials',
        label: 'Financials',
        score: scoreApi.financials_score,
        tab: 'financials',
      },
      {
        key: 'technicals',
        label: 'Technicals',
        score: scoreApi.technicals_score,
        tab: 'technicals',
      },
      {
        key: 'ownership',
        label: 'Ownership',
        score: scoreApi.ownership_score,
        tab: 'ownership',
      },
    ],
    updated_at: scoreApi.computed_at,
  };
}
