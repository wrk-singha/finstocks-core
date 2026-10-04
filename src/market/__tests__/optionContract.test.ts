import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

import {priceSymbolFor} from '../livePrice.ts';
import {buildOptionContractSymbol} from '../optionChain.ts';
import {
  catalogueWeekday,
  exchangeSymbol,
  expiryCycle,
  isExchangeSymbol,
  monthLastExpiries,
  monthlyExpiries,
  type OptionContract,
  optionContractOf,
  type OptionContractParams,
  optionPath,
  parseOptionSymbol,
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

test('a link that repeats a field reads its first value, and a field that is not text reads as none', () => {
  // query-string hands a repeated key over as an array; web's URLSearchParams.get takes the first.
  const repeated = {
    underlying: ['TATASTEEL', 'INFY'],
    expiry: ['2026-09-29', '2026-10-27'],
    strike: ['187.5', '190'],
    right: ['CE', 'PE'],
  } as unknown as OptionContractParams;
  assert.deepEqual(readOptionContract(repeated), tataSteel);

  const valid = {
    underlying: 'TATASTEEL',
    expiry: '2026-09-29',
    strike: '187.5',
    right: 'CE',
  };
  const odd: Record<string, unknown> = {
    'an object underlying': {underlying: {name: 'TATASTEEL'}},
    'a numeric expiry': {expiry: 20260929},
    'an empty expiry list': {expiry: []},
    'an object strike': {strike: {value: 187.5}},
    'a boolean right': {right: true},
  };
  for (const [reason, patch] of Object.entries(odd)) {
    const params = {...valid, ...(patch as object)} as OptionContractParams;
    assert.doesNotThrow(() => readOptionContract(params), reason);
    assert.equal(readOptionContract(params), null, reason);
  }
});

// The stock options here list monthlies only: each date is its month's last listed expiry, inside
// the month's last seven days.
const STOCK_MONTHLIES = [
  '2026-09-29',
  '2026-10-27',
  '2026-12-29',
  '2027-01-28',
];

test('the exchange ticker keeps a decimal strike and the odd underlyings', () => {
  assert.equal(
    exchangeSymbol(tataSteel, STOCK_MONTHLIES),
    'TATASTEEL26SEP187.5CE',
  );
  assert.equal(
    exchangeSymbol(
      {
        underlying: 'ADANIENT',
        expiry: '2026-09-29',
        strike: 3100,
        right: 'CE',
      },
      STOCK_MONTHLIES,
    ),
    'ADANIENT26SEP3100CE',
  );
  assert.equal(
    exchangeSymbol(
      {
        underlying: 'BAJAJ-AUTO',
        expiry: '2027-01-28',
        strike: 9000,
        right: 'PE',
      },
      STOCK_MONTHLIES,
    ),
    'BAJAJ-AUTO27JAN9000PE',
  );
  assert.equal(
    exchangeSymbol(
      {
        underlying: 'NIFTYNXT50',
        expiry: '2026-12-29',
        strike: 70000,
        right: 'CE',
      },
      STOCK_MONTHLIES,
    ),
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
    // Month-named with the list in hand, dated without it: both are contract tickers.
    for (const catalogue of [STOCK_MONTHLIES, null]) {
      assert.equal(
        isExchangeSymbol(exchangeSymbol(contract, catalogue)),
        true,
        exchangeSymbol(contract, catalogue),
      );
    }
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

// NIFTY as the expiries endpoint listed it on 4 Oct 2026: Tuesday weeklies, the month's last
// Tuesday its monthly, and November's monthly a day early because Tuesday 24 Nov is a holiday.
const NIFTY = [
  '2026-10-06',
  '2026-10-13',
  '2026-10-20',
  '2026-10-27',
  '2026-11-03',
  '2026-11-10',
  '2026-11-17',
  '2026-11-23',
];

const nifty = (
  expiry: string,
  strike = 23150,
  right: 'CE' | 'PE' = 'CE',
): OptionContract => ({underlying: 'NIFTY', expiry, strike, right});

test('a weekly is spelled by its date and the monthly by its month', () => {
  assert.equal(exchangeSymbol(nifty('2026-10-06'), NIFTY), 'NIFTY26O0623150CE');
  assert.equal(exchangeSymbol(nifty('2026-10-20'), NIFTY), 'NIFTY26O2023150CE');
  assert.equal(exchangeSymbol(nifty('2026-10-27'), NIFTY), 'NIFTY26OCT23150CE');
  assert.equal(
    exchangeSymbol(nifty('2026-11-03', 23150, 'PE'), NIFTY),
    'NIFTY26N0323150PE',
  );
});

test("a weekly's month is one character: 1 to 9, then O, N and D", () => {
  const spelled = [
    ['2026-01-06', 'NIFTY2610623150CE'],
    ['2026-02-03', 'NIFTY2620323150CE'],
    ['2026-03-10', 'NIFTY2631023150CE'],
    ['2026-04-07', 'NIFTY2640723150CE'],
    ['2026-05-05', 'NIFTY2650523150CE'],
    ['2026-06-02', 'NIFTY2660223150CE'],
    ['2026-07-07', 'NIFTY2670723150CE'],
    ['2026-08-04', 'NIFTY2680423150CE'],
    ['2026-09-22', 'NIFTY2692223150CE'],
    ['2026-10-06', 'NIFTY26O0623150CE'],
    ['2026-11-03', 'NIFTY26N0323150CE'],
    ['2026-12-01', 'NIFTY26D0123150CE'],
  ] as const;
  for (const [expiry, ticker] of spelled) {
    // No catalogue: the dated form, whatever the date.
    assert.equal(exchangeSymbol(nifty(expiry), null), ticker);
    assert.deepEqual(parseOptionSymbol(ticker), {
      underlying: 'NIFTY',
      month: expiry.slice(0, 7),
      expiry,
      strike: 23150,
      right: 'CE',
    });
  }
});

test('every month name spells and reads back as that month', () => {
  const names = [
    'JAN',
    'FEB',
    'MAR',
    'APR',
    'MAY',
    'JUN',
    'JUL',
    'AUG',
    'SEP',
    'OCT',
    'NOV',
    'DEC',
  ];
  names.forEach((name, index) => {
    const month = `2027-${String(index + 1).padStart(2, '0')}`;
    // One listed date, in the month's last week: its monthly.
    const expiry = `${month}-26`;
    const ticker = `RELIANCE27${name}1400PE`;
    assert.equal(
      exchangeSymbol(
        {underlying: 'RELIANCE', expiry, strike: 1400, right: 'PE'},
        [expiry],
      ),
      ticker,
    );
    assert.deepEqual(parseOptionSymbol(ticker), {
      underlying: 'RELIANCE',
      month,
      strike: 1400,
      right: 'PE',
    });
    assert.deepEqual(optionContractOf(ticker, [expiry]), {
      underlying: 'RELIANCE',
      expiry,
      strike: 1400,
      right: 'PE',
    });
  });
});

test('a ticker in any of the three spellings reads back as its contract', () => {
  // The ISO date: what `buildOptionContractSymbol` writes for an order today.
  const iso = buildOptionContractSymbol('NIFTY', '2026-10-06', 23150, 'CE');
  assert.equal(iso, 'NIFTY2026100623150CE');
  assert.deepEqual(parseOptionSymbol(iso), {
    underlying: 'NIFTY',
    month: '2026-10',
    expiry: '2026-10-06',
    strike: 23150,
    right: 'CE',
  });
  assert.deepEqual(optionContractOf(iso, null), nifty('2026-10-06'));

  // The weekly: its own date, with or without a catalogue.
  assert.deepEqual(
    optionContractOf('NIFTY26O0623150CE', NIFTY),
    nifty('2026-10-06'),
  );
  assert.deepEqual(
    optionContractOf('NIFTY26O0623150CE', undefined),
    nifty('2026-10-06'),
  );

  // The month name: no day of its own, so the catalogue's monthly for that month.
  assert.deepEqual(parseOptionSymbol('NIFTY26OCT23150CE'), {
    underlying: 'NIFTY',
    month: '2026-10',
    strike: 23150,
    right: 'CE',
  });
  assert.deepEqual(
    optionContractOf('NIFTY26OCT23150CE', NIFTY),
    nifty('2026-10-27'),
  );
  assert.deepEqual(
    optionContractOf('NIFTY26NOV23150PE', NIFTY),
    nifty('2026-11-23', 23150, 'PE'),
  );

  // Read in any case and with stray spaces, as the backend reads it.
  assert.deepEqual(
    optionContractOf('  nifty26o0623150ce ', null),
    nifty('2026-10-06'),
  );
});

test('spelling a contract and reading it back gives the contract', () => {
  for (const expiry of NIFTY) {
    for (const right of ['CE', 'PE'] as const) {
      const contract = nifty(expiry, 24000, right);
      assert.deepEqual(
        optionContractOf(exchangeSymbol(contract, NIFTY), NIFTY),
        contract,
        expiry,
      );
      // The dated fallback names the same contract, monthly or not.
      assert.deepEqual(
        optionContractOf(exchangeSymbol(contract, null), null),
        contract,
        expiry,
      );
    }
  }
});

test('a month-named ticker names no contract when the catalogue cannot date it', () => {
  // No list, an empty list, a month the list no longer carries, and a month whose only listed
  // dates are weeklies.
  assert.equal(optionContractOf('NIFTY26OCT23150CE', null), null);
  assert.equal(optionContractOf('NIFTY26OCT23150CE', undefined), null);
  assert.equal(optionContractOf('NIFTY26OCT23150CE', []), null);
  assert.equal(optionContractOf('NIFTY26SEP23150CE', NIFTY), null);
  assert.equal(
    optionContractOf('NIFTY26OCT23150CE', ['2026-10-06', '2026-10-13']),
    null,
  );
});

test('what is not an option ticker reads as nothing', () => {
  for (const symbol of [
    '',
    'RELIANCE',
    'NIFTY 50',
    'RELIANCE-EQ',
    'NIFTY26SEPFUT',
    // A three-letter run that is not a month.
    'NIFTY26XYZ23150CE',
    // Neither right.
    'NIFTY26OCT23150XX',
    // The chain's own join key.
    '23450_PE',
  ]) {
    assert.equal(parseOptionSymbol(symbol), null, symbol);
    assert.equal(optionContractOf(symbol, NIFTY), null, symbol);
  }
});

test('the monthly is the last listed date of its month, in the last seven days', () => {
  assert.deepEqual([...monthLastExpiries(NIFTY)].sort(), [
    '2026-10-27',
    '2026-11-23',
  ]);
  assert.deepEqual([...monthlyExpiries(NIFTY)].sort(), [
    '2026-10-27',
    '2026-11-23',
  ]);
  assert.equal(expiryCycle('2026-10-06', NIFTY), 'weekly');
  assert.equal(expiryCycle('2026-10-20', NIFTY), 'weekly');
  assert.equal(expiryCycle('2026-10-27', NIFTY), 'monthly');
  assert.equal(expiryCycle('2026-11-17', NIFTY), 'weekly');
  assert.equal(expiryCycle('2026-11-23', NIFTY), 'monthly');
});

test('a month listed without its monthly spells its last weekly by date', () => {
  // The list is "traded in the last seven days" and capped, so it can stop mid-month: the 20th
  // is October's last listed date here, and the month-named ticker would be the 27th's.
  const cut = ['2026-10-06', '2026-10-13', '2026-10-20'];
  assert.deepEqual([...monthLastExpiries(cut)], ['2026-10-20']);
  assert.deepEqual([...monthlyExpiries(cut)], []);
  assert.equal(expiryCycle('2026-10-13', cut), 'weekly');
  assert.equal(expiryCycle('2026-10-20', cut), null);
  assert.equal(exchangeSymbol(nifty('2026-10-20'), cut), 'NIFTY26O2023150CE');
});

test("the last-seven-days window is counted from each month's own end", () => {
  // [expiry, days from the month's end, monthly?]. Each list is the one date, so no weekday
  // stands out and nothing is moved.
  const edges = [
    ['2026-10-25', true], // 31-day month: 6 from the end
    ['2026-10-24', false], // 7 from the end
    ['2026-10-31', true], // the last day itself
    ['2026-11-24', true], // 30-day month: 6 from the end
    ['2026-11-23', false],
    ['2027-02-22', true], // 28-day February
    ['2027-02-21', false],
    ['2028-02-23', true], // 29-day February
    ['2028-02-22', false],
    ['2026-12-25', true], // a year's end
    ['2026-12-24', false],
  ] as const;
  for (const [expiry, isMonthly] of edges) {
    assert.equal(monthlyExpiries([expiry]).has(expiry), isMonthly, expiry);
    assert.equal(
      expiryCycle(expiry, [expiry]),
      isMonthly ? 'monthly' : null,
      expiry,
    );
  }
});

test('a monthly moved back by a holiday is counted on the day it moved from', () => {
  // Tuesday 24 Nov 2026 is a holiday, so the monthly trades Monday the 23rd: eight days from the
  // end by its own date, six by the Tuesday it stands for.
  assert.equal(catalogueWeekday(NIFTY), 2);
  assert.equal(monthlyExpiries(NIFTY).has('2026-11-23'), true);
  assert.equal(exchangeSymbol(nifty('2026-11-23'), NIFTY), 'NIFTY26NOV23150CE');

  // Up to four days back, which is a holiday run over a weekend: Friday for a Tuesday.
  const tuesdays = ['2026-10-06', '2026-10-13', '2026-10-27', '2026-11-03'];
  assert.equal(
    monthlyExpiries([...tuesdays, '2026-11-20']).has('2026-11-20'),
    true,
  );
  // Five days back is a Thursday: not a moved Tuesday, and ten days from the end.
  assert.equal(
    monthlyExpiries([...tuesdays, '2026-11-19']).has('2026-11-19'),
    false,
  );
  // A date after the usual weekday is never read as moved: Wednesday 18 Nov stays the 18th.
  assert.equal(
    monthlyExpiries([...tuesdays, '2026-11-18']).has('2026-11-18'),
    false,
  );
  // The day it would stand for falls in the next month: its own date is kept. Monday 30 Nov
  // stands for Tuesday 1 Dec, and is the month's last day either way.
  assert.equal(
    monthlyExpiries([...tuesdays, '2026-11-30']).has('2026-11-30'),
    true,
  );
});

test('no weekday stands out: nothing is read as moved', () => {
  // One Tuesday and one Monday tie, so the 23rd is counted as the 23rd: seven from the end.
  const tied = ['2026-10-27', '2026-11-23'];
  assert.equal(catalogueWeekday(tied), null);
  assert.deepEqual([...monthlyExpiries(tied)], ['2026-10-27']);
  assert.equal(exchangeSymbol(nifty('2026-11-23'), tied), 'NIFTY26N2323150CE');
  assert.equal(catalogueWeekday([]), null);
  // A date that is no date is not counted.
  assert.equal(catalogueWeekday(['not-a-date', '2026-10-27']), 2);
});

test('an underlying that lists only monthlies spells every one by its month', () => {
  const monthlies = ['2026-10-27', '2026-11-24', '2026-12-29'];
  assert.deepEqual([...monthlyExpiries(monthlies)].sort(), monthlies);
  for (const expiry of monthlies) {
    assert.equal(expiryCycle(expiry, monthlies), 'monthly');
  }
  const reliance = (expiry: string): OptionContract => ({
    underlying: 'RELIANCE',
    expiry,
    strike: 1400,
    right: 'CE',
  });
  assert.equal(
    exchangeSymbol(reliance('2026-10-27'), monthlies),
    'RELIANCE26OCT1400CE',
  );
  assert.equal(
    exchangeSymbol(reliance('2026-12-29'), monthlies),
    'RELIANCE26DEC1400CE',
  );
});

test('with no catalogue, or one that does not list the date, the ticker is dated', () => {
  for (const catalogue of [null, undefined, []]) {
    assert.equal(expiryCycle('2026-10-27', catalogue), null);
    assert.equal(
      exchangeSymbol(nifty('2026-10-27'), catalogue),
      'NIFTY26O2723150CE',
    );
  }
  // Another underlying's date: not listed, and nothing later in its month is.
  assert.equal(expiryCycle('2026-10-29', NIFTY), null);
  assert.equal(exchangeSymbol(nifty('2026-10-29'), NIFTY), 'NIFTY26O2923150CE');
  // Not listed, but a later date in its month is: a weekly, by date all the same.
  assert.equal(expiryCycle('2026-10-08', NIFTY), 'weekly');
  assert.equal(exchangeSymbol(nifty('2026-10-08'), NIFTY), 'NIFTY26O0823150CE');
});

test('an expiry that names only a month is spelled by the month', () => {
  // No day to write a dated ticker with.
  assert.equal(exchangeSymbol(nifty('2026-10'), null), 'NIFTY26OCT23150CE');
});

test('a decimal strike keeps its point in every spelling', () => {
  const contract: OptionContract = {
    underlying: 'RELIANCE',
    expiry: '2026-09-29',
    strike: 1402.5,
    right: 'CE',
  };
  assert.equal(
    exchangeSymbol(contract, ['2026-09-29']),
    'RELIANCE26SEP1402.5CE',
  );
  assert.equal(exchangeSymbol(contract, null), 'RELIANCE269291402.5CE');
  assert.deepEqual(
    optionContractOf('RELIANCE26SEP1402.5CE', ['2026-09-29']),
    contract,
  );
  assert.deepEqual(optionContractOf('RELIANCE269291402.5CE', null), contract);
  assert.deepEqual(
    optionContractOf('RELIANCE202609291402.5CE', null),
    contract,
  );
  // Under three digits before the point: the month-named form reads it.
  assert.deepEqual(parseOptionSymbol('IDEA26SEP7.5CE'), {
    underlying: 'IDEA',
    month: '2026-09',
    strike: 7.5,
    right: 'CE',
  });
  assert.deepEqual(parseOptionSymbol('YESBANK26SEP22.5PE'), {
    underlying: 'YESBANK',
    month: '2026-09',
    strike: 22.5,
    right: 'PE',
  });
});

test('underlyings with an ampersand, a hyphen and digits read back whole', () => {
  const catalogue = ['2026-10-06', '2026-10-13', '2026-10-27'];
  for (const underlying of ['M&M', 'BAJAJ-AUTO', 'NIFTYNXT50', 'MCDOWELL-N']) {
    const monthly: OptionContract = {
      underlying,
      expiry: '2026-10-27',
      strike: 3200,
      right: 'PE',
    };
    const weekly: OptionContract = {...monthly, expiry: '2026-10-06'};
    assert.equal(
      exchangeSymbol(monthly, catalogue),
      `${underlying}26OCT3200PE`,
    );
    assert.equal(exchangeSymbol(weekly, catalogue), `${underlying}26O063200PE`);
    assert.deepEqual(
      optionContractOf(exchangeSymbol(monthly, catalogue), catalogue),
      monthly,
    );
    assert.deepEqual(
      optionContractOf(exchangeSymbol(weekly, catalogue), catalogue),
      weekly,
    );
    // The ISO date an order carries today reads back too, where the underlying ends in a letter
    // (the limits below have the one that does not).
    if (underlying !== 'NIFTYNXT50') {
      assert.deepEqual(
        optionContractOf(
          buildOptionContractSymbol(underlying, '2026-10-06', 3200, 'PE'),
          null,
        ),
        weekly,
      );
    }
  }
});

// The limits of the dated spellings, as web and the backend have them. Pinned so a fix on either
// side shows up here, not so they stay.
test('the limits of the dated spellings: a strike under three digits, and an underlying that ends in digits', () => {
  // The dated forms ask for a strike of three to six digits, so a dated ticker for a strike
  // under 100 reads as nothing. Such underlyings list monthlies only, so with the catalogue in
  // hand they are month-named, which does read.
  const idea: OptionContract = {
    underlying: 'IDEA',
    expiry: '2026-09-29',
    strike: 7.5,
    right: 'CE',
  };
  assert.equal(exchangeSymbol(idea, null), 'IDEA269297.5CE');
  assert.equal(parseOptionSymbol('IDEA269297.5CE'), null);
  assert.equal(exchangeSymbol(idea, ['2026-09-29']), 'IDEA26SEP7.5CE');

  // The ISO form is tried first, and an underlying ending in digits followed by a one-digit
  // month can fill it: NIFTYNXT50's dated September ticker reads as "NIFTYNXT" on a date that
  // is none. October to December carry a letter and read right.
  const next50: OptionContract = {
    underlying: 'NIFTYNXT50',
    expiry: '2026-09-29',
    strike: 70000,
    right: 'CE',
  };
  const dated = exchangeSymbol(next50, null);
  assert.equal(dated, 'NIFTYNXT502692970000CE');
  assert.equal(parseOptionSymbol(dated)?.underlying, 'NIFTYNXT');
  assert.deepEqual(
    optionContractOf(
      exchangeSymbol({...next50, expiry: '2026-10-27'}, null),
      null,
    ),
    {...next50, expiry: '2026-10-27'},
  );
  // The ISO date an order carries today has no letter in any month, so it is misread the same
  // way all year: NIFTYNXT50's 27 Oct 70000 CE reads as "NIFTYNXT5" on a date that is none.
  const iso = buildOptionContractSymbol(
    'NIFTYNXT50',
    '2026-10-27',
    70000,
    'CE',
  );
  assert.equal(iso, 'NIFTYNXT502026102770000CE');
  assert.deepEqual(parseOptionSymbol(iso), {
    underlying: 'NIFTYNXT5',
    month: '0202-61',
    expiry: '0202-61-02',
    strike: 770000,
    right: 'CE',
  });
});

// A known defect of web's rule, pinned so it is seen here when web fixes it, not so it stays.
// The weekday a moved monthly is counted on is read off the list, and a list of monthlies only,
// two of them moved, has no weekday to read. Tuesday 24 Nov 2026 and Tuesday 26 Jan 2027 are
// holidays, so those monthlies expire on Monday 23 Nov and Monday 25 Jan. Once October's has
// expired a stock's list holds a Monday majority, a tie, or the one Monday, and the 23rd is
// counted as the 23rd: seven days from the month's end, one too many.
test('KNOWN DEFECT (web’s rule): a moved monthly on a monthlies-only list is read as no monthly', () => {
  const reliance: OptionContract = {
    underlying: 'RELIANCE',
    expiry: '2026-11-23',
    strike: 1400,
    right: 'CE',
  };
  for (const listed of [
    ['2026-11-23', '2026-12-29', '2027-01-25'],
    ['2026-11-23', '2026-12-29'],
    ['2026-11-23'],
  ]) {
    assert.equal(monthlyExpiries(listed).has('2026-11-23'), false);
    assert.equal(expiryCycle('2026-11-23', listed), null);
    // The exchange lists RELIANCE26NOV1400CE. Mobile corrects this in its own display layer.
    assert.equal(exchangeSymbol(reliance, listed), 'RELIANCE26N231400CE');
    assert.equal(optionContractOf('RELIANCE26NOV1400CE', listed), null);
  }
  // With October's Tuesday still listed and January's Monday not yet, Tuesday is the list's
  // weekday and the rule holds. A fourth month ties the two weekdays and loses it again.
  const withOctober = ['2026-10-27', '2026-11-23', '2026-12-29'];
  assert.equal(catalogueWeekday(withOctober), 2);
  assert.equal(exchangeSymbol(reliance, withOctober), 'RELIANCE26NOV1400CE');
  const fourMonths = [...withOctober, '2027-01-25'];
  assert.equal(catalogueWeekday(fourMonths), null);
  assert.equal(exchangeSymbol(reliance, fourMonths), 'RELIANCE26N231400CE');
});

// This cannot see the backend drift. It compares the three patterns in this package with a COPY
// of the backend's, pasted below from backend-go main (internal/market/fnocontract/
// fnocontract.go, read 4 Oct 2026). It fails when core's patterns move away from that copy; a
// change on the backend is seen only when someone pastes the new patterns here.
test("the three option patterns match the copy of the backend's pasted here", () => {
  // A ticker read as a weekly on one side and a monthly on the other names two contracts.
  const backend = {
    OPTION_MONTHLY_RE: String.raw`^([A-Z0-9&-]+?)(\d{2})([A-Z]{3})(\d+(?:\.\d+)?)(CE|PE)$`,
    OPTION_WEEKLY_RE: String.raw`^([A-Z0-9&-]+?)(\d{2})([1-9OND])(\d{2})(\d{3,6}(?:\.\d+)?)(CE|PE)$`,
    OPTION_ISO_RE: String.raw`^([A-Z0-9&-]+?)(\d{4})(\d{2})(\d{2})(\d{3,6}(?:\.\d+)?)(CE|PE)$`,
  };
  const source = readFileSync(
    new URL('../optionContract.ts', import.meta.url),
    'utf8',
  );
  for (const [name, pattern] of Object.entries(backend)) {
    const found = new RegExp(`const ${name} =\\s*/(.+?)/;`).exec(source);
    assert.equal(found?.[1], pattern, name);
  }
});
