/**
 * The LLM → chart contract.
 *
 * Every type here is part of the wire format the LLM emits as `chart_plan` on the completion
 * frame. Changing anything in this file is a breaking change: bump PLAN_VERSION and re-issue
 * the capability manifest to the LLM team.
 *
 * Nothing in this file imports from the rest of chart control — it is the root of the
 * dependency graph, so every module can depend on it without cycles.
 *
 * drift resolved 2026-09-13: mobile typed the plan loosely (`ops: Record<string, unknown>[]`
 * plus an index signature) because it only forwards the plan to a WebView bridge. Web's copy
 * is the wire format and wins whole; a `ChartPlan` serialises to exactly what the bridge
 * forwarded before.
 */

export const PLAN_VERSION = 1;

export type TimeAnchor =
  | 'now'
  | 'session_open'
  | 'session_close'
  | 'prev_session_open'
  | 'prev_session_close'
  | 'first_visible'
  | 'last_visible'
  | 'first_loaded'
  | 'last_bar'
  | 'day_high_time'
  | 'day_low_time';

export type SelectionSource = 'crosshair' | 'selected_bar';

/** A duration suffixed m/h/d/b (b = bars), e.g. "30m", "2h", "5d", "200b". */
export type DurationExpr = string;

export type TimeExpr =
  | {epoch: number}
  | {bar_offset: number}
  | {anchor: TimeAnchor; offset?: DurationExpr}
  | {clock: string; day?: 'today' | 'prev'; tz?: 'chart' | 'utc'}
  | {ref: string}
  | {selection: SelectionSource};

export type PriceAnchor =
  'day_high' | 'day_low' | 'prev_close' | 'last' | 'open';

export type BarField =
  | 'open'
  | 'high'
  | 'low'
  | 'close'
  | 'volume'
  | 'hl2'
  | 'hlc3'
  | 'ohlc4'
  | 'body'
  | 'body_pct'
  | 'upper_wick'
  | 'lower_wick'
  | 'range'
  | 'change'
  | 'change_pct'
  | 'time'
  | 'is_green'
  | 'is_red';

export type OffsetExpr =
  {abs: number} | {pct: number} | {atr: number} | {ticks: number};

export type PriceExpr =
  | {value: number}
  | {ref: string}
  | {field: BarField; at: TimeExpr}
  | {anchor: PriceAnchor}
  | {study: string; plot: string; at: TimeExpr}
  | {base: PriceExpr; offset: OffsetExpr}
  | {selection: SelectionSource};

export type RangeScope =
  'visible' | 'loaded' | 'session' | 'prev_session' | 'all';

export type RangeExpr =
  {scope: RangeScope} | {last: DurationExpr} | {from: TimeExpr; to: TimeExpr};

export const DEFAULT_RANGE: RangeExpr = {scope: 'visible'};

export type EntityScope = 'auto' | 'user' | 'all';

/**
 * Semantic category of a tracked entity, orthogonal to its TradingView shape name. Lets a
 * follow-up address "remove only resistance" by MEANING rather than by internal shape
 * ("horizontal_line" draws both support and resistance). `support`/`resistance` are the two
 * directional level roles; everything else is structural and inferable from the op/shape
 * itself. `pattern_mark` is reserved for the one batch entity a `render.mark_bars` result is
 * tagged with, never set on an individual shape.
 */
export type EntityRole =
  | 'support'
  | 'resistance'
  | 'trend'
  | 'channel'
  | 'fibonacci'
  | 'zone'
  | 'vwap'
  | 'annotation'
  | 'pattern_mark';

export type Target =
  | {by: 'id'; value: string}
  | {by: 'tag'; value: string}
  | {by: 'role'; value: EntityRole}
  | {by: 'selection'}
  | {by: 'last'}
  | {by: 'type'; value: 'study' | 'shape'; name?: string}
  | {by: 'all'; scope: EntityScope};

export type SemanticColor =
  'bullish' | 'bearish' | 'neutral' | 'accent' | 'warn' | 'muted';

/** A semantic token or a raw #rrggbb the executor passes through untouched. */
export type ColorExpr = SemanticColor | (string & {});

export type MarkShape =
  | 'circle'
  | 'dot'
  | 'arrow'
  | 'arrow_up'
  | 'arrow_down'
  | 'flag'
  | 'square'
  | 'diamond';

export interface StyleSpec {
  color?: ColorExpr;
  /** Resolves a per-mark colour off a render.mark_bars bar, e.g. "$item.direction". */
  color_by?: string;
  width?: 1 | 2 | 3 | 4;
  style?: 'solid' | 'dashed' | 'dotted';
  opacity?: number;
  fill?: boolean;
  label?: string;
  label_position?: 'left' | 'right' | 'center';
  extend?: 'none' | 'left' | 'right' | 'both';
  locked?: boolean;
  /**
   * render.mark_bars only. `arrow` is an up arrow; `arrow_up`/`arrow_down` name the direction
   * outright, which is what a mark needs when its side and its polarity have to agree — a
   * bearish mark sits above the bar and must point down at it.
   */
  shape?: MarkShape;
  position?: 'above' | 'below';
}

export type OpLifecycle = 'once' | 'live';
export type OpErrorMode = 'abort' | 'continue' | 'retry';

export interface OpBase {
  id?: string;
  op: string;
  tag?: string;
  /** v1 executes "once" only; the validator rejects "live". */
  lifecycle?: OpLifecycle;
  rationale?: string;
  on_error?: OpErrorMode;
  /**
   * Which chart on the page this op acts on, when the page shows more than one — the F&O
   * terminal has spot beside a CE and a PE leg. Omitted means the active chart. The legal
   * values are the surface ids the page reports in its own context block; an unknown id fails
   * that op and no other.
   */
  on_chart?: string;
  /**
   * Semantic role for the entity a `draw.*`/`edit.*` op creates or touches. Not yet emitted by
   * the LLM — the executor reads it when present and falls back to a structural guess.
   */
  role?: EntityRole;
}

/** A single server-computed hit — the wire shape `expand.py` emits for pattern/predicate matches. */
export interface LiteralBar {
  epoch: number;
  /**
   * The bar's extremes. A mark anchors to the edge its side calls for and is padded off it, so
   * the gap stays constant in pixels at every zoom level.
   */
  high?: number;
  low?: number;
  /** An explicit price, for a mark that has one and no extremes. Present on its own it pins the mark exactly there. */
  price?: number;
  /** Pattern direction when one resolved (mark.pattern only); omitted, never null, otherwise. */
  direction?: 'bullish' | 'bearish';
  /**
   * Where this bar sits in the formation it belongs to: 1-based, oldest first, out of `of`
   * candles. A doji is 1 of 1; the second candle of a bullish engulfing is 2 of 2.
   */
  seq?: number;
  of?: number;
  /**
   * `trigger` is the candle the pattern completes on — the one the detector fired at, and the
   * only one the answer text quotes. `setup` is any candle in front of it that the pattern is
   * also made of, drawn quieter so the group reads as one finding.
   */
  role?: 'setup' | 'trigger';
}

/** A literal, already-computed bar list — what `render.mark_bars` draws. */
export interface LiteralBarsSource {
  bars: LiteralBar[];
}

export type ChartStyleName =
  | 'candles'
  | 'bars'
  | 'line'
  | 'area'
  | 'baseline'
  | 'heikin_ashi'
  | 'hollow_candles'
  | 'kagi'
  | 'point_and_figure'
  | 'line_break'
  | 'hi_lo'
  | 'column';

export type PriceScaleMode = 'normal' | 'log' | 'percentage' | 'indexed_to_100';

/** Mirrors the backend's pinned PERIOD_VALUES vocabulary (graph/chart_header.py). */
export type PeriodToken =
  '1D' | '5D' | '1M' | '3M' | '6M' | 'YTD' | '1Y' | '5Y' | 'ALL';

export type ChartOp =
  | (OpBase & {op: 'chart.set_symbol'; symbol: string})
  | (OpBase & {op: 'chart.set_resolution'; resolution: string})
  | (OpBase & {op: 'chart.set_chart_type'; type: ChartStyleName})
  | (OpBase & {op: 'chart.set_visible_range'; range: RangeExpr})
  | (OpBase & {op: 'chart.set_period'; period: PeriodToken})
  | (OpBase & {op: 'chart.scroll_to'; time: TimeExpr})
  | (OpBase & {
      op: 'chart.set_price_scale';
      mode?: PriceScaleMode;
      auto_fit?: boolean;
    })
  | (OpBase & {
      op: 'chart.add_compare';
      symbol: string;
      style?: StyleSpec;
      same_scale?: boolean;
    })
  | (OpBase & {op: 'chart.remove_compare'; symbol: string})
  | (OpBase & {op: 'chart.set_session'; extended_hours: boolean})
  | (OpBase & {op: 'chart.reset'});

export type StudyInputValue = string | number | boolean;
export type PaneTarget = 'overlay' | 'new' | number;

export type StudyOp =
  | (OpBase & {
      op: 'study.add';
      study: string;
      inputs?: Record<string, StudyInputValue>;
      pane?: PaneTarget;
      overrides?: Record<string, unknown>;
      style?: StyleSpec;
    })
  | (OpBase & {op: 'study.remove'; target: Target})
  | (OpBase & {
      op: 'study.update_inputs';
      target: Target;
      inputs: Record<string, StudyInputValue>;
    })
  | (OpBase & {
      op: 'study.update_style';
      target: Target;
      overrides?: Record<string, unknown>;
      style?: StyleSpec;
    })
  | (OpBase & {op: 'study.set_visibility'; target: Target; visible: boolean})
  | (OpBase & {op: 'study.move_pane'; target: Target; pane: PaneTarget})
  | (OpBase & {op: 'study.remove_all'; scope?: EntityScope})
  | (OpBase & {op: 'study.apply_template'; name: string});

export interface PointExpr {
  time: TimeExpr;
  price: PriceExpr;
}

export type DrawOp =
  | (OpBase & {
      op: 'draw.horizontal_line';
      price: PriceExpr;
      extend?: StyleSpec['extend'];
      style?: StyleSpec;
      label?: string;
    })
  | (OpBase & {
      op: 'draw.vertical_line';
      time: TimeExpr;
      style?: StyleSpec;
      label?: string;
    })
  | (OpBase & {
      op: 'draw.trend_line';
      from: PointExpr;
      to: PointExpr;
      extend?: StyleSpec['extend'];
      style?: StyleSpec;
    })
  | (OpBase & {
      op: 'draw.ray';
      from: PointExpr;
      to: PointExpr;
      style?: StyleSpec;
    })
  | (OpBase & {
      op: 'draw.rectangle';
      from: PointExpr;
      to: PointExpr;
      style?: StyleSpec;
    })
  | (OpBase & {
      op: 'draw.ellipse';
      /** TradingView's ellipse tool anchors on 3 points (2 for the bounding axis, 1 for extent), not 2. */
      points: [PointExpr, PointExpr, PointExpr];
      style?: StyleSpec;
    })
  | (OpBase & {
      op: 'draw.circle';
      from: PointExpr;
      to: PointExpr;
      style?: StyleSpec;
    })
  | (OpBase & {
      op: 'draw.zone';
      price_from: PriceExpr;
      price_to: PriceExpr;
      range?: RangeExpr;
      label?: string;
      style?: StyleSpec;
    })
  | (OpBase & {
      op: 'draw.fib_retracement';
      from: PointExpr;
      to: PointExpr;
      levels?: number[];
      style?: StyleSpec;
    })
  | (OpBase & {
      op: 'draw.fib_extension';
      points: [PointExpr, PointExpr, PointExpr];
      levels?: number[];
      style?: StyleSpec;
    })
  | (OpBase & {
      op: 'draw.parallel_channel';
      points: [PointExpr, PointExpr, PointExpr];
      style?: StyleSpec;
    })
  | (OpBase & {
      op: 'draw.regression_channel';
      range?: RangeExpr;
      deviations?: number;
      style?: StyleSpec;
    })
  | (OpBase & {
      op: 'draw.pitchfork';
      points: [PointExpr, PointExpr, PointExpr];
      variant?: 'standard' | 'schiff';
      style?: StyleSpec;
    })
  | (OpBase & {op: 'draw.text'; at: PointExpr; text: string; style?: StyleSpec})
  | (OpBase & {op: 'draw.note'; at: PointExpr; text: string; style?: StyleSpec})
  | (OpBase & {
      op: 'draw.callout';
      at: PointExpr;
      text: string;
      style?: StyleSpec;
    })
  | (OpBase & {
      op: 'draw.arrow';
      at: PointExpr;
      direction: 'up' | 'down';
      style?: StyleSpec;
    })
  | (OpBase & {
      op: 'draw.icon';
      at: PointExpr;
      icon?: string;
      style?: StyleSpec;
    })
  | (OpBase & {
      op: 'draw.price_range';
      from: PointExpr;
      to: PointExpr;
      style?: StyleSpec;
    })
  | (OpBase & {
      op: 'draw.date_range';
      from: PointExpr;
      to: PointExpr;
      style?: StyleSpec;
    })
  | (OpBase & {op: 'draw.anchored_vwap'; from: TimeExpr; style?: StyleSpec})
  | (OpBase & {
      op: 'draw.hud_label';
      x: number;
      y: number;
      text: string;
      style?: StyleSpec;
    });

export type RenderOp =
  | (OpBase & {
      op: 'render.mark_bars';
      source: LiteralBarsSource;
      style?: StyleSpec;
    })
  | (OpBase & {
      op: 'render.highlight_range';
      from: TimeExpr;
      to: TimeExpr;
      style?: StyleSpec;
    })
  | (OpBase & {op: 'render.clear'; tag: string});

export type EditOp =
  | (OpBase & {
      op: 'edit.update';
      target: Target;
      patch: StyleSpec & {overrides?: Record<string, unknown>};
    })
  | (OpBase & {
      op: 'edit.move';
      target: Target;
      to: PointExpr | {price: PriceExpr};
    })
  | (OpBase & {
      op: 'edit.extend';
      target: Target;
      end: 'from' | 'to';
      to: PointExpr;
    })
  | (OpBase & {op: 'edit.delete'; target: Target})
  | (OpBase & {op: 'edit.delete_all'; scope: EntityScope; tag?: string})
  | (OpBase & {op: 'edit.set_lock'; target: Target; locked: boolean})
  | (OpBase & {op: 'edit.group'; targets: Target[]; name?: string})
  | (OpBase & {op: 'edit.undo'; steps?: number});

export type LayoutName = '1' | '2h' | '2v' | '4';

export type LayoutOp =
  | (OpBase & {op: 'layout.split'; layout: LayoutName})
  | (OpBase & {
      op: 'layout.set_pane_height';
      pane: number;
      height_pct: number;
    })
  | (OpBase & {op: 'layout.maximize_pane'; pane: number})
  | (OpBase & {op: 'layout.save_template'; name: string})
  | (OpBase & {op: 'layout.load_template'; name: string})
  | (OpBase & {op: 'layout.screenshot'})
  | (OpBase & {op: 'layout.set_theme'; theme: 'dark' | 'light'});

export type ClarifyOp = OpBase & {
  op: 'clarify.ask';
  question: string;
  options?: string[];
  allow_free_text?: boolean;
};

export type PlanOp =
  ChartOp | StudyOp | DrawOp | RenderOp | EditOp | LayoutOp | ClarifyOp;

export type PlanIntent =
  | 'chart_control'
  | 'indicator'
  | 'draw'
  | 'annotate'
  | 'edit'
  | 'clarify'
  | 'refuse';

/** The chart state the ops were resolved against, echoed back by the model. */
export interface ChartPlanContext {
  period?: string;
  symbol?: string;
  timeframe?: string;
}

export interface ChartPlan {
  v: number;
  utterance_id?: string;
  intent: PlanIntent;
  /** Empty only when `attached` — see below. */
  reply: string;
  confidence?: number;
  undo_group: string;
  assumptions?: string[];
  ops: PlanOp[];
  /**
   * The ops ride a turn already answered elsewhere, so this plan's prose lives on the message
   * stream and `reply` is empty rather than a duplicate voice.
   */
  attached?: boolean;
  /**
   * The live terminal ignores this (its chart is already in that state); a share link reads it
   * to open the pane on the view the drawings were placed on.
   */
  context?: ChartPlanContext;
}

export interface ComputedBar {
  /** Epoch SECONDS. The datafeed's millisecond bar times are normalised on entry. */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * What an op id resolves to: the entities that op created. Both entity spellings together, not
 * either-or: a later `{ref}` picks `entity_id` to name ONE (which is how two instances of the
 * same study are told apart) or `entity_ids` for the batch.
 */
export type OpResult = {entity_id: string; entity_ids: string[]};
