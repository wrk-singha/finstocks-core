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
export {
  formatCompactInr,
  formatCroreCompact,
  formatCurrency,
  formatNumber,
  formatPercent,
  formatQuantity,
  withSign,
} from './format/number';
