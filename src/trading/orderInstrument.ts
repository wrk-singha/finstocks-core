import {lotSizeFor} from '../data/lotSizes.ts';
import type {OrderProduct, SettlementMode} from '../types/trade.ts';
import {extractUnderlyingSymbol, isFnOSymbol} from '../market/symbols.ts';

/**
 * What an order pad can do, read off the symbol it is placing.
 *
 * These rules were previously spread across the pads and, worse, left to each call site to
 * remember — a caller that forgot to pass the right flag got a pad that quietly refused a
 * legitimate order. They are properties of the instrument, not of whoever opened the screen, so
 * they are derived here once and every pad asks rather than decides.
 */

/**
 * The one flat product enum the wire takes (ManBuyPayload / ManSellPayload:
 * Literal["MIS","CNC","NRML"]).
 *
 * Intraday is MIS whatever the instrument. Only the carried product differs, because a contract
 * cannot be delivered — carrying it is NRML, and sending CNC for an option is simply the wrong
 * code.
 */
export const productFor = (
  symbol: string | undefined,
  settlement: SettlementMode,
): OrderProduct => {
  if (settlement === 'INTRADAY') return 'MIS';
  return isFnOSymbol(symbol) ? 'NRML' : 'CNC';
};

/**
 * Null for equity and for stock options, whose lot needs an instrument master we do not have;
 * callers step in single units rather than guess.
 */
export const lotSizeForSymbol = (symbol: string | undefined): number | null =>
  isFnOSymbol(symbol)
    ? lotSizeFor(extractUnderlyingSymbol(symbol ?? ''))
    : null;
