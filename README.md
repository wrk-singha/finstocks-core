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

- **v0.8.4** — Athena's strategy-action: the C strategy cards' run, their code signature and a
  forked chat's shared strategies; additive only. Backend-go `main` merged Athena on 8 Oct
  (`8f0cb404`): `POST /trading/strategy-action` is now the one way a strategy, a backtest or an
  alert is made, and create-backtest, create-backtest-batch and update-fsm are gone. These are the
  reviewed integration units (`2bcaeb3`, `504fcde`, `d397d98`), brought to the release line as
  they are; nothing else from the integration branch comes with them.
  The C strategy cards' run (web `feat/athena-integration` 0bc7e131, web `main` f28a12d4). A chat
  plan card whose `terms.script_entry` is `"evaluate_v2"` with a `script` and
  `script_hash` is a C strategy card: its rules are its code, and it runs only through the
  backend's `POST /trading/strategy-action`, never create-backtest (which has no FSM to send for
  it, or an FSM that is not its code). `BacktestSetupTerms` gains `script_entry`, `strategy_id`
  and `backtest_id`; `strategy/strategySetupConfig` gains `SCRIPT_ENTRY_C`, `scriptRunOf(terms)`
  (the card's `ScriptRun` — code, hash and the saved rows — or null) and `isScriptCard(setup)`.
  `tradingApi.strategyAction(body, idempotencyKey)` sends `StrategyActionRequest`: the
  `RunSettings` (create-backtest's fields less `is_backtest`, `is_mock`, `fsm`) plus `action`
  (`StrategyAction`: `backtest`, `deploy`, `deploy_live`, `replace`), `script`, `script_hash`,
  `strategy_id?`, `backtest_id?`, `expected_compile_hash?`; 200 is `StrategyActionResponse`
  (create-backtest's). `deploy` and `deploy_live` activate the same row (only `is_mock` flips),
  so a live deploy of a paper run turns it live keeping its history; `replace` swaps live code
  from the next candle, keeping positions, and is sent only after the 409 that asked for it.
  `strategy/strategyAction` holds `STRATEGY_ACTION_BY_KIND` and `scriptAction(kind, settings,
script)` (a run option as its request, ids omitted when the card has none), `replaceAction(
request, compileHash)` (the same request as a replace of the version named, the card's own
  `script_hash` kept) and `strategyActionRefusal(error, fallback)`, which reads a failed call on
  either host's error shape: `{kind: 'replace', message, compileHash, liveName?}` for the 409
  with `needs: "replace"` (nothing changed; `message` is the backend's confirm), `{kind:
'refused', message}` for a 400 (the settings; QTY and RISK_PERCENT sizing; PERCENT with no
  capital), 403, 404, a 409 asking for no replace, 412, 422, any other 4xx, and the handler's own
  503 ("Running C strategies is not enabled yet"), in the backend's words, `{kind: 'unavailable',
message}` only for the handler's own 500 ("Could not verify your broker connection", answered
  before anything is asked of Athena), and null for every other 5xx — the handler's 502 words any
  Athena failure, a reply lost after the strategy was activated included — and for a timeout, the
  network or anything without a status: the request may have been carried out, so a host re-reads
  rather than resends. `strategyActionTouches()` lists what such a call changes:
  the books (`status.all()`) and every strategy's logs (`['strategyLogs']`). A status below 400 (a
  2xx whose body could not be read) is also null. `strategyActionSettleMs(action)` is how long
  after the send the outcome is settled — every Athena call the backend makes for it answered or
  timed out (`ATHENA_CALL_TIMEOUT_MS`, the backend's default `ATHENA_TIMEOUT_SECONDS` of 15, times
  one call for a deploy or a replace and three for a backtest, plus 15 s): 30 s, or 60 s for a
  backtest; a book read begun that long after the send that still lacks the row says the request
  did not go through. `strategy/scriptDeployId` names the row a card's deploy goes to when the card names none:
  `scriptDeployId({messageId, cardKey, kind})` is a UUID version 5 (`uuidV5`, a pure SHA-1, in
  `SCRIPT_DEPLOY_NAMESPACE`) — the same for every attempt of that card and kind, on any device and
  after a relaunch, so a resend can only activate that row again (the backend activates the id it
  is sent, an upsert; sent none, it makes a new row every time). `cardKey` is the card's place among
  the message's plan cards (backtest and strategies), which the backend's link never reorders. The
  chat and the code are not part of it: the message id is a UUID, and a card whose code changes in
  place deploys to its own row, where a different live version meets the replace prompt.
  A C card's code signature (web `feat/athena-integration` 046148aa, backend-go 5a8a6525
  `strategyaction.go`). `BacktestSetupTerms` gains `script_sig`, llm's signature of
  the card's code for this user, which the backend passes to Athena untouched and Athena may
  require ("this code was not built for this user"). `ScriptRun` gains `scriptSig?`, set by
  `scriptRunOf` only from a non-empty string (an empty one is none, as the backend reads it);
  `StrategyActionRequest` gains `script_sig?`, which `scriptAction` sends exactly when the card
  carries one and `replaceAction` keeps, so the resend after a 409 carries the same signature as the
  request it answers. A backend without the field ignores it.
  A forked chat's shared strategies, read-only (web `feat/athena-integration` 3eb0664b, web `main`
  3da1f955, backend-go 19740aa5…5a8a6525). `getChatByIdResponse` is now `ChatWithSource`: the chat with
  `source_strategies?` (`StrategyRow[]`, is-alive's summary rows, backtests only) and
  `source_strategy_logs?` (`StrategyLogRow[]`, strategy_logs rows as `models.StrategyLogs` writes
  them: `message` and `payload` left out when empty, not wrapped as timeline items). GET
  /chats/{id} sends them for the strategies another owner shared that the chat's copied messages
  name, and leaves both out otherwise, as a backend that predates them does.
  `strategy/sourceStrategies` holds `strategyCardSource(strategyIds, chat)` (web's: a card naming
  a shared strategy reads the snapshot, read-only, `fromSource` true; any other card stays live
  with no snapshot; a share link's read-only chat passes its snapshot through) with its
  `StrategySnapshot`; `splitSharedIds(strategyIds, sharedStrategies)`, a card's ids split into
  the snapshot's rows among them (`shared`, in the card's order) and the ids to read live
  (`liveIds`), each once, so a card naming both keeps the viewer's own live; and
  `sourceLogTimeline(rows)`, the raw rows as get-logs `LogFeedLogEntry` items, newest first as
  get-logs sorts them, a left-out payload as null. Ids match case-insensitively, as the backend
  canonicalises them. `strategy/strategyQuery`
  holds web's `buildDeployQuery(strategy, entryQuery, capital?, symbol?, timeframe?)` and
  `buildBacktestAgainQuery(strategy)` ("Run again": `Backtest this exact strategy:
<original_query>`, then the symbol, timeframe or intraday, take profit, stop loss and prose
  exits the row carries, and no size).
- **v0.8.3** — an IST date-and-time stamp keeps its clock on iOS. Hermes on iOS formats a format
  that asks for both a date and a clock as "7 Oct at 11:05 AM" and types the hour, minute and AM/PM
  as plain literals, so `istDateTimeParts` (and with it `formatShortDateTime`,
  `formatTradeTimeShort` and the strategy log stamps) and portfolio's `formatTradeTime` read an
  empty clock and printed "Oct 7 :". Both now read the date and the clock from two formatters,
  which every engine labels. Output on V8 and Android is unchanged.
- **v0.8.2** — strategy rows without a sizing mode; additive. is-alive now also lists Athena
  script ("C") strategies (backend feat/athena-integration), whose `budget_config` is the engine's
  `{val, type, allocate}` with no `mode`, and which carry no `fsm`; `deriveStrategyCards` threw on
  one (`budget_config.mode.toUpperCase()`). The types now say what the wire sends:
  `Strategy.budget_config` and `Strategy.fsm` are optional, and `BudgetConfig` has `mode?: string`,
  `val?: number`, `type?` and `allocate?` - so a host that reads those fields directly gets type
  errors where it would have thrown. Read them through the new `budgetMode` (upper-cased, AMOUNT
  when absent or not a string), `budgetSizingMode`, `budgetVal`, `isScriptBudget` and
  `strategyPositionSize`. A row with no mode sizes by AMOUNT on its card: `allocated` and the return
  basis are `val` (a script strategy's total capital). `calculateInvestedValue` is unchanged, as
  the web has it: only a budget that says `AMOUNT` counts as invested, so a script strategy's
  capital does not. `isScriptStrategy` is the one test for a script strategy - by its budget's
  shape (`type` without `mode`, or `allocate`), or by having no mode, FSM or rules - and such a
  strategy states no position size: `buildStrategyRules` drops its "Position size" row rather than
  show the total capital as one. is-alive drops empty and false fields from a row (`StrategyRow`),
  so `tradingApi.isAlive` now hands back rows with them filled in (`normalizeStrategyRow`: "" and
  false), and `resolveStrategyChartSymbol` no longer throws on a row with no symbol.
- **v0.8.1** — the screener's corporate events; additive only. Bounds that are exactly one of the
  field's presets carry its label as an optional `preset` on their `between`, `above`, `below` or
  `any` part, under the web's rule (web main 1d56f0f7): both bounds equal, checked after a
  comparison. A host that ignores the field compiles and reads the bare bound as before. Two
  visible changes, both as the web has them: `filterLabel` words such a filter as the preset,
  "Dividend · Upcoming · Within a month" rather than "< 30"; and a bound on a `days` figure comes
  with its unit ("1 day", "10 days"), in `filterParts` too, so a host adds none of its own.
- **v0.8.0** — the option contract grammar; one breaking change. `exchangeSymbol(contract,
catalogue)` now takes the underlying's expiry list and spells a weekly by its date
  (`NIFTY26O0623150CE`) and the monthly by its month (`NIFTY26OCT23150CE`); with no catalogue it
  returns the dated form (**breaking**: it used to take no catalogue and always spell the month).
  Added, as the web has them (web feat/chart-parity 31c3dabb): `monthLastExpiries`,
  `monthlyExpiries`, `expiryCycle`, `catalogueWeekday`, `parseOptionSymbol` (ISO, weekly and
  monthly spellings), `optionContractOf`; `market/expiryKit` (`expiryChips`, `liveExpiries`,
  `hasWeeklies`, `expiryRole`, `expiryInstant`); `premiumStreamPath(underlying, expiry?)`;
  `FnoChainFallbackLeg.exchange_symbol`. `buildOptionContractSymbol` is unchanged. Two limits are
  pinned by tests, not fixed: the web's rule reads a holiday-moved monthly on a monthlies-only
  list as a weekly (Mon 23 Nov 2026, Mon 25 Jan 2027), and a dated ticker with a strike under
  100, a six-digit strike in a one-digit month, or an underlying ending in digits does not read
  back.
- **v0.7.6** — the order outcome rule; additive only. `outcomeOfError(error)` in
  `@finstocks/core/trading` reads a failed buy or sell as the web does (web feat/chart-parity
  31c3dabb): HTTP 400, 403, 404, 409, 422 and 429 are a refusal, and every other failure (any
  other 4xx, any 5xx, no answer, an unreadable body) is unknown: the order may have gone
  through. The status is read through `statusOf`, so both the web's and the app's error shapes
  work. Types `OrderOutcome`, `OrderResult`.
- **v0.7.5** — the market profile; additive only. `marketApi.getMarketProfile(instrument, session?)`
  (`GET /market/profile`, by symbol or by underlying and month), `queryKeys.market.profile`, the
  `MarketProfile` types, and web's `profileView` helpers (`profileInstrumentKey`, `groupScreens`,
  `latestReading`, the value-position copy) ported as they are (web dev 2226a1e1).
  `formatSessionDay` and `formatCompactCount`. The types are the newer backend's: production
  does not yet send `thresholds`, `trading.ibComplete` or a screen's `title`, `summary` and
  `reasonText`, so a caller reads the answer before trusting them.
- **v0.7.4** — search order back to the web's. `stockSearchScore` scores an exact symbol match as
  a prefix match again (the v0.7.3 bonus is reverted), so "bse" lists the BSE indices before the
  listed company, as the web does.
- **v0.7.3** — the BSE indices; additive, one ranking change. `BSE_INDICES` (the 78 indices the
  backend's BSE scraper writes), `BSE_HEADLINE` (SENSEX, BANKEX, SNSX50, SNXN30, BSE100, FOCIT,
  FOCMID), `INDIAN_INDICES` (NSE then BSE) and `exchangeOf(symbol)` ('MCX', 'BSE' or 'NSE');
  `isIndexSymbol` and `displayName` cover both exchanges (web 38cb35c9). `stockSearchScore` ranks
  a symbol typed in full above the symbols that start with it (reverted in v0.7.4).
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
