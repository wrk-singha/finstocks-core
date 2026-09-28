import assert from 'node:assert/strict';
import {test} from 'node:test';

import {priceSymbolFor} from '../livePrice.ts';
import {
  exchangeSymbol,
  isExchangeSymbol,
  type OptionContract,
  type OptionContractParams,
  optionPath,
  readOptionContract,
} from '../optionContract.ts';

const tataSteel: OptionContract = {
  underlying: 'TATASTEEL',
  expiry: '2026-09-29',
  strike: 187.5,
  right: 'CE',
};

test('an address that names every field reads as the contract', () => {
  assert.deepEqual(
    readOptionContract({
      underlying: 'adanient',
      expiry: '2026-09-29',
      strike: '3100',
      right: 'PE',
    }),
    {underlying: 'ADANIENT', expiry: '2026-09-29', strike: 3100, right: 'PE'},
  );
  assert.deepEqual(
    readOptionContract({
      underlying: ' TATASTEEL ',
      expiry: '2026-09-29',
      strike: ' 187.5 ',
      right: 'CE',
    }),
    tataSteel,
  );
  // In-app callers may hand the strike over as the number it already is.
  assert.deepEqual(
    readOptionContract({...tataSteel, strike: 187.5}),
    tataSteel,
  );
  assert.deepEqual(
    readOptionContract({
      underlying: 'M&M',
      expiry: '2026-09-29',
      strike: '3200',
      right: 'CE',
    })?.underlying,
    'M&M',
  );
});

test('an address missing or garbling any field names no contract', () => {
  const valid = {
    underlying: 'TATASTEEL',
    expiry: '2026-09-29',
    strike: '187.5',
    right: 'CE',
  };
  const broken: Record<string, OptionContractParams> = {
    'no underlying': {underlying: undefined},
    'blank underlying': {underlying: '  '},
    'an underlying no ticker spells': {underlying: 'NIFTY 50'},
    'no expiry': {expiry: null},
    'a month without a day': {expiry: '2026-09'},
    'a day-first date': {expiry: '29-09-2026'},
    'an unpadded month': {expiry: '2026-9-29'},
    'a day the month does not have': {expiry: '2026-02-30'},
    'a thirteenth month': {expiry: '2026-13-01'},
    'no strike': {strike: undefined},
    'an empty strike': {strike: ''},
    'a zero strike': {strike: '0'},
    'a negative strike': {strike: '-100'},
    'a strike that is not a number': {strike: 'abc'},
    'a strike in exponent form': {strike: '1e3'},
    'a strike that is not finite': {strike: Number.POSITIVE_INFINITY},
    'no right': {right: undefined},
    'a futures right': {right: 'FUT'},
    'a lower-case right': {right: 'ce'},
  };
  for (const [reason, patch] of Object.entries(broken)) {
    assert.equal(readOptionContract({...valid, ...patch}), null, reason);
  }
});

test('the exchange ticker keeps a decimal strike and the odd underlyings', () => {
  assert.equal(exchangeSymbol(tataSteel), 'TATASTEEL26SEP187.5CE');
  assert.equal(
    exchangeSymbol({
      underlying: 'ADANIENT',
      expiry: '2026-09-29',
      strike: 3100,
      right: 'CE',
    }),
    'ADANIENT26SEP3100CE',
  );
  assert.equal(
    exchangeSymbol({
      underlying: 'BAJAJ-AUTO',
      expiry: '2027-01-28',
      strike: 9000,
      right: 'PE',
    }),
    'BAJAJ-AUTO27JAN9000PE',
  );
  assert.equal(
    exchangeSymbol({
      underlying: 'NIFTYNXT50',
      expiry: '2026-12-29',
      strike: 70000,
      right: 'CE',
    }),
    'NIFTYNXT5026DEC70000CE',
  );
});

test('every ticker a contract builds is one the grammar accepts', () => {
  const contracts: OptionContract[] = [
    tataSteel,
    {underlying: 'M&M', expiry: '2026-09-29', strike: 3200, right: 'PE'},
    {underlying: 'BAJAJ-AUTO', expiry: '2026-10-27', strike: 9000, right: 'CE'},
    {
      underlying: 'NIFTYNXT50',
      expiry: '2026-12-29',
      strike: 70000,
      right: 'PE',
    },
  ];
  for (const contract of contracts) {
    assert.equal(isExchangeSymbol(exchangeSymbol(contract)), true);
  }
});

test('the grammar tells contract tickers from equity symbols', () => {
  for (const contract of [
    'TATASTEEL26SEP187.5CE',
    'NIFTY2681824400PE',
    'NIFTY26SEPFUT',
    'M&M26SEPFUT',
    'BAJAJ-AUTO26SEP9000CE',
    'NIFTYNXT5026DEC70000PE',
  ]) {
    assert.equal(isExchangeSymbol(contract), true, contract);
  }
  for (const equity of [
    'RELIANCE',
    'RELIANCE-EQ',
    'NIFTY',
    'NIFTY 50',
    'BSE500IETF',
    'tatasteel26sep187.5ce',
  ]) {
    assert.equal(isExchangeSymbol(equity), false, equity);
  }
});

test('pricing reads a decimal-strike contract against its own series', () => {
  assert.equal(
    priceSymbolFor('tatasteel26sep187.5ce'),
    'TATASTEEL26SEP187.5CE',
  );
});

test('the web address carries the three fields a ticker cannot', () => {
  assert.equal(
    optionPath(tataSteel),
    '/options/TATASTEEL?expiry=2026-09-29&strike=187.5&right=CE',
  );
  assert.equal(
    optionPath({...tataSteel, underlying: 'M&M'}),
    '/options/M%26M?expiry=2026-09-29&strike=187.5&right=CE',
  );
});
