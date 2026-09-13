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
export * from './api/index.ts';
export {queryKeys} from './queryKeys.ts';
export {DEFAULT_TIMEFRAME, TIMEFRAME_OPTIONS} from './types/screenerFilters.ts';
export type * from './types/index.ts';
