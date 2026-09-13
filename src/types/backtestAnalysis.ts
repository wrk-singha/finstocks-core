/**
 * How pressing the offer is handled.
 *
 * "message" proposes something the user has to agree to - a sweep - so it is
 * sent as an ordinary message and takes the usual propose-and-confirm path.
 * "templates" is a read with nothing to agree to, so the card renders the ids
 * it was handed instead of asking the assistant to fetch them.
 */
export type BacktestAnalysisOffer =
  | {label: string; action: 'message'; message: string}
  | {label: string; action: 'templates'; template_ids?: number[]};

export interface BacktestAnalysisResponse {
  strategy_id: string;
  /**
   * Empty while the results row hasn't landed yet, or when a generation failed -
   * both are retryable, neither is persisted server-side.
   */
  analysis: string;
  computed_at: string;
  cached: boolean;
  /**
   * What the result means for the decision in front of the user, computed in
   * the same request as the prose above it. good | bad, or empty when there was
   * nothing to judge.
   *
   * Not derivable client-side: it weighs seven metrics net of charges against
   * what the shipped template library actually recorded, and a second
   * implementation of that rule would be the kind of copy that drifts silently.
   */
  verdict?: string;
  next_step?: string;
  /** Rendered verbatim above the prose when present. */
  headline?: string;
  /**
   * The one action that follows, and how the card should handle a press.
   * Absent when the answer is "deploy": that control already exists on the card.
   */
  offer?: BacktestAnalysisOffer | null;
  /**
   * Present only when tuning has been tried and these conditions are not worth
   * optimising, and only ids the library actually contains.
   */
  template_ids?: number[];
}
