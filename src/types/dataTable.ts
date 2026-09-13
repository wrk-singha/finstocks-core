/**
 * `type:"data_table"` card payload (CARD-DIRECT-1).
 *
 * Emitted by the LLM's research/grounding lane (`llm/graph/nodes/research/grounding/renderer.py`
 * `build_table_cards`) on `job_completed.data.cards[]`. Cells are pre-formatted display strings
 * keyed by column `key` — no client-side re-derivation or rounding.
 */

export interface DataTableColumn {
  key: string;
  label: string;
  align?: 'right';
}

export type DataTableShape =
  'metric_table' | 'comparison_table' | 'ranked_list' | 'event_study';

export interface DataTablePayload {
  shape: DataTableShape;
  title: string;
  columns: DataTableColumn[];
  rows: Record<string, string>[];
  as_of?: string;
  footnote?: string;
  /**
   * How many matched, and how many of them this card renders. A truncated table that says
   * nothing reads as a complete one, and a reader has no way to tell by looking — so the card
   * states it.
   */
  total?: number;
  shown?: number;
  /**
   * The filter that produced these rows, in one sentence. The card is what gets scrolled to,
   * shared and saved, and a grid of figures with no statement of what produced them cannot be
   * read at all.
   */
  description?: string;
  /**
   * The instrument this card is about, when it is about exactly one. A ranked list identifies
   * itself row by row; a single-name reading has no symbol column, so its identity lives here.
   */
  symbol?: string;
}
