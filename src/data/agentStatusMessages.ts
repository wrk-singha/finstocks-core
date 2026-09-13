/**
 * Rotating status lines shown while a strategy agent is running. Hardcoded UI copy (not
 * streamed from the LLM) — cycled to convey that a real execution loop is working.
 */
export const AGENT_STATUS_MESSAGES: readonly string[] = [
  'Sweeping NSE for fresh breakouts…',
  'Reading order-book depth on NIFTY 50…',
  'Scoring momentum across 200 symbols…',
  'Ranking setups by risk-reward…',
  'Mapping support and resistance zones…',
  'Tracking volume profile at key levels…',
  'Gauging sector rotation across indices…',
  'Weighing volatility against entry timing…',
  'Sizing the position against your risk budget…',
  'Confirming margin headroom with your broker…',
  'Validating stop-loss and target bands…',
  'Watching the bid-ask spread tighten…',
  'Checking slippage vs. limit price…',
  'Timing the entry on the next tick…',
  'Routing the order to the exchange…',
  'Reconciling fills with your broker…',
  'Rechecking exposure across open positions…',
  'Measuring drawdown against your limits…',
  'Cross-checking signals against live ticks…',
  'Holding the live market feed open…',
];
