import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {StockWatchlistDetail} from '../../types/stockWatchlist.ts';
import {
  CSV_BOM,
  csvCell,
  exportFileName,
  parseWatchlistFile,
  WATCHLIST_COLUMNS,
  WATCHLIST_TABS,
  watchlistCsv,
  watchlistTxt,
} from '../watchlistExport.ts';

const detail = (
  symbol: string,
  extra: Partial<StockWatchlistDetail> = {},
): StockWatchlistDetail => ({
  symbol,
  name: `${symbol} Ltd`,
  type: 'stock',
  exchange: 'NSE',
  last: null,
  change: null,
  change_pct: null,
  volume: null,
  avg_vol_10: null,
  market_cap: null,
  pe: null,
  eps: null,
  pb: null,
  ev_ebitda: null,
  dividend_yield: null,
  perf_1w: null,
  perf_1m: null,
  perf_3m: null,
  perf_6m: null,
  perf_ytd: null,
  perf_1y: null,
  volatility: null,
  beta: null,
  max_drawdown: null,
  high_52w: null,
  low_52w: null,
  rsi_14: null,
  sma_20: null,
  sma_50: null,
  sma_200: null,
  macd_hist: null,
  ...extra,
});

test('the tabs and their columns are web’s', () => {
  assert.deepEqual(
    WATCHLIST_TABS.map(tab => tab.id),
    ['price', 'financials', 'performance', 'risk', 'technicals'],
  );
  assert.deepEqual(
    WATCHLIST_COLUMNS.technicals.map(column => column.label),
    ['Trend', 'RSI (14)', 'MACD Hist', 'SMA 20', 'SMA 50', 'SMA 200'],
  );
});

test('a CSV cell is empty for no value, trims a number to six places and quotes what it must', () => {
  assert.equal(csvCell(null), '');
  assert.equal(csvCell(undefined), '');
  assert.equal(csvCell(1234.5), '1234.5');
  assert.equal(csvCell(0.1 + 0.2), '0.3');
  assert.equal(csvCell(-2.123456789), '-2.123457');
  assert.equal(csvCell('Banks, NBFCs'), '"Banks, NBFCs"');
  assert.equal(csvCell('The "big" one'), '"The ""big"" one"');
  assert.equal(csvCell('two\nlines'), '"two\nlines"');
  assert.equal(CSV_BOM.charCodeAt(0), 0xfeff);
});

test('a file name keeps word characters and turns spaces into underscores', () => {
  assert.equal(
    exportFileName('Long-term picks!', 'txt'),
    'Long-term_picks.txt',
  );
  assert.equal(exportFileName('  ★★ ', 'csv', 'watchlist'), 'watchlist.csv');
  assert.equal(exportFileName('', 'csv'), 'export.csv');
});

test('the TXT lists the unfiled symbols, then each section under a ### line', () => {
  const text = watchlistTxt({
    symbols: ['NIFTY', 'HDFCBANK', 'SBIN', 'INFY', 'TCS'],
    sections: [
      {name: 'Banks', symbols: ['HDFCBANK', 'SBIN']},
      {name: 'Empty', symbols: []},
      {name: 'IT', symbols: ['INFY']},
    ],
  });
  assert.equal(
    text,
    [
      'NIFTY',
      'TCS',
      '###Banks',
      'HDFCBANK',
      'SBIN',
      '###Empty',
      '###IT',
      'INFY',
    ].join('\n'),
  );
  assert.equal(watchlistTxt({symbols: [], sections: []}), '');
});

test('an exported TXT reads back as the same symbols and sections', () => {
  const list = {
    symbols: ['NIFTY', 'TCS', 'HDFCBANK', 'SBIN'],
    sections: [{name: 'Banks', symbols: ['HDFCBANK', 'SBIN']}],
  };
  assert.deepEqual(parseWatchlistFile(watchlistTxt(list)), {
    symbols: ['NIFTY', 'TCS', 'HDFCBANK', 'SBIN'],
    sections: [{name: 'Banks', symbols: ['HDFCBANK', 'SBIN']}],
  });
});

test('the parser drops exchange prefixes, repeats and lines that cannot be symbols, and splits on commas', () => {
  assert.deepEqual(
    parseWatchlistFile(
      'NSE:reliance, tcs\n\n  infy  \nTCS\n### \nBSE:M&M\n(not a symbol)\nBAJAJ-AUTO\n',
    ),
    {
      symbols: ['RELIANCE', 'TCS', 'INFY', 'M&M', 'BAJAJ-AUTO'],
      sections: [{name: 'Section', symbols: ['M&M', 'BAJAJ-AUTO']}],
    },
  );
  assert.equal(
    parseWatchlistFile(`###${'x'.repeat(60)}`).sections[0]?.name.length,
    40,
  );
  assert.deepEqual(parseWatchlistFile(''), {symbols: [], sections: []});
});

test('the CSV carries every figure once, raw, with each symbol’s section, in the server’s order', () => {
  const csv = watchlistCsv(
    {sections: [{name: 'Banks, PSU', symbols: ['SBIN']}]},
    [
      detail('SBIN', {
        last: 816.25,
        change_pct: 2,
        market_cap: 7.25e12,
        sector: 'Financial Services',
        signal: 'Bullish',
        as_of: '2026-09-11',
      }),
      detail('TCS'),
    ],
  );
  const [header, sbin, tcs] = csv.split('\n');
  const columns = header?.split(',') ?? [];
  assert.deepEqual(columns.slice(0, 8), [
    'Symbol',
    'Name',
    'Type',
    'Exchange',
    'Section',
    'Last',
    'Chg%',
    'Chg',
  ]);
  assert.equal(columns.at(-1), 'As of');
  assert.equal(columns.filter(column => column === 'Market Cap').length, 1);
  assert.equal(columns.length, 5 + 29 + 1);
  const cells = sbin?.split(',') ?? [];
  assert.deepEqual(cells.slice(0, 5), [
    'SBIN',
    'SBIN Ltd',
    'stock',
    'NSE',
    '"Banks',
  ]);
  assert.ok(sbin?.includes('"Banks, PSU",816.25,2,,'));
  assert.ok(sbin?.includes(',7250000000000,'));
  assert.ok(sbin?.includes('Financial Services'));
  assert.ok(sbin?.includes('Bullish'));
  assert.ok(sbin?.endsWith(',2026-09-11'));
  assert.ok(tcs?.startsWith('TCS,TCS Ltd,stock,NSE,,,'));
  assert.equal(csv.startsWith(CSV_BOM), false);
});
