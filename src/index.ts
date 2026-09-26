// @finstocks/core — pure TypeScript shared by the mobile and web apps.
// No React, React Native, DOM, fetch, or storage imports are allowed here (lint-enforced).
// Modules land per SHARED-CORE.md (finstocks-migration): types, market, trading, strategy,
// screener, data, format, queryKeys, api, events, tokens (generated).
export const CORE_PACKAGE = '@finstocks/core' as const;
export {
  color,
  colorLight,
  colorDark,
  type,
  space,
  radius,
  layout,
  zIndex,
  elevation,
  motion,
} from './tokens';
export type {
  ColorScheme,
  ColorTokens,
  TypeRole,
  SpaceStep,
  RadiusStep,
} from './tokens';

export * from './format/index.ts';
export * from './data/index.ts';
export * from './market/index.ts';
export * from './trading/index.ts';
export * from './strategy/index.ts';
export * from './screener/index.ts';
export * from './portfolio/index.ts';
export * from './fundamentals/index.ts';
export * from './api/index.ts';
export {queryKeys} from './queryKeys.ts';
// Runtime values that live beside their types (types/index.ts is type-only).
export {DEFAULT_TIMEFRAME, TIMEFRAME_OPTIONS} from './types/screenerFilters.ts';
export {
  CHART_INTERVAL_LABEL,
  CHART_INTERVAL_RESOLUTION,
  fetchIntervalFor,
  initialPeriodForInterval,
  widestPeriodForInterval,
} from './types/graphData.ts';
export {KNOWN_LOG_LEVELS} from './types/strategyLogs.ts';
export {DEFAULT_RANGE, PLAN_VERSION} from './types/chartPlan.ts';
export {SPOT_MODES} from './types/terminal.ts';
export type * from './types/index.ts';
