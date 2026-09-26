/** One test the engine evaluates on a bar: a column, an operator, and a number, expression or column to compare with. */
export type AlertLeaf = {
  var: string;
  op: string;
  val: number | string | boolean;
};

export type AlertCondition =
  AlertLeaf | {logic: 'AND' | 'OR'; conditions: AlertCondition[]};

export type MonitorAction = {
  type: 'ORDER' | 'UPDATE_CONTEXT';
  payload: Record<string, string>;
};

export type MonitorTransition = {
  comment: string;
  condition: AlertCondition;
  next_state: string;
  actions: MonitorAction[];
};

export type MonitorState = {
  on_entry: MonitorAction[];
  on_exit: MonitorAction[];
  on_tick: MonitorAction[];
  transitions: MonitorTransition[];
};

export type MonitorFsm = {
  initial_state: 'IDLE';
  intent: 'monitor';
  variables: string[];
  nlp_triggers: never[];
  states: Record<'IDLE' | 'BOUGHT', MonitorState>;
};

/**
 * The same two-state machine the strategy compiler emits for a simple entry
 * (`_build_simple` in llm/graph/nodes/strategy/alpha/compiler.py), with
 * `intent: "monitor"`. The state is named BOUGHT because that is what the
 * alerts query reads as "matched" (repository/trading/queries.go); in
 * WATCHLIST mode the ORDER action notifies rather than trades, and its
 * `target` names the option contract an F&O alert reads, in the compiler's
 * own spelling (`_compile_target` in fno_compiler.py). No way out of BOUGHT,
 * so an alert fires once — the default every broker uses.
 *
 * Shared between the New alert form and the chat card's reading, so an alert
 * made either way runs the same shape.
 */
export const monitorFsm = (
  condition: AlertCondition,
  target?: string,
): MonitorFsm => {
  const order: Record<string, string> = {side: 'BUY'};
  if (target !== undefined) order.target = target;
  return {
    initial_state: 'IDLE',
    intent: 'monitor',
    variables: ['$entry_price'],
    nlp_triggers: [],
    states: {
      IDLE: {
        on_entry: [],
        on_exit: [],
        on_tick: [],
        transitions: [
          {
            comment: 'Entry',
            condition,
            next_state: 'BOUGHT',
            actions: [
              {type: 'ORDER', payload: order},
              {
                type: 'UPDATE_CONTEXT',
                payload: {key: '$entry_price', value: 'close_price'},
              },
            ],
          },
        ],
      },
      BOUGHT: {on_entry: [], on_exit: [], on_tick: [], transitions: []},
    },
  };
};
