import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {AnnouncementRow} from '../../api/market.ts';
import type {GetDividendsResponse} from '../../types/dividends.ts';
import type {FundamentalsCorporateAction} from '../../types/fundamentals.ts';
import type {
  CorporateActionEntry,
  CorporateFiling,
  StockEvent,
} from '../../types/stockEvents.ts';
import {
  ACTION_GROUPS,
  actionGroupOf,
  buildCorporateActions,
  buildExchangeFilings,
  capitalActionsByYear,
  dividendKey,
  eventTime,
  familyOf,
  filingKind,
  filingTitle,
  groupCorporateActions,
  isValidDate,
} from '../corporateActions.ts';

const REG_30 = 'Announcement under Regulation 30 (LODR)-';

const dividend = (
  fields: Partial<GetDividendsResponse> = {},
): GetDividendsResponse => ({
  stock_symbol: 'RELIANCE',
  stock_name: null,
  dividend_type: 'Final',
  dividend_amount: 10,
  dividend_percentage: null,
  record_date: null,
  ex_date: null,
  payment_date: null,
  announcement_date: null,
  announcement_title: null,
  announcement_link: null,
  announcement_summary: null,
  ...fields,
});

const event = (
  category: StockEvent['category'],
  date: string,
  fields: Partial<StockEvent> = {},
): StockEvent => ({
  symbol: 'RELIANCE',
  company_name: 'Reliance Industries',
  category,
  label: '',
  event_date: date,
  detail: '',
  cap_band: 'large',
  ...fields,
});

const filing = (
  newsId: string,
  category: CorporateFiling['category'],
  datetime: string | null,
  fields: Partial<CorporateFiling> = {},
): CorporateFiling => ({
  news_id: newsId,
  datetime,
  caption: '',
  details: '',
  attachment_url: '',
  category,
  ...fields,
});

const announcement = (
  newsId: string,
  datetime: string,
  caption: string,
  fields: Partial<AnnouncementRow> = {},
): AnnouncementRow => ({
  news_id: newsId,
  scripcode: 500325,
  datetime,
  caption,
  details: '',
  attachment_url: '',
  announcement_type: 'general',
  meeting_type: '',
  meeting_date: null,
  updated_at: '',
  ...fields,
});

const rows = (entries: readonly CorporateActionEntry[]) =>
  entries.map(entry => [entry.date, entry.family, entry.subtitle]);

test('each feed’s wording reduces to one family', () => {
  assert.equal(familyOf('Final Dividend'), 'dividend');
  assert.equal(familyOf('EX Dividend'), 'dividend');
  assert.equal(familyOf('Bonus issue'), 'bonus');
  assert.equal(familyOf('reverse_split Reverse Split'), 'split');
  assert.equal(familyOf('Change in face value'), 'split');
  assert.equal(familyOf('Rights Issue'), 'rights');
  assert.equal(familyOf('Buy-back of shares'), 'buyback');
  assert.equal(familyOf('Preferential allotment'), 'preferential');
  assert.equal(familyOf('Allotment under ESOS 2017'), 'esop');
  assert.equal(familyOf('Employees Stock Option Plan'), 'esop');
  assert.equal(familyOf('Scheme of Arrangement'), 'demerger');
  assert.equal(familyOf('Amalgamation of subsidiaries'), 'merger');
  assert.equal(familyOf('results Board meeting'), 'results');
  assert.equal(familyOf('AGM'), 'agm');
  assert.equal(familyOf('Extraordinary General Meeting'), 'agm');
  assert.equal(familyOf('Book closure'), 'book_closure');
  assert.equal(familyOf('acquisition Acquisition'), 'other');
});

test('a filing is titled by its subject, not the statute it was filed under', () => {
  assert.equal(filingTitle(`${REG_30}Credit Rating`), 'Credit Rating');
  assert.equal(
    filingTitle('Intimation under Regulation 29: Board Meeting'),
    'Board Meeting',
  );
  // The vendor doubles an apostrophe to escape it.
  assert.equal(
    filingTitle(`  ${REG_30}Investors''  Meeting `),
    "Investors' Meeting",
  );
  // A caption that is only the statute falls back to the declared type, never to "general".
  assert.equal(
    filingTitle(REG_30, 'outcome_of_board_meeting'),
    'Outcome of board meeting',
  );
  assert.equal(filingTitle(REG_30, 'general_announcement'), null);
  assert.equal(filingTitle('', null), null);
});

test('a filing’s declared type becomes one of four kinds', () => {
  assert.equal(filingKind('Outcome_of_Board_Meeting'), 'outcome');
  assert.equal(filingKind('intimation'), 'intimation');
  assert.equal(filingKind(' Compliance '), 'compliance');
  assert.equal(filingKind('general'), 'filing');
  assert.equal(filingKind(null), 'filing');
});

test('dates parse in every shape the backend sends, and a bad one sorts last', () => {
  assert.equal(isValidDate('2026-08-14'), true);
  assert.equal(isValidDate('2026-08-14 10:00:00'), true);
  assert.equal(isValidDate('not a date'), false);
  assert.equal(isValidDate(null), false);
  assert.equal(eventTime('not a date'), 0);
  assert.equal(
    eventTime('2026-08-14T10:00:00Z'),
    Date.parse('2026-08-14T10:00:00Z'),
  );
  assert.ok(eventTime('2026-08-14 10:00:00') > 0);
});

test('two dividends on one ex-date both survive, and each stage is a row', () => {
  const actions = buildCorporateActions({
    symbols: ['RELIANCE'],
    dividends: [
      dividend({
        dividend_type: 'Interim',
        dividend_amount: 5.5,
        ex_date: '2026-01-16',
        payment_date: '2026-02-05',
        announcement_date: '2026-01-05',
        announcement_title: 'Board declares an interim dividend',
        announcement_summary: 'Interim dividend of ₹5.50 per share',
        announcement_link: 'https://example.com/interim',
      }),
      dividend({
        dividend_type: 'Special',
        dividend_amount: 3,
        ex_date: '2026-01-16',
        payment_date: '2026-02-05',
      }),
    ],
  });
  assert.deepEqual(
    actions.map(action => [action.key, action.title, action.subtitle]),
    [
      ['div-RELIANCE-2026-01-16-Interim-5.5-pay', 'Interim', 'paymentDate'],
      ['div-RELIANCE-2026-01-16-Special-3-pay', 'Special', 'paymentDate'],
      ['div-RELIANCE-2026-01-16-Interim-5.5-ex', 'Interim', 'exDate'],
      ['div-RELIANCE-2026-01-16-Special-3-ex', 'Special', 'exDate'],
      ['div-RELIANCE-2026-01-16-Interim-5.5-ann', 'Interim', 'announced'],
    ],
  );
  assert.deepEqual(actions[0]?.value, {kind: 'perShare', amount: 5.5});
  assert.deepEqual(actions.at(-1), {
    key: 'div-RELIANCE-2026-01-16-Interim-5.5-ann',
    date: '2026-01-05',
    family: 'dividend',
    title: 'Interim',
    subtitle: 'announced',
    detail: 'Interim dividend of ₹5.50 per share',
    value: {kind: 'perShare', amount: 5.5},
    href: 'https://example.com/interim',
  });
});

test('a dividend row is keyed by what it is, as neither backend sends it an id', () => {
  // Backend-go main's dividendEventsQuery and dev's Doom DividendEvent both leave out id,
  // fetched_at and created_at. Web 66d641c3 keys the rows by stock, ex-date, type and amount.
  const fromDoom: GetDividendsResponse = {
    stock_symbol: 'tcs',
    stock_name: null,
    dividend_type: 'Interim',
    dividend_amount: 11,
    dividend_percentage: null,
    record_date: null,
    ex_date: '2026-07-17',
    payment_date: '2026-08-05',
    announcement_date: null,
    announcement_title: null,
    announcement_link: null,
    announcement_summary: null,
  };
  const keys = (rows: readonly GetDividendsResponse[]) =>
    buildCorporateActions({symbols: ['TCS'], dividends: rows}).map(
      action => action.key,
    );
  assert.deepEqual(keys([fromDoom]), [
    'div-TCS-2026-07-17-Interim-11-pay',
    'div-TCS-2026-07-17-Interim-11-ex',
  ]);
  // @ts-expect-error -- the wire carries no id, so neither does the type.
  const withId: GetDividendsResponse = {...fromDoom, id: 7};
  assert.deepEqual(keys([withId]), keys([fromDoom]));
  assert.equal(dividendKey(fromDoom), 'div-TCS-2026-07-17-Interim-11');
  // Before an ex-date is set, the announcement dates the row.
  assert.equal(
    dividendKey({...fromDoom, ex_date: null, announcement_date: '2026-07-01'}),
    'div-TCS-2026-07-01-Interim-11',
  );
  // Two id-less rows of one stock are told apart by what differs between them.
  assert.deepEqual(
    keys([
      fromDoom,
      {...fromDoom, dividend_type: 'Special', dividend_amount: 66},
    ]),
    [
      'div-TCS-2026-07-17-Interim-11-pay',
      'div-TCS-2026-07-17-Special-66-pay',
      'div-TCS-2026-07-17-Interim-11-ex',
      'div-TCS-2026-07-17-Special-66-ex',
    ],
  );
});

test('the richest feed wins a day, and the archive names the stage it dates', () => {
  const history: FundamentalsCorporateAction[] = [
    // The dividend feed's own ex-date, restated.
    {
      corpact_id: 1,
      corp_action: 'EX Dividend',
      ex_date: '2026-08-14',
      amount: 10,
    },
    // The events feed's bonus, restated with no value of its own to tell it apart.
    {
      corpact_id: 2,
      corp_action: 'Bonus issue',
      ex_date: '2024-10-28T00:00:00Z',
    },
    {
      corpact_id: 3,
      corp_action: 'Rights Issue',
      sdate: '2020-05-14',
      ratio1: 1,
      ratio2: 15,
      offer_price: 1257,
      subject: 'Rights issue at ₹1,257',
    },
    {corpact_id: 4, corp_action: 'RECORD DATE', record_date: '2019-01-01'},
    {corpact_id: 5, corp_action: 'Record Date', sdate: '2018-06-01'},
    // Only the stage, so the family names the row.
    {corpact_id: 6, corp_action: 'Ex-', ex_date: '2017-01-01', amount: 2},
    {corpact_id: 7, corp_action: '  ', sdate: '2016-01-01'},
    {
      corpact_id: 8,
      corp_action: 'Rights',
      sdate: '2015-01-01',
      offer_price: 50,
    },
  ];
  const actions = buildCorporateActions({
    symbols: ['reliance'],
    dividends: [dividend({ex_date: '2026-08-14'})],
    events: [
      event('bonus', '2024-10-28', {label: 'Bonus', ratio1: 1, ratio2: 1}),
    ],
    history,
  });
  assert.deepEqual(
    actions.map(action => [action.key, action.title, action.subtitle]),
    [
      ['div-RELIANCE-2026-08-14-Final-10-ex', 'Final', 'exDate'],
      ['corp-RELIANCE-bonus-2024-10-28', 'Bonus', 'bonus'],
      ['hist-3-2020-05-14', 'Rights Issue', 'rights'],
      ['hist-5-2018-06-01', 'Record Date', 'recordDate'],
      ['hist-6-2017-01-01', null, 'exDate'],
      ['hist-8-2015-01-01', 'Rights', 'rights'],
    ],
  );
  const [, bonus, rights, , bare, offer] = actions;
  assert.deepEqual(bonus?.value, {kind: 'ratio', ratio1: 1, ratio2: 1});
  // A per-share amount leads, then a ratio, then an offer price.
  assert.deepEqual(rights?.value, {kind: 'ratio', ratio1: 1, ratio2: 15});
  assert.equal(rights?.detail, 'Rights issue at ₹1,257');
  assert.deepEqual(bare?.value, {kind: 'perShare', amount: 2});
  assert.deepEqual(offer?.value, {kind: 'offerPrice', amount: 50});
});

test('the events feed words its own categories, and values only what it can', () => {
  const actions = buildCorporateActions({
    symbols: ['RELIANCE'],
    events: [
      event('dividend', '2026-08-01', {label: 'Dividend', amount: 11}),
      // A results date carries an amount field it does not mean.
      event('results', '2026-07-18', {label: 'Board meeting', amount: 0}),
      event('acquisition', '2026-06-01', {detail: 'Buys a regional grid'}),
      event('split', '2026-05-01', {label: 'Split', ratio1: 1, ratio2: 0}),
      event('agm', 'someday', {label: 'AGM'}),
      event('bonus', '2026-04-01', {symbol: 'TCS', label: 'Bonus'}),
    ],
  });
  assert.deepEqual(
    actions.map(action => [action.family, action.title, action.subtitle]),
    [
      ['dividend', 'Dividend', 'dividend'],
      ['results', 'Board meeting', 'results'],
      ['other', null, 'acquisition'],
      ['split', 'Split', 'split'],
    ],
  );
  assert.deepEqual(actions[0]?.value, {kind: 'perShare', amount: 11});
  assert.equal(actions[1]?.value, undefined);
  assert.equal(actions[2]?.detail, 'Buys a regional grid');
  // A ratio over zero is no ratio.
  assert.equal(actions[3]?.value, undefined);
});

test('exchange filings add the actions no other feed carries', () => {
  const actions = buildCorporateActions({
    symbols: ['RELIANCE'],
    filings: [
      filing('n1', 'esop', '2025-11-14 16:20:00', {
        caption: `${REG_30}Allotment of equity shares under ESOS`,
        details: 'Allotment of equity shares under ESOS',
        attachment_url: 'https://example.com/esos.pdf',
      }),
      filing('n2', 'merger', '2023-07-20T10:00:00', {
        caption:
          'Scheme of Arrangement for the demerger of the financial services undertaking',
        details: 'Record date fixed for the demerger',
      }),
      filing('n3', 'merger', '2022-03-01', {caption: 'Amalgamation'}),
      filing('n4', 'buyback', null),
    ],
  });
  assert.deepEqual(actions, [
    {
      key: 'filing-n1',
      date: '2025-11-14 16:20:00',
      family: 'esop',
      title: 'Allotment of equity shares under ESOS',
      subtitle: 'esop',
      href: 'https://example.com/esos.pdf',
    },
    {
      key: 'filing-n2',
      date: '2023-07-20T10:00:00',
      family: 'demerger',
      title:
        'Scheme of Arrangement for the demerger of the financial services undertaking',
      subtitle: 'demerger',
      detail: 'Record date fixed for the demerger',
    },
    {
      key: 'filing-n3',
      date: '2022-03-01',
      family: 'merger',
      title: 'Amalgamation',
      subtitle: 'merger',
    },
  ]);
});

test('a list of several stocks reads only the feeds that name them, each row labelled', () => {
  const actions = buildCorporateActions({
    symbols: ['RELIANCE', 'TCS'],
    dividends: [
      dividend({ex_date: '2026-08-14'}),
      dividend({stock_symbol: 'INFY', ex_date: '2026-08-15'}),
    ],
    events: [
      event('results', '2026-07-09', {symbol: 'TCS', label: 'Results'}),
      event('bonus', '2026-07-01', {symbol: 'TCS', label: 'Bonus'}),
    ],
    history: [{corp_action: 'Bonus', ex_date: '2024-10-28'}],
    filings: [filing('n1', 'buyback', '2026-01-01', {caption: 'Buyback'})],
    families: ['dividend', 'results'],
    labelSymbols: true,
  });
  assert.deepEqual(
    actions.map(action => [action.symbol, action.family, action.date]),
    [
      ['RELIANCE', 'dividend', '2026-08-14'],
      ['TCS', 'results', '2026-07-09'],
    ],
  );
});

test('a day and kind the feed repeats keeps each row under its own key', () => {
  const actions = buildCorporateActions({
    symbols: ['HCLTECH'],
    events: [
      event('dividend', '2026-07-14', {symbol: 'HCLTECH', amount: 12}),
      event('dividend', '2026-07-14', {symbol: 'HCLTECH', amount: 6}),
      event('dividend', '2026-07-14', {symbol: 'HCLTECH', amount: 6}),
    ],
    dividends: null,
    history: null,
    filings: null,
  });
  assert.deepEqual(
    actions.map(action => action.key),
    ['corp-HCLTECH-dividend-2026-07-14', 'corp-HCLTECH-dividend-2026-07-14~2'],
  );
});

test('rows are ordered newest first across the feeds, whatever shape their dates take', () => {
  const actions = buildCorporateActions({
    symbols: ['RELIANCE'],
    dividends: [dividend({ex_date: '2026-08-14'})],
    events: [event('results', '2026-08-14 18:00:00', {label: 'Results'})],
    history: [{corp_action: 'AGM', sdate: '2026-08-29'}],
    filings: [
      filing('n1', 'esop', '2026-08-20T09:00:00Z', {caption: 'ESOS allotment'}),
    ],
  });
  assert.deepEqual(rows(actions), [
    ['2026-08-29', 'agm', 'agm'],
    ['2026-08-20T09:00:00Z', 'esop', 'esop'],
    ['2026-08-14 18:00:00', 'results', 'results'],
    ['2026-08-14', 'dividend', 'exDate'],
  ]);
});

test('the groups the tab offers hold only what the feeds returned, in its order', () => {
  assert.deepEqual(
    ACTION_GROUPS.map(group => group.key),
    [
      'dividend',
      'bonus',
      'split',
      'rights',
      'buyback',
      'esop',
      'preferential',
      'merger',
      'meetings',
      'other',
    ],
  );
  assert.equal(actionGroupOf('demerger'), 'merger');
  assert.equal(actionGroupOf('book_closure'), 'meetings');
  const groups = groupCorporateActions([
    {family: 'agm' as const},
    {family: 'demerger' as const},
    {family: 'dividend' as const},
    {family: 'results' as const},
  ]);
  assert.deepEqual(
    groups.map(group => [group.key, group.entries.length]),
    [
      ['dividend', 1],
      ['merger', 1],
      ['meetings', 2],
    ],
  );
});

test('the filing archive leaves out what the calendar already holds', () => {
  const actions = buildCorporateActions({
    symbols: ['RELIANCE'],
    dividends: [
      dividend({
        ex_date: '2026-08-14',
        announcement_date: '2026-07-20',
        announcement_title: 'Board recommends final dividend',
      }),
    ],
  });
  const filings = buildExchangeFilings({
    actions,
    corporateFilings: [filing('esos', 'esop', '2025-11-14')],
    announcements: [
      // The dividend's own announcement, filed at the exchange the same day.
      announcement('div', '2026-07-20T17:05:00+05:30', `${REG_30}Dividend`),
      // The ESOP allotment sits in the calendar, classified.
      announcement('esos', '2025-11-14T16:20:00+05:30', 'Allotment under ESOS'),
      // An ex-date is a different event from a filing on its day.
      announcement(
        'exday',
        '2026-08-14T09:00:00+05:30',
        `${REG_30}Credit Rating`,
        {
          details: 'CRISIL reaffirms AAA/Stable',
          attachment_url: 'https://example.com/rating.pdf',
        },
      ),
      announcement(
        'outcome',
        '2026-07-18T15:30:00+05:30',
        'Outcome of Board Meeting',
        {
          announcement_type: 'outcome_of_board_meeting',
          details: 'Outcome of Board Meeting',
        },
      ),
      announcement('blank', '2026-06-01', '   '),
      announcement('undated', 'soon', 'Press Release'),
      announcement('statute', '2026-05-02', REG_30, {
        announcement_type: 'general',
      }),
    ],
  });
  assert.deepEqual(filings, [
    {
      key: 'filing-exday',
      date: '2026-08-14T09:00:00+05:30',
      title: 'Credit Rating',
      kind: 'filing',
      detail: 'CRISIL reaffirms AAA/Stable',
      href: 'https://example.com/rating.pdf',
    },
    {
      key: 'filing-outcome',
      date: '2026-07-18T15:30:00+05:30',
      title: 'Outcome of Board Meeting',
      kind: 'outcome',
    },
    {key: 'filing-statute', date: '2026-05-02', title: null, kind: 'filing'},
  ]);
  assert.deepEqual(
    buildExchangeFilings({
      actions: [],
      corporateFilings: null,
      announcements: null,
    }),
    [],
  );
});

test('each year of share capital names the capital actions filed inside it', () => {
  const actions = buildCorporateActions({
    symbols: ['RELIANCE'],
    dividends: [dividend({ex_date: '2024-08-14'})],
    events: [
      event('bonus', '2024-10-28', {label: 'Bonus', ratio1: 1, ratio2: 1}),
      event('results', '2024-10-14', {label: 'Results'}),
    ],
    history: [
      {corp_action: 'Rights Issue', sdate: '2020-05-14', ratio1: 1, ratio2: 15},
      {corp_action: 'Bonus issue', ex_date: '2017-09-07', ratio1: 1, ratio2: 1},
      // The last day of FY18 and the first of FY19.
      {corp_action: 'Buyback', sdate: '2018-03-31'},
      {corp_action: 'Buy-back offer', sdate: '2018-04-01'},
    ],
    filings: [
      filing('a', 'esop', '2024-11-14', {caption: 'Allotment under ESOS'}),
      filing('b', 'esop', '2024-12-12', {caption: 'Allotment under ESOS'}),
    ],
  });
  const byYear = capitalActionsByYear(
    actions,
    [202503, 202403, 202103, 201903, 201803],
  );
  assert.deepEqual(
    [...byYear.entries()],
    [
      [
        202503,
        [
          // Newest first, and two ESOP allotments in a year are one mention.
          {group: 'esop'},
          {group: 'bonus', ratio: {ratio1: 1, ratio2: 1}},
        ],
      ],
      [202403, []],
      [202103, [{group: 'rights', ratio: {ratio1: 1, ratio2: 15}}]],
      [201903, [{group: 'buyback'}]],
      [
        201803,
        [{group: 'buyback'}, {group: 'bonus', ratio: {ratio1: 1, ratio2: 1}}],
      ],
    ],
  );
  // A December year-end runs the calendar year.
  assert.deepEqual(capitalActionsByYear(actions, [202412]).get(202412), [
    {group: 'esop'},
    {group: 'bonus', ratio: {ratio1: 1, ratio2: 1}},
  ]);
});
