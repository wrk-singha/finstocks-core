# @finstocks/core

The shared core of FinStocks — the nexus of the two apps. Pure TypeScript: domain types,
market/trading/strategy maths, static data, query keys, endpoint definitions, and the generated
design tokens. No React, React Native, DOM, `fetch`, or storage imports (lint-enforced).

Consumers: `finstocks-mobile` and `DownStocks/frontend`, which install it as a **git-tag
dependency** for now (`"@finstocks/core": "git+https://github.com/wrk-singha/finstocks-core.git#v0.3.0"`;
the `github:` shorthand makes Yarn 1 fall back to SSH), moving to a
registry after the org transfer. Import paths: `@finstocks/core`, `@finstocks/core/tokens`,
`@finstocks/core/tokens.css`.

## Layout

- `src/` — the package. `src/tokens/` is **generated**; never hand-edit.
- `src/types/` — domain types, the union of both apps' interfaces (type-only barrel; the few
  runtime consts beside a type are re-exported from `src/index.ts`).
- `src/market/`, `src/trading/`, `src/strategy/`, `src/screener/`, `src/portfolio/` — the maths,
  one module per concern, each with a colocated `__tests__/*.test.ts`.
- `src/data/` — static data: brokers (no logos — those are app assets), lot sizes, holidays,
  stocks, indicators config, wizard steps, lessons, alert channels.
- `src/format/` — number, date, text and market-calendar formatting (IST, hoisted Intl formatters).
- `src/fundamentals/` — how a filed statement is read: the per-family line schemas and disclosure
  tiers, the Screener-style tables (quarterly results, profit & loss with its trailing twelve
  months, balance sheet, cash flows, ratios, share capital) and the SEBI shareholding tree. Line
  labels are English data, as in `src/data/`.
- `src/queryKeys.ts` — the React Query key factory both apps build keys with.
- `src/api/` — endpoint definitions over the `HttpClient` contract in `api/http.ts`: each domain
  exports a factory (`tradingApi(http)`), paths are relative to the API root without `/api`,
  order mutations take an idempotency key, pre-login routes are `anonymous`. Transport (fetch,
  axios, SSE, WebSocket) stays in each app.
- Tests run on Node directly (`node --test`, type stripping): test files import `../x.ts` with the
  extension, and the code uses only erasable syntax (no enums, no namespaces, no parameter
  properties — `tsc` enforces it). ESLint blocks React, React Native, DOM, fetch, storage and app
  aliases inside `src/`.
- Subpath imports: `@finstocks/core` (everything), or `@finstocks/core/{types,market,trading,strategy,screener,portfolio,fundamentals,data,format,queryKeys,api,tokens}`.
- `tokens/src/*.json` — the design-token source (colour light/dark, type, space, motion).
- `tokens/scripts/build.mjs` — generates `src/tokens/index.ts` and `tokens/dist/tokens.css`.
- `tokens/test/` — WCAG contrast assertions (a `KNOWN_FAILURES` allowlist, empty since decision H8).

## Commands

```bash
npm ci
npm run check         # tokens:check + typecheck + lint + prettier --check + tests
npm run tokens:build  # after editing tokens/src/*.json — commit the outputs
```

Package manager: **npm** on purpose — this package is installed from git by consumers on Yarn 4,
npm and pnpm, and Yarn packs a git dependency with the dependency's own package manager; npm is the
one every consumer already has.

## No install-time scripts

This package is installed from git by its consumers, and pnpm runs a git dependency's `prepare`
script as a build step. So: **no `prepare`/`postinstall` here, ever** — formatting is checked in CI,
not by a pre-commit hook.

## Releasing

Bump `version`, commit, tag `vX.Y.Z`, push with tags. Consumers pin the tag.
Rules and extraction plan: the migration docs (`wrk-singha/finstocks-migration`, `SHARED-CORE.md`).

## Versions

- **v0.7.3** — the BSE indices; additive, one ranking change. `BSE_INDICES` (the 78 indices the
  backend's BSE scraper writes), `BSE_HEADLINE` (SENSEX, BANKEX, SNSX50, SNXN30, BSE100, FOCIT,
  FOCMID), `INDIAN_INDICES` (NSE then BSE) and `exchangeOf(symbol)` ('MCX', 'BSE' or 'NSE');
  `isIndexSymbol` and `displayName` cover both exchanges (web 38cb35c9). `stockSearchScore` ranks
  a symbol typed in full above the symbols that start with it, so "bse" leads with the listed
  company rather than 24 BSE indices (web keeps the old tie).
- **v0.7.2** — editing an alert; additive only. `clausesFromCondition(condition)` reads a saved
  alert's condition back as the New alert form's rows (levels, a line the price crosses, the day's
  move, patterns, with the F&O dialect's columns read back as the picker's ids), and returns null
  for anything the form could not have written, a trendline, a nested rule, `==` on a level, or a
  line measured against anything but the price, so an edit never opens half-read (web 1188297c;
  the last two cases are stricter than web).
- **v0.7.1** — the New alert form's seeds; additive only. `fitOp(clause, op)` fits a seeded operator
  to what its field offers, and `clauseFromSeed` applies it, so a day's move asked to "rise above"
  opens on "is up by"; `timeframeChoice` reads a timeframe in any case, "1D" as Daily, and falls back
  to `'1m'` (web 7da99f7e).
- **v0.7.0** — web's commits after the 27 Sep re-audit, first batch. A minor because one change
  breaks callers:
  - **The alert-reading parser is gone** (web 7da99f7e): `readingFsm`, `readingLeaf` and
    `ALERT_READING_FIELDS` are removed. The chat alert card no longer re-parses its own sentence; it
    wraps the server's compiled condition, the new `AlertSetup.condition`, in `monitorFsm`.

  Added: `isFnoAlert(symbol, condition)`, true for an exchange F&O ticker or a condition naming an
  F&O field (web 7da99f7e). Changed: `chartAckMessage`'s detail lists every step, each failure,
  each step done in part and each step done, by its receipt or "Done: {op}", so an ack that applied
  now carries a detail too (web 1188297c, 7fda685a, 86967b2d).
- **v0.6.0** — web parity phase 3, fourth layer. A minor because one change breaks callers:
  - **Pattern alerts read the field list** (web 564af137): `liveMarksFor(condition)` finds a
    pattern field through `findAlertField`'s `kind: 'pattern'`, so its `isPattern` parameter and
    `AlertMarksOptions.isPattern` are gone.

  Added: `alertPatternWatches` and `alertPatternHits`, the patterns a plotted, fired alert keeps
  the view scan on for and the hits marked on its candles (web 564af137); the OI and ATM panels'
  chain figures, `oiTotals`, `atmRowOf`, `straddlePremium` and `strikeIv`, which
  `computeChainSentiment` now reads through (web c55b19da, 5e4fdac7).
- **v0.5.1** — web parity phase 3, third layer; additive only. The plan terms carry a composed
  script, its hash, thresholds, catalogue and `runnable`, and a strategy setup may be at stage
  `script_preview` (web df887153, 36719121, 7100bf8f). Watchlist flags (`FLAG_COLORS`, `withFlag`,
  `flagsBySymbol`, `flaggedSymbols`, `flagCounts`), section edits (`withSymbolMoved`,
  `withSectionRenamed`, `withoutSection`, `hasSection`, `clearedItems`), `sharedWatchlistPath`
  and TXT/CSV export and import (`watchlistTxt`, `parseWatchlistFile`, `watchlistCsv`; web
  0c327488, 950917a3, 0bb7636d). Strategies matched to a charted symbol
  (`strategiesMatchingSymbols`, `underlyingsOf`), `isConsoleActive` and `runStateOf`, with a null
  `is_mock` read as the live book (web 730f1727, c67ac033). An alert seed may carry a trendline
  (web 77f23ebf, e90ea7ce). The chart ack a client sends once a plan has run, over the chat socket
  (web 564af137, c17294ea).
- **v0.5.0** — web parity phase 3, second layer: what 19 more mobile features read. A minor
  because one change breaks callers:
  - **Chart plans lose their compute ops** (web f2229fc8): the planner no longer emits
    `compute.*`, `render.color_bars` or the `for_each`/`$ref` plumbing, so `PredicateOp`,
    `Predicate`, `ComputeOp`, `Ref`, `BarsSource`, the pattern, extrema and level names and the
    compute result shapes are gone; `render.mark_bars` takes a literal bar list, and
    `ComputedBar` keeps only its OHLCV.

  Added: words-only answer plans (`intent: 'answer'`) and the `asked` message a plan answers
  (web c17294ea, b099e32e); saved custom indicators, their chat card and helpers (web 34224b5d,
  a8422658); a company's filings as chart lines, `getFundamentalCatalog` /
  `getFundamentalSeries` with their keys (web 34224b5d, 19886306, b099e32e); the view pattern
  scan's types and `getPatternVocab` (web 74480d81); a signal's alert seeded from its direction
  and candle (web c4641a75); the IPO application form's bid arithmetic (web 28a97cf5,
  e9e33bc0); a stock's corporate actions merged from four feeds, `getCorporateFilings`, and
  `getDividends` for one stock or upcoming ex-dates, whose key now carries the symbol and
  filter (web e141e79a, 6e4b8a95, e9e33bc0, 6fb2ccdc, e7476c63); segment notes and
  related-party transactions, `getSegments` / `getRelatedParty` (web 6fb2ccdc).

  Back to web's reading: a line two schemas name is listed under each again, and ownership's
  Government bucket reads `INcgovt` and `INDcgovt`, so a government promoter counts in both
  Promoters and Government, as on web (reverts 5380474 and 9e70544).
- **v0.4.0** — web parity phase 3, first layer: what 25 mobile features read. A minor because
  one change breaks callers:
  - **Chart intervals are open** (web de4023e9): `ChartInterval` is any count and unit the
    chart accepts (`45m`, `3h`, `2d`), not the preset ladder, so code that indexed
    `CHART_INTERVAL_LABEL` or `CHART_INTERVAL_RESOLUTION` with one calls `chartIntervalLabel` /
    `chartIntervalToResolution`; `parseChartInterval`, `makeChartInterval`,
    `chartIntervalMinutes` and `resolutionToChartInterval` read and build them.

  Added: the New alert form's fields, clauses, sentences and monitor-FSM compiler
  (`data/alertFields.ts`, `market/alertRule.ts`; web 6fb2ccdc, 0c327488); AI signal types,
  helpers and `marketApi.postAISignals`, whose reader fills the lists Go sends as null (web
  19886306 and the signals series); fired-alert chart marks, `alertMarksFor` (web 0fc15a01,
  564af137); the option contract address, `readOptionContract` / `exchangeSymbol` /
  `optionPath`, with `isExchangeSymbol` as the one home of the contract grammar (web c696d9c4,
  f6e527c1); the world indices table and one-index window (web 28a97cf5, a50f1d2f); IPO lot,
  schedule and financials maths, keys and `ipoLogoUrl` (web 28a97cf5); the industry peer table
  client, keys, compare and column-picker helpers (web 95fda334, 74fecbb1); the full
  shareholding pattern, holder register, pledge and delivery readers, with `getOwnership`
  filling null lists (web 74fecbb1, 8589ddf8); per-period revenue and profit for the overview
  chart, the incorporation year and categorical chart series hues (web 6e4b8a95, e9e33bc0);
  the chat list's `days` window and `total`, with empty params left out (web ee2d1df9,
  bf4b9c8b); the F&O card's option order draft (web 094912d5); `queryKeys.chartManifest()`;
  and the events calendar's day heading. `getStockEvents` is a POST now, because a watchlist
  or holdings filter can name more symbols than a URL holds (web 34224b5d), and
  `queryKeys.market.stockEvents` keys it by every filter.

  Fixed: a price CAGR reads bar dates off their digits, so an engine that cannot parse the
  wire's "YYYY-MM-DD HH:MM:SS" no longer starts every span at the first bar; a decimal strike
  prints with its fraction; the filing reader fills null delivery rows and documents lists as
  it did categories; `readOptionContract` reads a repeated link field's first value instead of
  throwing; `formatExpiryLabel` prints an ISO expiry as its own day west of UTC; an alert match
  without a symbol names no stock instead of throwing.
- **v0.3.0** — web parity phase 2, the foundations the phase-3 features stand on. A minor
  because two changes break callers:
  - **Saved alerts renamed** (web 21aeeca2): the `/watchlists` records are `SavedAlert`,
    `AlertMatch`, `SavedAlertsResponse` and `AlertSetup`, served by `savedAlertsApi`
    (`getSavedAlerts` / `saveSavedAlerts` / `deleteSavedAlert`) and keyed by
    `queryKeys.savedAlerts()`; `market/savedAlerts.ts` holds `deriveAlertName` and
    `newSavedAlertId`. The endpoint, the wire field, the cache key arrays and the
    `watchlist_alert` card type keep their old names. `SavedAlert.condition` is web's 564af137.
  - **Crore formatting** (web 6e4b8a95): `formatCroreCompact` prints lakh crore at ₹1L Cr and up
    and grouped crore below (no more "₹1.82K Cr"); `formatCompactQuantity` is the one compact
    count (K, L, Cr, no ₹) and `formatOi` is now its alias.

  Added: the fundamentals detail client, types and key (`getFundamentalsDetail`, a 404 is `null`;
  web 1d4a3c31, e9e33bc0); `@finstocks/core/fundamentals` with web's statement schemas and table
  builders, the SEBI ownership tree and `ownershipBuckets` (web 6fb2ccdc, 74fecbb1, cbecdebb,
  95fda334); the stock watchlist client, types, list helpers and keys (web 0c327488, 950917a3);
  the screen engine: types, `getScreenCatalog` / `runScreen` (180 s per request) /
  `getIndustryTree`, the screen model, industry selection and the prebuilt screens (web
  1485be7d); the nineteen restored pattern flags, taking the indicator catalogue to web's 241,
  with Adaptive & Cycle now last as on web (web 45b4d103); the strategy run options, rule steps
  and sizing words, `BACKTEST_STALLED_AFTER_MS`, the rule picker's lead sections and
  `StrategySetup.backend_rows` (web bf4b9c8b, 3a0be772, de4023e9, ee2d1df9).

  Two places where core deliberately reads differently from web, each its own revertable commit,
  to be raised on web: `resolveGroups` gives a filed line one owner, so a lender's or bank's
  Interest (and a bank's quarterly Depreciation) prints once instead of as two rows (5380474);
  the ownership split's Government is `INcgovt` only, because `INDcgovt` is the promoter
  government already inside Promoters, which web counts twice (a PSU read 140%) (9e70544).
- **v0.2.16** — web parity phase 1, five shared changes mirrored from web. `RecommendationReport`
  takes the web shape (`expectancy`, `avg_win_pct`, `avg_loss_pct`, `drawdown_recovery_trades`,
  `monthly_returns`, `equity_curve[].p`; `closed_count`/`win_count` dropped) with `monthlyGrid` and
  `MIN_EDGE_SAMPLE` in `strategy/recommendationReport.ts`, and the api reader treats
  `monthly_returns` as optional at the boundary (web 4f733d3c, 1b63ab44). `parseSizingMode` reads
  "2 lots" / "10 shares" as QTY and `prepareSweep` builds variants from their terms and passes the
  FSM through (web 329e8233, de4023e9). `market/alertReading.ts` + `market/alertRule.ts` carry the
  alert reading map with the corrected volatility labels (web 134e67c3). `newsSignals` keys closes
  by the bar's own IST day (web cddbfad5). `queryKeys.fno.indexUnderlyings()` and
  `getFnoIndexUnderlyings` are no longer web-only (web cf431ef3).
- **v0.2.15** — the rule picker's context variables, 3 to 8. `$target_profit` and `$stop_loss` are
  gone; `$entry_time`, `$trailing_stop`, `$pullback_low`, `$opening_range_high`,
  `$opening_range_low`, `$candle_size` and `$trade_count` take their place. The engine sets an
  opening range, a pullback low, a trailing stop and a trade count through UPDATE_CONTEXT, and none
  of them could be picked. Web dropped the two in `87fa20b9` (2026-09-13) and the old app followed
  in `9488c13` three days later, so both clients agreed and core was the last holdout. Nothing
  outside core referenced either name, and `fsmProjection` prettifies a var itself rather than
  reading this catalogue, so the removal reaches only `valueHint`: a saved rule written against
  `$target_profit` still runs, but reads back as its raw expression instead of a phrase. Both
  catalogue-size guards move with it, deliberately: `slice(0, 3)` -> `slice(0, 8)` and
  `3 + 222 + 24` -> `8 + 222 + 24`.

  Recorded because the first pass got it wrong: this was declined on 2026-09-19 as "one
  unverifiable source diverging from web". That reading came from a local `frontend` checkout on a
  side branch **59 commits behind `origin/main`** — web had already made the change six days
  earlier. Read web through `git show origin/main:<path>`, never the working tree.
- **v0.2.14** — documentation only, no behaviour change: `lotSizes` named the wrong producer. The
  source of truth is `backend-go/handlers/trading/fnolots.go`, which carries all 216 listed
  underlyings, and the mirror is `sentinel/core/constants.py` — not the `market/fno.go` and
  `fno_ideas.py` the header claimed. `lotSizeFor` now also says that MCX commodities are in neither
  map, so it is always null for them and their pads step in single units: an answer rather than a
  gap. Carried from the old app's `9488c13`. Neither set of paths is verifiable from this repo, so
  this follows the more specific and more recent claim rather than treating the old one as settled.
- **v0.2.13** — the 13 keys the old app added in `9488c13`, taking the catalogue to 222 across 30
  sections. All thirteen were already declared in `TechnicalIndicatorData` and live in web, so this
  is the same two-source case as the 23 in v0.2.11 — a data change with no type work. Web splits
  them across **two** sections and the split carries meaning: `September Additions` is
  `priceLevels` (moving averages, chandelier exits, the Ichimoku lagging span, the Heikin Ashi
  trio) while `Standard MACD & Volume Averages` is not, since an oscillator and an average volume
  are not price levels. The old app put all thirteen in one section, which would have drawn volume
  averages as price lines. Core is now 19 keys behind web; those remain web-only and unverifiable
  against the producer from here.
- **v0.2.12** — `valueHint` and `exitHint` in `/strategy`, the rule-hint helpers both apps already
  carry an identical copy of. The compiler writes conditions the engine can evaluate rather than
  ones a trader reads — a 5% take-profit compiles to `$entry_price * 1.05` — and these turn such an
  expression back into words beside the field, never in place of it. Names resolve through
  `STRATEGY_INDICATOR_OPTIONS`, so a newly-computed column reads correctly without a second list.
  `FSMRule` gains `comment`, the compiler own words, which `exitHint` prefers when it quantifies
  the exit; `projectRawFsm` already read it off the raw transition but never surfaced it.
- **v0.2.11** — the 23 indicator keys both apps landed on 2026-09-18, taking the catalogue to 209
  columns across 28 sections: trend-confirmed candles, two more double-candle patterns, gaps and
  range breaks, and the adaptive/cycle oscillators. Web grouping and labels are followed (four
  sections, not the old app three), and `TechnicalIndicatorData` gains the 18 flags it lacked —
  the five oscillators were already declared. Web carries 241 keys in total, so core is still 32
  behind; those are web-only and unverified against the producer.
- **v0.2.10** — `Period` gains `6m` and `5y`. graph.go has served both since before the union did, so a caller wanting half a year no longer fetches a full one and throws half of it away; both apps widened first and core was the one left behind. Additive: no consumer enumerates `Period`, and the two functions that return one key off `interval` alone.
- **v0.2.9** — `tradingApi.getGraphDataWithPrevCloses`: the bars and their settled previous closes
  from one request. `getGraphData` and `getGraphPrevCloses` each fetch the same pages, so a screen
  that wants both — anything pricing a symbol against yesterday's close — polled the endpoint twice
  for one scalar. This parses the same responses for both instead. Additive: both existing methods
  are unchanged, and callers that need only bars keep using `getGraphData`.
- **v0.2.8** — the settled previous close the backend already serves per series, additive and
  breaking nothing: `pc` on `RawGraphSeries`, `parseGraphPrevCloses` in `/api` (the same payload
  read for the scalar `parseGraphData` necessarily drops, since it describes the series rather than
  a bar in it), `tradingApi.getGraphPrevCloses`, and `prevCloseFor` in `/screener` for the
  case-tolerant lookup. `getGraphData` keeps its shape — every caller reads `StockGraphData`, so
  the scalar rides beside it rather than inside it. Web already reads this field; mobile derives a
  previous close from the bars and can now prefer the server's, which is resolved against the same
  feed the prices come from and so cannot drift when the daily rollup falls behind.
- **v0.2.7** — decision H8, the minimal passing contrast values: light `status.success` `#10b981` →
  `#0ea674` (3.02:1 on base), light `status.orange` `#f97316` → `#eb6d15` (3.01:1) and dark
  `ink.subtle` `#7a7f87` → `#7b8088` (4.51:1 on cardSoft). The contrast test's `KNOWN_FAILURES` is
  empty. **Web visual change:** the CSS variables in `tokens.css` change too
  (`--color-status-success`, `--color-status-orange`, dark `--color-ink-subtle`).
- **v0.2.6** — the old app's chat search by category (drift since `c8f7925`; the key, the `category`
  list param, `ChatCategory`, `CHAT_CATEGORIES` and `emptyChatsMessage` were already in v0.2.0):
  `chatCategoryParam` in `/api`, the sorted comma-joined value both the request and
  `queryKeys.chatsSearch` take, and `chatCategoryLabels` in `/data`, the selected labels in picker
  order for `emptyChatsMessage`.
- **v0.2.5** — structured forms beside the English copy, so mobile can translate what the web still
  reads in English (additive; every English function returns what it did): `needsCondition`,
  `positioningFacts`, `futuresTitleParts`, `EntryStatus.driftPct` and `picksResetInfo`. The socket
  paths `ohlcvStreamPath`, `depthStreamPath` and `premiumStreamPath` in `/api` (relative to the API
  root, without `/api`, like every core path), and the backtest sweep helpers `buildSweepCurves` and
  `prepareSweep` in `/strategy`.
- **v0.2.4** — query keys the Wave C ports kept locally (`stockScore`, `portfolioAnalysis.{all, detail}`,
  `fno.topTraded`); `budget_config.total` on `RedeployOverrides` and `UpdateFsmOverrides`; the strategy
  timeframe options and `normalizeStrategyTimeframe` in `/strategy`.
- **v0.2.3** — `stockLogoUrl(symbol)` (the logo bucket by underlying) and query keys the mobile ports
  kept locally: `orders.pendingTrade`, `brokers.{reservedIp, zerodhaExchange, upstoxExchange,
oauthConfirm}` and `chatsSurface(surface)`.
- **v0.2.2** — `queryKeys.auth.resetToken(token)`: the emailed reset link is checked before the
  form shows (mobile auth port).
- **v0.2.1** — `newWatchlistId` reads `crypto` through `globalThis` with a local type: the bare
  global is not in React Native's type library and broke the mobile app's typecheck.
- **v0.2.0** — phase 2: the whole shared core. Types (union of both apps), market/trading/
  strategy/screener/portfolio maths, static data, the formatting union, the query-key factory
  and the endpoint definitions over `HttpClient`. 407 tests (297 in src). Every place the two apps disagreed
  is decided in code with a `drift resolved 2026-09-13` note; the summary and the adoption rules
  are in the migration docs (`SHARED-CORE.md`, "Phase 2 record").

- **v0.1.4** — `format/number` (formatNumber, formatCurrency, formatPercent, formatQuantity,
  formatCompactInr, formatCroreCompact, withSign). Font families renamed to the TTFs' PostScript
  names (`SpaceGrotesk-Regular` …): iOS resolves fonts by PostScript name, so the old expo-font
  keys could never have worked in a bare app.
- **v0.1.3** — no install-time scripts; npm as the package manager.
