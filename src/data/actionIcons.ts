/**
 * One symbol per action, wherever that action is offered, as lucide icon names.
 *
 * Backtest and Strategy are the composer tool menu's own icons, so the pill that starts a
 * backtest from an answer carries the same mark as the tool that starts one from the composer.
 * Chart is the terminal's icon rather than `chart-line`, which is a chart *type* beside it in
 * the price-range chart's mode toggle.
 *
 * Core carries the name only; each app resolves it to its own lucide component
 * (`lucide-react` `Zap`/`PieChart`/… on web, `lucide-react-native/icons/<name>` on mobile).
 */
export const ACTION_ICON_NAMES = {
  autopilot: 'zap',
  backtest: 'chart-pie',
  strategy: 'pencil-line',
  research: 'search',
  compare: 'scale',
  alert: 'bell',
  chart: 'chart-candlestick',
} as const;

export type ActionIconKey = keyof typeof ACTION_ICON_NAMES;

export type ActionIconName = (typeof ACTION_ICON_NAMES)[ActionIconKey];
