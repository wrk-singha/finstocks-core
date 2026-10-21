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

- **v0.9.13** — a recommendation resolves live from its minute candles, as web and the dashboard
  do: `resolveRecommendation` is web's resolver (outcomes waiting, open, target, stop, expired,
  not_triggered; the fill price and time; the exit; target 2 touched after the fill; the ₹10,000
  model `positionQty`, display only) with all ten of web's shared vectors as tests. A bar that touches
  both stop and target exits at the stop, a gap through the stop exits at its edge, and a bar given
  twice is read once. `resolverCandles` reads a series once (usable bars only, one per minute,
  sorted), `resolverCandlesFrom` trims it, `mergeResolverCandles` joins two answers (the later wins)
  and `liveResolutionOver` resolves a pick over its own window, from its publication minute to
  `valid_until`. `withLiveResolution` lays a resolution over a `Recommendation` while it is open and
  never changes its status, `valid_until`, plan or price, so a live view can only take a pick out of
  trading, never put one back; `liveClosedOutcome` and `outcomeOf` name the outcome. A
  `Recommendation` may carry `outcome` and `position_qty`. Bar times are not parsed here: the caller
  turns backend-go's IST wall-clock stamps into instants.
- **Unreleased** — main's v0.9.12 (tagged on main): recommendations read target 2, the stored entry and exit, and a closed trade's
  return in %: since backend-go 5295af0e (migration 26) and aaafcc28, a `RecommendationRow` may carry
  `target2_min`/`target2_max`, `entry_at`, `entry_price` and `target2_hit_at`, and a report row
  `entered_at`, `entry_price`, `target2_hit_at` and `return_pct`, all optional. A `Recommendation`
  gains `target2_zone` and `target2_price` (the edge nearest the entry, as `target_price` is; left off
  when target 2 is not past the target), `entered_at`/`entry_price` as the server stored them at the
  day's finalise (this reader has no candles and makes no fill up), `exited_at` from a closed call's
  `exit_at`, and `target2_hit_at`; target 2 is shown only and is never an order's target, stop, size
  or deadline. An old open row reads exactly as before; an old closed row gains only `exited_at`.
  `closedTradeEntry` and `closedTradeReturnPct` give a closed trade's entry (none for a missing or
  zero entry) and its return in percent: the stored `return_pct`, else the move from the fill (or
  the entry zone's low on older rows) to the exit, signed for a short; an exit that is not a positive
  number is no return.
- **Unreleased** — main's v0.9.11 (tagged on main): the strategy library hands a strategy to chat for Deploy and Forward test as well as
  Ask and Backtest: `LibraryChatIntent` gains `deploy` and `forward_test` with web dev's wording
  ("Deploy the {name} strategy for me.", "Forward test the {name} strategy with mock money."), and
  the visible sentence (`libraryChatRequest`) and the strategy marker (`libraryChatMarker`) are
  exported apart so an app can stage the sentence and attach the marker on send; none carries a
  capital or a quantity. The list summary's backend-dev fields (a 60-point `curve` and nine trade
  stats) are optional, since main sends only `annual_return` and `max_drawdown`; `libraryMetrics`
  lists them in web's order and gates and leaves out a benchmark return of 0 (dev's "none"),
  `compactHold`/`compactPace` format the hold and the pace, and `libraryCurve` hands a list the
  summary's curve only. `yearlyVersus` (`YearVersus`) pairs each backtest year with the
  benchmark's, and pairs none when any day lacks a benchmark.
- **Unreleased** — main's v0.9.10 (tagged on main): recommendations are read from the recommendations table, and an F&O idea that
  cannot be placed says why: since backend-go 4c8bf631 `GET /market/recommendations` serves that
  table's rows (`RecommendationRow`, `RecommendationsWire`; `next_batch_at` is no longer sent), and
  `getRecommendations` asks for `kind=equity` unless told otherwise. It keeps what web's
  `recommendationView` keeps (no legs, not the portfolio, not neutral, all six zone edges) and also
  drops a commodity, a zone edge that is not a positive number, a zone written high to low, a stop
  or target on the wrong side of the entry, a status other than open or closed, and a
  `published_at` or `valid_until` that `parseTimestamp` cannot read; a row is dropped whole, never
  thrown on, and `dropped` counts them (not the rows that are not picks). A `Recommendation` is bare
  (RELIANCE), Buy/Sell and pos/cau, its `stop_loss` and `target_price` the zone edges nearest the
  entry, `stop_loss_zone`/`target_zone`/`modify_zone` kept, upside and risk:reward derived, no
  `conviction_pct`. `cmp` is null (the server sends no price and none is made up) and `ref_price`
  is the entry midpoint, or the exit once closed, with `ref_basis` saying which: shown labelled,
  never an order's price; `BasketReco.cmp` says so, and the allocator leaves a NaN or infinite
  price unpriced. `isPickExpired(rec, now)`: an open pick is expired from its `valid_until` on. F&O
  ideas built from that table come with expiry "", spot, capital and conviction 0, lot size 0 when
  unknown and status "open": `fnoIdeaHold` names why Place is held (`closed`, `noExpiry`,
  `expiryPassed` from a bare expiry date's 15:30 IST close, `noLotSize`, `legIncomplete`, which
  takes a leg priced at 0; `isLiveIdea` takes open and active as live), `describeStructure`
  returns null for a structure `structureHold` refuses (both take `now`), `needsCondition` reads
  nothing off a spot or lot size of 0, `marginUnlockPct` nothing off a capital of 0, and
  `ideaFigure`/`ideaLotSize` turn the feed's 0-for-none into null.
- **Unreleased** — main's v0.9.9 (tagged on main): a strategy sized by quantity reads as its count, with no capital: since backend-go
  4c1db7b4 a QTY strategy-action's row carries `budget_config {val: 100000, type: "QTY", qty: N}`,
  and `BudgetConfig` gains `qty` (`type` is `"AMOUNT" | "QTY"`). `budgetMode` reads that `type` as
  QTY (a written `mode` still wins), `budgetVal` hands back `qty`, never the `val` pool (no
  readable `qty` is no size), and `strategyPositionSize` states the count. `budgetHasRealCapital`
  is true only for AMOUNT with a positive figure; `StrategyCardData.hasRealCapital` carries it, a
  QTY script's `allocationMode` is QTY, and no return or drawdown is measured against a pool
  nobody set. `buildConsoleRules` states the count, and `buildConsoleRulesDraft` seeds no size for a
  QTY row with no count (`ConsoleRulesDraft.capital` is optional), never the capital passed in.
  `resolveBrokerageSegment` takes only a strike then CE or PE, joined or spaced
  (`/\d\s*(CE|PE)$/`; web's `/\d(CE|PE)$/` plus the spaced form backend-go keeps), for an option:
  RELIANCE is charged as the stock it is, "NIFTY 24DEC 24000 CE" as an option. Comments say a QTY
  size is sent as `quantity` and QTY is no longer a 400.
- **Unreleased** — main's v0.9.8 (tagged on main): a backtest results payload lists the legs its
  window ended on: `LogPayload.open_trades` (`OpenTradeEntry`: symbol, quantity, buy_price,
  buy_time), optional since older rows have none, as backend-go's `resultsPayload` writes them
  beside `trades`. `istDateTimeParts` and `formatShortDateTime` take `withYear` ("Jul 5, 2026");
  the Console's closed-position rows and fill activity (`consoleRows`) and `formatLogDateTime` now
  date with the year, every other freshness stamp as before. NSE's ticker changes: HEG is HEGAM,
  SILLYMONKS is CRESTO, AMIRCHAND is AEROPLANE and ASHIKA is ASHIKAG in `NIFTY100_SYMBOLS`, the old
  names nowhere.
- **Unreleased** — main's v0.9.7 (tagged on main): comments only, no change in behaviour.
  `isIndexSpelling`'s note now says which exchange-traded funds are held (those spelled from an
  index's name, as core lists no fund) and which start (BANKBEES, JUNIORBEES, SETFNIF50), and that
  BSE starts as a listed equity. The v0.9.6 entry below said that every spelling containing NIFTY,
  SENSEX or BANKEX is held; the tradable indices themselves (NIFTY, BANKNIFTY, FINNIFTY, MIDCPNIFTY)
  and their contracts are not, and it now says so.
- **Unreleased** — main's v0.9.6 (tagged on main): an index's name anywhere is an index, and a list
  says what it names; a narrowing of `tickersHold` and of `isChartSymbol`. "MIDCAPNIFTY", "NSEBANK",
  "NSEI", "BSESN" and "BSE30" are named aliases, and a clean, unlisted, non-contract spelling that
  contains NIFTY, SENSEX or BANKEX is `indexOrBasket` (index funds such as "NIFTYIETF" with them:
  core lists no fund), except the tradable indices themselves (NIFTY, BANKNIFTY, FINNIFTY,
  MIDCPNIFTY) and their contracts, which start as before; no equity core lists contains one, and
  "BSE" and "BANKBEES" still start. Placeholders add XXXX, TBC, SYMBOL, TICKER and UNKNOWN. A list
  of two or more names is `indexOrBasket` when one is an index ("RELIANCE, NIFTY50"),
  `severalSymbols` otherwise, and `unreadableSymbols` only beside fewer than two names.
  `isChartSymbol` charts one name spelled as a symbol, or a listed equity itself or with "-EQ",
  never a join ("HDFCBANK ICICIBANK", "HDFCBANK&ICICIBANK", "TCS.INFY").
- **Unreleased** — main's v0.9.5 (tagged on main): any spelling of an index is an index; a narrowing
  of `tickersHold`, and `isChartSymbol`. Index aliases passed as letters and digits and
  `isFnOSymbol` read them as equities, so a delivery card on one read no segment switch: "NIFTY50",
  "NIFTYBANK", "SENSEX30", "CNXIT", and NSE indices core does not list ("NIFTYINFRA", "NIFTYPSU"). A
  cleanly spelled symbol that is not a contract is `indexOrBasket` when it starts with an index root
  (NIFTY, BANKNIFTY, FINNIFTY, MIDCPNIFTY, SENSEX, BANKEX, CNX) or its underlying is a tradable
  index it is not, unless it is a tradable index itself or an equity core lists; "NIFTYBANK",
  "NIFTYFIN", "NIFTYNEXT50" and "BSESENSEX" are named. Core's equity list holds nothing on those
  roots and no ETF, so "NIFTYBEES" and "NIFTY1" are held with the indices. Placeholders add TBA,
  NULL, UNDEFINED, NAN, NIL, XXX. A list is `severalSymbols` only when two of its parts are symbols,
  else `unreadableSymbols` ("NA, TBD", "RELIANCE, -"). `isChartSymbol(symbol)` is the looser rule a
  chart reads: one named part, not a placeholder or a basket.
- **Unreleased** — main's v0.9.4 (tagged on main): one clean symbol is one a strategy can trade; a
  narrowing of `tickersHold` (so of `scriptRunOf`) and two new reasons. Any run of letters, digits
  and `& . _ -` passed, so non-tradable indices ("NIFTY100", "SENSEX"), core's own baskets
  ("NSE500", "FNO", "ALL"), placeholders ("-", "NA") and joins ("HDFCBANK&ICICIBANK", "TCS.INFY",
  "RELIANCE.NS") started as one symbol, most reading no segment's kill switch. Now one symbol has a
  letter, letters and digits only, an `&` or `-` only where an equity core lists carries one
  (`NIFTY100_SYMBOLS`, the 2058 NSE equities the app resolves, and `FNO_STOCK_UNDERLYINGS`; itself
  or as a contract's underlying), a `.` only in an option's strike, and at most `MAX_SYMBOL_LENGTH`
  (28: the ISO option spelling on a 10-letter underlying with a 6-digit, one-decimal strike,
  measured; core's longest tested spelling is 25). Placeholders ("-", ".", "NA", "N/A", "NONE",
  "TBD") are `noSymbol`; every NSE or BSE index outside `TRADABLE_INDICES`, by symbol or name, and
  every `BASKETS` name is the new `indexOrBasket`; one part that is not a symbol is the new
  `unreadableSymbol`, and `unreadableSymbols` is left to stray commas. `strategyConflicts` exports
  `BASKETS`.
- **Unreleased** — main's v0.9.3 (tagged on main): a C strategy card starts only on exactly one
  clean symbol; one more narrowing of `scriptRunOf`, otherwise additive. Only a comma separated
  symbols, so "HDFCBANK ICICIBANK", "HDFCBANK;ICICIBANK", "HDFCBANK/ICICIBANK" or a newline read as
  one symbol, started, and went out joined all the same. `tickersHold(tickers)` (`TickersHold`) is
  the rule and `isOneSymbol` its yes: no part with anything in it is `noSymbol`; more than one is
  `severalSymbols`; one, beside a stray comma (",HDFCBANK", "HDFCBANK,") or not spelled as a symbol
  (letters, digits and `& . _ -`, or a `TRADABLE_INDICES` index by its spaced `NSE_INDICES` name,
  "NIFTY 50", "NIFTY BANK"), is the new `unreadableSymbols`. `ScriptCardHold` gains it;
  `scriptCardHold` reads the rule after `runnable: false`. `tickers` that are not a string name no
  symbol: `tickersOf`, `tickersHold` and `termsToConfig` no longer throw on an array or a number.
  `market/symbols` exports `TRADABLE_INDICES`.
- **Unreleased** — main's v0.9.2 (tagged on main): a C strategy card is started only on one symbol
  whose code the engine can run; one narrowing of `scriptRunOf`, otherwise additive. Every run of a
  C card sends its `tickers` as one `symbol`, which backend-go main's `cardRow` makes a single
  symbol ("HDFCBANK, ICICIBANK", no runner trades it) while the card says Running and shows one
  amount for what the code may buy of each; v0.9.1 made multi-symbol v3 cards startable, and v2
  cards naming several always were. `scriptCardHold(terms)` (`ScriptCardHold`) says why a C card is
  held: `notRunnable` (`runnable: false`, which web ignores), `noSymbol` (its `tickers` name none)
  or `severalSymbols`. `scriptRunOf` is null for a held card, so no request is built for one;
  `isScriptCard` is still true for it (its rules are its code). `tickersOf(tickers)` and
  `TICKER_SEPARATOR` are the one split rule, a comma with any spaces around it, a stray comma kept
  as an empty part; `resolveStrategyChartSymbol` reads it, refusing what it refused.
  `SCRIPT_ENTRIES_C` is frozen.
- **Unreleased** — main's v0.9.1 (tagged on main): a C strategy card is `script_entry`
  `"evaluate_v2"` or `"evaluate_v3"`, as web main reads it (5b02f608: v2 runs one symbol, v3 every
  symbol of the row in one call); additive. Before it a v3 card read as a plan without code, so a
  host showed it retired with nothing to start. `strategy/strategySetupConfig` gains
  `SCRIPT_ENTRIES_C` and `isScriptEntry(entry)`, an exact match of that set; `scriptRunOf` and
  `isScriptCard` read through it. Web matches `/^evaluate(_v\d+)?$/`; the set keeps an entry not
  shipped yet (`evaluate_v4`, a bare `evaluate`) a card that cannot be started. `SCRIPT_ENTRY_C` is
  still exported and still v2 alone. Requests are unchanged: no strategy-action body names an entry,
  as backend-go main's `StrategyActionRequest` has no such field and passes Athena only `code`,
  `script_hash` and `script_sig`, and web sends none; a v3 card's requests carry its own code, hash
  and signature.
- **Unreleased** — two web-parity changes, released on main as v0.9.0. One breaking type change:
  `ChatWithMessages.messages` and `SharedChat.messages` are optional, because backend-go tags
  `Chat.Messages` `omitempty` and a chat with nothing saved yet (just created, or its first turn
  still being written) arrives without the key; a host that read the list unguarded must treat
  absent as nothing saved yet. Additive: `marketMoment(now)` and `MarketMoment` (`preOpen`, `live`,
  `closed`, `weekend`, `holiday`, `unknown`) in `market/marketHours`, web's moment for the chat
  greeting, in IST; `preOpen` is the whole morning before 09:15, not the pre-open auction.
- **Unreleased** — main's v0.8.6 (tagged on main), less what this branch already has (the
  dev-era library `97e4a5f`, the baskets' backtest maths `362658a`, `7bd6b76`): the black-box
  strategy library in backend-go `main`'s shapes, which production serves, and web main's reading
  of them. A strategy gains `slug`, `has_backtest` and the server's `backtest_summary`
  (`annual_return`, `max_drawdown`, fractions); the detail's `backtest` is the published one
  (`label`, `window_start`, `window_end`, `benchmark`, `daily`, `trades` with an optional
  `side: "short"`) or null, where dev's was always null; `getStrategyLibraryActivity(key)` reads
  `GET /templates/strategy-library/{key}/activity`, `{activity: {date, live, buys, sells} | null}`.
  The detail and activity take a slug or an id. `/source` (LLM key) and the service refresh are not
  bound. `queryKeys.strategyLibraryActivity(key)`. The page's reading, as on main:
  `publishedLibrary`, `hasFnoStrategy`, `libraryBacktestLead`, `libraryWinPeriods`, `liveThrough`,
  `positionKey`, `tradesBothWays`, `sideLabel`, `tradesWithLiveSession`, `libraryTradeLog`,
  `tradeRowKey`, `activitySession`, `isTodaysSession` and `DEFAULT_LIBRARY_CAPITAL`.
  `market/basketBacktest`'s `summarize` counts any periods by their net return (a basket's months
  still fit), the curves take a read-only day list, and `annualisedReturn` is exported. Main's
  `basketBacktest` is the same maths over a structural day, without `picksByReview`; a merge of
  v0.8.6 keeps this branch's, and drops main's `type BacktestDay` export from `market/index.ts`.
  `MONTH_SHORT_NAMES` spells September "Sept", as web's `Intl` en-IN months do (dates elsewhere
  keep "Sep"). Main's `deriveChatTitle` keeps a hidden `[<…>]` marker, as web main's does; this
  branch keeps stripping it, as web `dev`'s does, so a merge of v0.8.6 must keep this branch's.
- **Unreleased** — main's v0.8.5 (tagged on main), less the screener moves this branch already has
  (`bff22bc`): the 401s that keep a session, dividends keyed without an id, and a VWAP of 0 as
  N/A. One breaking type change: `GetDividendsResponse` drops `id`, `fetched_at` and `created_at`.
  `RequestInit` gains `ownUnauthorized`, the words of a 401 the route answers itself:
  `userApi.updatePassword` sends `OLD_PASSWORD_INCORRECT` ("Old password is incorrect", backend-go
  `handlers/user/updatepassword.go`), so a wrong old password is the form's error rather than a
  sign-out (main 132eed7c revokes tokens on a password change). `RequestInit` also gains
  `forwardsUnauthorized`, for a route that answers with another service's status:
  `tradingApi.buyStock` and `sellStock` (the trade manager's, `forwardTrade`),
  `chatApi.startVoiceSession` (the voice service's), and `tradingApi.getPortfolioAnalysis` and
  `getBacktestAnalysis` (the LLM service's, as "LLM error: …"). On such a route only a 401 in the
  auth middleware's words (`SESSION_UNAUTHORIZED`, `internal/middleware/auth.go`) ends the session.
  `endsSession(message, init)` is the rule a host applies; a route that declares neither field
  fails closed, any 401 ending the session. Neither backend sends a dividend id: main's
  `dividendEventsQuery` (`internal/repository/news/queries.go`, since f388c12) selects no `id`,
  `fetched_at` or `created_at`, and dev's Doom `DividendEvent` has none either, so every row keyed by
  its id read `div-undefined-…` in production. `GetDividendsResponse` drops the three fields, and
  `market/dividendKey(row)` keys a dividend by its stock, ex-date (the announcement date before one
  is set), type and amount, as web 66d641c3 does; `buildCorporateActions` keys its dividend rows by
  it. The VWAP row of `data/indicatorsConfig` reads 0 as N/A: backend-go `dev` does not ask Doom for
  VWAP on 1d or 1w and answers the missing figure as 0.
- **Unreleased** — the C strategy cards' run (web `feat/athena-integration` 0bc7e131); additive
  only. A chat plan card whose `terms.script_entry` is `"evaluate_v2"` with a `script` and
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
  The options direction detail (web dev 2226a1e1, d0cf6fe2: the option chain's "Options
  direction" panel, `FlyoneDetailPanel` and its charts), read-only; additive only.
  `marketApi.getFlyoneDetail(symbol, {expiry?, date?})` is `GET /market/flyone/detail` as backend-go
  `handlers/flyone/live.go` on dev serves it (`expiry` a rank or an exact expiry, `near` when
  omitted; the latest stored day without a `date`), with `FlyoneDetail` (`symbol`, `date`,
  `lot_size`, `expiries` as `FlyoneDetailExpiry`, `latest` or null, `history` as
  `FlyoneHistoryPoint`, `widths` as `FlyoneWidth`, `curve` and `curve_lookback` as `FlyoneCurve`
  of `FlyoneCurvePayload`) and `FlyoneDetailParams`; a curve's density and gamma figures are
  `number | null`, as the engine writes a non-finite one as null. `queryKeys.flyone.detail(symbol,
expiry?, date?)` keys it as web does (`near` and `"latest"` when omitted). `market/flyoneDetail`
  holds the maths web keeps inside its chart components, in chart units: `densityView(now,
before, width?)` (the picked width, else the middle one; both curves area-normalised, over spot ±
  3.5σ, the gridlines 1σ apart; null under three bodies), `nearestPointIndex` for a readout,
  `gexBarsView(payload, row)` (`empty` with no open interest, `none` with no strike within 2.5σ of
  spot, else the bars, their scale and the flip when in range), `gexTickEvery`, the timeline's
  `timelineTicks`, `timelineIndexAt` and `timelineScoreY`, and `isShownExpiry`. The steps under
  them (the normalising, the width pick, the σ reaches) stay inside the module.
  The stock page's Regime tab, live (web dev `RegimeTab.tsx` `LiveRegime`, `regimeBlocks.tsx`,
  `chartFrame.tsx`); additive only. `marketApi.getRegimeDecay(symbol, date?)` reads
  `GET /market/regimepulse/decay` (backend-go `handlers/regimepulse/live.go` `Decay`, dev), answering
  `RegimeDecay` (`rows: RegimeDecayRow[]`: each tracked contract's LTP, actual and decay-only
  change, gap, `gap_z` and `roc` per engine cycle, oldest first; `signal` blank unless internal),
  keyed `queryKeys.regimePulse.decay(symbol, date?)` as web keys it. `market/regimePulse` gains
  `sessionOverview(rows)` (open, high, low, last spot with the bar each was set on, and the change
  — web's session tiles), `canChart(rows)` (two bars or more), `latestDecay(rows)` (the newest
  cycle, calls before puts, each by strike — web's decay-gap table) and web's chart-frame scale:
  `chartExtent(values, include?)`, `chartTicks(extent)` and `chartXTicks(n)`.
  ATM lock's maths (web feat/chart-parity `src/utils/market/atmLock.ts`, 84649fe2); additive
  only. `market/atmLock`: `atmLockTarget(spot, strikes, current, hysteresis = 0.1)` is the listed
  strike nearest spot, moving off the current one only once spot is past the midpoint by a tenth
  of the gap; a strike the list no longer carries snaps straight to the money. The list may come
  in any order. `crossedMidpoint(from, to, strikes)` names the midpoint a move crossed.
  A backtest's trades and the user's own as round trips, the journal's figures, trade excursion and
  a seeded Monte Carlo (web `feat/chart-parity` 76f1dfee, 10a0f390, 564c3b99, 148eba34); additive
  only, pure. `strategy/roundTrips`: `RoundTrip` (`id`, `symbol`, `side`, `qty`, `entryMs`,
  `entryPrice`, `exitMs`/`exitPrice`/`pnl` null while open, `exitReason?`, `source`
  `TripSource`: `backtest`, `mock`, `live`, `strategyId?`), `tradeInstantMs(value)` (a time with no
  offset is IST wall clock, the engine's), `backtestRoundTrips(trades)` (one trip per
  `ExecutionLogEntry` row, `bt<i>`, short by `trade_side`, a row with no recorded P&L kept without
  one rather than as ₹0), `bookRoundTrips(trades)` (Mock and Live lots only, premium-aware as
  `calculatePNL`) and `tripSymbols(trips)`. `strategy/journalStats`: `filterTrips(trips, filter)`
  (`JournalFilter`), `journalStats(trips, isExpiryDay?)` (closed trips only: win rate, net,
  expectancy, avg win and loss, avg R with 1R the average loss, profit factor, every entry hour
  with the best and worst among hours of `MIN_TRADES_PER_HOUR` or more, and an expiry-day split
  that counts a day the calendar cannot place apart), `istDay`, `istHour`, `hourLabel`.
  `strategy/tradeExcursion`: `tradeExcursion(trip, bars, barMs)` (MAE, MFE, the best exit and
  exit efficiency from the candles a trade was open through; a price its candle never traded,
  past `PRICE_TOLERANCE`, is refused as `entry-off-candles`/`exit-off-candles`) and
  `tripExcursions(trips, minute, daily)` (minute candles where they reach the entry, else daily).
  `strategy/monteCarlo`: `runMonteCarlo(MonteCarloInput)` (a mulberry32 bootstrap of the trade
  P&Ls, not compounded: the fan's percentiles at `fanSteps(n)`, final-return and max-drawdown
  percentiles and histograms, loss and ruin shares, the mean trade's middle 95% and the
  `EdgeVerdict`), `ruinProbability(result, threshold)` (re-read from the same paths),
  `MIN_MONTE_CARLO_TRADES` (20), `DEFAULT_PATHS`, `DEFAULT_SEED`; and the same run a slice at a
  time for a host with no worker: `createMonteCarloJob(input)` (`MonteCarloJob`),
  `advanceMonteCarlo(job, maxDraws?)` (whole paths within the draw budget, then the fan's steps
  a few sorts at a time; always at least one), `isMonteCarloDone`, `monteCarloProgress` (0–1),
  `monteCarloDraws(job)` (paths × trades) and `monteCarloResult(job)` — the same seed gives
  `runMonteCarlo`'s figures however it is sliced. Web's bar-replay cut (`tripsAsOf`) and
  `tripPnlAt` are not ported: nothing here reads them. `market/sampling` holds the seeded
  `mulberry32` and `percentileSorted` both Monte Carlos draw with (the basket backtest's band
  now reads them there; the same stream it drew before). `market/expiryDays`:
  `expiryCalendar(catalogue, from?)` (the listed expiries, and past Tuesdays from
  `NSE_TUESDAY_EXPIRY_FROM` worked out over the holiday table, a month outside it left out) and
  `FNO_HISTORY_START` (stored 1-minute F&O history starts 2 Jan 2026); `market/marketHours`
  gains `hasHolidayCalendar(date, market?)` and `IST_OFFSET_MS`. `format` gains
  `formatChartLongDate(ms, intraday)` ("12 Mar 2026, 10:15", IST). `GraphDataQuery` gains
  `page` (`GraphDataPage`: `to`, Unix seconds, and `count`), sent as `to`/`count` — minute paging
  backend-go serves on `feat/chart-parity`; a backend without it answers the plain period.
  The screener's percentage cells follow web main 6414e7a6: a move (`isSignedField`: returns,
  1D %, gap, distance from the 52-week high and low) reads to two decimals, any other percentage
  to one, and a figure of 100 or more to none.
  A C card's code signature (web `feat/athena-integration` 046148aa, backend-go 5a8a6525
  `strategyaction.go`); additive only. `BacktestSetupTerms` gains `script_sig`, llm's signature of
  the card's code for this user, which the backend passes to Athena untouched and Athena may
  require ("this code was not built for this user"). `ScriptRun` gains `scriptSig?`, set by
  `scriptRunOf` only from a non-empty string (an empty one is none, as the backend reads it);
  `StrategyActionRequest` gains `script_sig?`, which `scriptAction` sends exactly when the card
  carries one and `replaceAction` keeps, so the resend after a 409 carries the same signature as the
  request it answers. A backend without the field ignores it.
  A forked chat's shared strategies, read-only (web `feat/athena-integration` 3eb0664b, backend-go
  19740aa5…5a8a6525); additive only. `getChatByIdResponse` is now `ChatWithSource`: the chat with
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
- **Unreleased** (was planned here as v0.8.5; main's v0.8.5 is another release) — the depth
  reading; additive only. `MarketDepth` gains what the backend's
  `handlers/market/depth.go` (dev) serves beside the ladder: `interpretation` (the quant's Depth
  IEP reading, `DepthInterpretation`, field names the script's own), `interpretationError` (why a
  book was refused one), `session` (`MarketSession`: `preopen` / `open` / `closed`, which part of
  the day the book was served for), `auction` (`PreOpenAuction`, NSE's call auction on the visible
  pre-open book), and the three fields the app read through its own extension until now: `symbol`,
  `ltp` and `note`. `market/marketHours` gains `PRE_OPEN_START` (09:00) and `marketSession()`,
  web's `marketSession` as it is (mirrors `calendar.SessionAt` in backend-go). `market/depthReading`
  holds the three rules both panels apply: `fairLimitPrice` (the rounded IEP at two decimals, what
  "Use as limit" fills), `depthRefusal` (`crossed` or `thin`, the two things a reader is told), and
  `depthBookStatus` (`live` / `stored` / `preopen` / `closed`; an earlier day's book served in
  market hours is `stored`, web 3cf478ff, and only a `live` book offers its fair price).
  The research report (web `interfaces/manualReport.ts`, dev 2226a1e1): `types/manualReport`
  carries `ManualReportPayload` and its parts (`ReportItem`, `ReportKpi`, `ReportGap`,
  `ReportCardSection`, `StageResult`, `ReportFact`, `ReportVerdict`, `ResearchNote`,
  `IndustryGuide`, with the gate, cap, stage and coverage shapes named), and `ChatCard` gains
  `{type: 'report'; payload: ManualReportPayload}` — a host with an exhaustive switch over
  `ChatCardType` adds the one case. There is no endpoint: the payload is the chat card's.
  `market/manualReport` holds what web's ResearchReport page derives from it, as it does: the
  vocabulary (`REPORT_MARK_WORD`, `REPORT_STOP_WORD`, `REPORT_MARK_GLYPH`, `REPORT_VIEW_LABEL`,
  `REPORT_STAGES`, `REPORT_GAP_STATUS_WORDS`, `REPORT_BAND_LABEL`), the figure formatting
  (`reportNumber` — Indian grouping, at most two places — `typographicMinus`, `factUnit`,
  `bareLabel`, `factText`, `kpiValueText`, `signedChangeText`, `reportDay`), the names
  (`reportShortName`, `capBandLabel`, `reportBenchmark`, `reportSector`), the citations
  (`reportFactIndex`, `citedFacts`, `citesLine`, `kpiGapLine`, `kpiTrail`), the tables
  (`historyTable`, `coverageGroups`, `fiscalYears`, `figureRows`), the summary strip
  (`reportKeyFigures`), the gate tally (`gateTally`), `coveragePct`, `partTitle`, `partTally`,
  `qualityGoodCount`, `monitorChips`, `riskChainSteps`, `sparkPoints` and `gapStatusWord` (a status
  the table does not know reads as itself). A KPI's `value`, the stage's `ma200_slope_pct` and
  `volume_ratio`, and the cap's `mcap_cr` are `number | null` and optional, as the wire can leave
  them: a host reads null as absent. Web's
  `utils/market/manualReport.ts` (localStorage for the page's new tab) stays in web.
  The chat's evidence cards, as web's `interfaces/chatCards.ts` declares them (dev 2226a1e1):
  `ChatCard` gains `{type: 'depth'; payload: {books: DepthCardBook[]}}` — `DepthCardBook` is one
  order book the depth branch read, as it stood when read, with the book's own `source` line, its
  `live` flag, its `status` (`stock` / `contract` / `index`), a contract's parts, and the ladder in
  the wire's snake case (`total_bid_qty`, `as_of`, `interpretation`, `auction`).
  `{type: 'sectors'; payload: SectorsCardPayload}` — the sector reading as read: the
  `RsSectorMatrix` itself (carried, not fetched again, so card and answer agree in an old
  transcript too), `focus`, `highlight`, the `pair` asked about or null, `source`, and `method`
  (how the standings are worked out, in plain words; absent on older messages).
  `{type: 'market_profile'; payload: MarketProfileCardPayload}` — the profiles as read, one per
  instrument (`name`, web's `page` path, the `ProfileSnapshot` and its `source` line), and
  `horizon` (`intraday` / `swing` / `both`), which setups the question was about.
  The options regime, read-only (web dev 2226a1e1): `types/regimePulse` carries the wire types
  as backend-go's `internal/models/regimepulse.go` (dev) serves them: `Regime` (the five regimes
  and `WARMING_UP`), `RegimeRow` (one reading per underlying: spot, the bias figures, the ATM
  straddle and IVs with their changes, expiry, ATM strike, `regime_since`; the internal signal
  fields blank for everyone else), `RegimeSentimentRow`, `RegimeSnapshot`, `RegimeSentiment`,
  `RegimeDetailMeta` (`lot_size` null when the table does not know the underlying) and `RegimeDetail`. `marketApi.getRegimeSnapshot(date?)`,
  `getRegimeSentiment(date?)`, `getRegimeDetail(symbol, date?)`, `getRegimeMe()` and
  `getRegimeSymbols()` are the `GET /market/regimepulse/*` reads web's `useRegimePulse` makes
  (routes per backend-go `main.go` on dev); `queryKeys.regimePulse` (`snapshot`, `sentiment`,
  `detail`, `me`, `symbols`) keys them as web does, a missing date as `"latest"`.
  `market/regimePulse` holds what web keeps beside the chip, as it is at dev 2226a1e1:
  `REGIME_ORDER`, `REGIME_SHORT`, `REGIME_LABEL`, `REGIME_READING` (the post-6448ede1 sentences),
  `regimeTone` (lean and strength, in place of web's CSS colour tables), `isBullish`/`isBearish`,
  `zBiasRegime`, `clockOf`, `fractionPct` (web's `pctOf`; core's statement rows already export
  that name), `signed`, `signedFixed`, `ivPointsOf`, `breadthCounts`, `regimeDistribution`,
  `hasRegime`, `regimeMap` (rows keyed by underlying), `regimeKey`/`regimeRowFor` (web's
  `regimeWatch`: a watchlist spelling to the engine's underlying, with web's index aliases —
  NIFTY50, NIFTYMIDSELECT, NIFTY MID SELECT, NIFTYFINANCE, NIFTY FIN SERVICE), and the reading stamp web 993b2ca1 writes inline in its card:
  `regimeStamp` (live on the row's own day in market hours, else at close) and
  `regimeChangedSince`. The alert, backtest, chain-overlay and replay routes stay for the units
  that draw them.
  The last three chat cards (web dev 2226a1e1, `c338cfa2`): `ChatCard` gains
  `{type: 'regime'; payload: {underlyings, levels?, answered?, answered_at?}}` (the card is live;
  the payload says only what the answer said and when), `{type: 'regime_backtest'}` with web's
  payload `{symbols, expiry, from?, strategy}` (`RegimeStrategyId` names the strategy; web runs
  the backtest from the card, and its answer's types land with the unit that runs it) and
  `{type: 'flyone_screen'; payload: FlyoneScreenCardPayload}`. The option levels engine (web
  `interfaces/flyone.ts`, backend-go `handlers/flyone` on dev): `types/flyone` carries `FlyoneRow`
  (one chain's minute: spot, the expected move, put wall, gamma flip, call wall, the dealer
  regime, the engine's call), `FlyoneSnapshot`, `FlyoneScreen`, `FlyoneScreenParams` and the card
  payload. `marketApi.getFlyoneSnapshot(expiry, date?)` (every chain at once) and
  `getFlyoneScreen(params)` (symbols joined with commas, an empty list dropped; the backend
  filters the same latest rows the snapshot serves, so `symbols=[u]` is one chain's full row) are
  web's two reads; `queryKeys.flyone` (`snapshot`, `screen`) keys them as web does. `market/flyone`
  is the whole of web's `utils/market/flyone.ts` less its CSS, kept whole for the direction sheet
  and direction scanner units that read its direction, pattern and width-vote helpers: the
  direction and pattern words, the dealer regime's label, reading and tone (`gexTone`),
  `OI_NOTE`, `levelOf`, `pctAway`, `levelsReading`, `isThin`, `isWarmingUp`, `pendingDirection`,
  `parseWidthVotes`, `disagreesWithRegime`; plus `levelsReadingParts` (the reading's parts, which
  `levelsReading` words in web's English, for a host to word in its own catalogue) and what web's
  cards work out inline: `callWallSide`/`putWallSide` (a wall named by its side of spot, web
  c338cfa2; level with spot it keeps its own name) and `nearestWall`/`nearestWallText`
  ("put −0.4%"). `format/date` gains web's `formatExpiryDate` ("8 Oct 26", en-IN in IST, empty
  when unreadable).
  The options regime scanner (web dev 2226a1e1, `RegimeScanner.tsx` and the shared
  `ScannerTable`, 0b090599): `marketApi.getRegimeDates()` (`GET /market/regimepulse/dates`, the
  stored trading days newest first, as backend-go `handlers/regimepulse/live.go` on dev serves
  them) with `RegimeDates` and `queryKeys.regimePulse.dates()`. `market/regimeScanner` holds what
  web works out around the table: `filterRegimeRows` (web's search — symbol, regime id, label or
  short label, trimmed and case-blind — under the multi-select regime filter),
  `REGIME_SORT_KEYS`/`RegimeSortKey` (the table's sortable columns), `REGIME_DEFAULT_SORT`
  (`zBias`), `regimeSortStartsDescending` (figures high-first, text A–Z) and `sortRegimeRows`
  (ties by symbol either way, a missing figure last; a code-point tie-break where web calls
  `localeCompare`), and `regimeScannerStatus` (`replay` / `live` with the engine's cycle /
  `lastSession` at the newest reading / `closed`), for each app to word.
  The options direction scanner (web dev 2226a1e1, `DirectionScanner.tsx` and
  `DirectionScannerTable.tsx`): `marketApi.getFlyoneDates()` (`GET /market/flyone/dates`, the
  stored trading days newest first, at most 60, as backend-go `handlers/flyone/live.go` on dev
  serves them) with `FlyoneDates` and `queryKeys.flyone.dates()`. `market/scannerSort` is the sort
  web's shared `ScannerTable` puts both scanners in (`ScannerSortSpec`, `sortScannerRows`,
  `scannerSortStartsDescending`); `sortRegimeRows` now runs on it, unchanged.
  `market/directionScanner` holds what web works out around the direction table: the universe
  toggle (`DirectionUniverse`, `DIRECTION_UNIVERSES`, `inDirectionUniverse` and
  `directionUniverseRows`, indices by `isIndexSymbol`, so SENSEX and BANKEX count as indices),
  `directionBreadth` (a count per call with warming chains in none, and the calm, fast and
  balanced dealers), web's five presets as data (`DIRECTION_PRESETS`, `DirectionPresetKey`,
  `directionPreset`, `NEAR_WALL_PCT`; each app words their labels and hints), `clashesWithRegime`
  (the scanner's "!": a call against the regime of the same name, never while warming up),
  `filterDirectionRows` (the direction filters, which never keep a warming chain, a preset joined
  to the regime map, and the symbol search), `DIRECTION_SORT_KEYS`/`DirectionSortKey`,
  `DIRECTION_DEFAULT_SORT` (`score`), `directionSortStartsDescending` and `sortDirectionRows`, and
  `directionScannerStatus` (the regime scanner's four states, the last session carrying its day
  as web's direction status prints it).
- **Unreleased** (was planned here as v0.8.4; main's v0.8.4 is another release) — the rule-based
  baskets, read-only; additive only. `esfApi.getBaskets()`
  (`GET /esf/baskets`), `getBasket(slug)` and `getBacktest(slug, id)` with the wire types as the
  backend's `handlers/esf/baskets.go` serves them (`EsfBasketCard`, `EsfBasketDetail`,
  `EsfBacktestDetail` and their parts, nullable where the Go struct is a pointer), and
  `queryKeys.esfBaskets` / `esfBasket` / `esfBacktest`, keyed as web keys them. Web's
  `basketFormat` helpers move into `market/basketFormat` as they are (web dev 2226a1e1): the
  cadence, review-day and stock-count copy, `minAmountHint` (the minimum explained with the
  basket's own numbers, web e22b9154), `basketHeadline` (the live record once it is a year long,
  else the primary backtest), `navSummary`, `trackingStart`, `planBasketBuy` and
  `subscriptionStatusLabel`. Web's `periodLabel` / `periodsLabel` are `reviewPeriodLabel` /
  `reviewPeriodsLabel` here, because fundamentals already exports a `periodLabel` for a filed
  statement. `market/basketBacktest` is web's `utils/market/basketBacktest.ts` as it is:
  `equityCurve`, `dailyReturns`, `yearlyReturns`, `monthlyReturns`, `summarize` (final multiple,
  annual return once a year is on record, worst trough and its day, Sharpe at a 0% risk-free
  rate, win rate by review), `monteCarlo` (seeded, so the band holds still) and `picksByReview`;
  `market/basketCharges` replays a backtest's trades at a capital on a broker's published rates
  (`basketCharges`). To carry it, `trading/orderCharges` gains web's `ChargeTotals`, `NO_CHARGES`,
  `addCharges`, `chargeGroups` and the `ChargesBreakdown` that `OrderChargesEstimate` now
  extends; `estimateOrderCharges` is unchanged in what it returns. `format` gains
  `signedFractionPct` (0.042 → "+4.2%") and `MONTH_SHORT_NAMES`. The alerts gain the baskets
  scope as web has it (web 635bdd59): `AlertScope` adds `'baskets'`, `AlertChannelId` adds
  `'basket_rebalances'`, `ALERT_SCOPES`, `ALERT_CHANNELS` and the defaults list the one channel
  ("Basket reviews", on by default once the master is), and `withAlertsEnabled` flips the
  master the way web does, subscribing to the defaults when nothing is chosen.
  The channel is the backend's `alert_preferences.basket_rebalances` (migration 000034), which
  its nightly review broadcast reads; `POST /market/basket/follow` writes a `basket_followers`
  row nothing reads, so it is not here. A host with a `Record` over `AlertScope` or
  `AlertChannelId` adds the one entry.
  Investing in a basket (web dev 635bdd59, backend dev `handlers/esf/subscriptions.go`); additive.
  `esfApi.subscribe(slug, {mode, capital, confirm_live})` is `POST
/esf/baskets/{slug}/subscriptions` and answers the created `EsfSubscription`; the backend
  places the first orders inside that call and trades the subscription at every review after
  with no further consent, so a request that gets no answer may have created it, and a host
  re-reads the basket rather than sending again. `esfApi.setSubscriptionStatus(id, status)` is
  `PATCH /esf/subscriptions/{id}` with `{status}` (`active`, `paused`, `cancelled`; cancelled
  removes the row) and answers the bare `EsfSubscriptionRecord`, which `EsfSubscription` now
  extends. `EsfSubscribeRequest` and `EsfSubscriptionStatusRequest` are the bodies.
  `market/basketSubscribe`'s `esfSubscribeRefusal(error, fallback)` reads a failed subscribe on
  either host's error shape: 409 `alreadySubscribed` ("You already subscribe to this basket"),
  412 `noBroker`, 400/422 `invalid` (the mode, the capital floor, a live subscription without
  `confirm_live`) with the backend's text, 401/403/404/429 `refused`; null for a timeout, the
  network or a 5xx, where the subscription may exist. `esfSubscriptionTouches(slug)` lists what
  such a write invalidates, as web does: the basket's detail and the cards.
- **Unreleased** (was planned here as v0.8.3; main's v0.8.3, below, is another release) — the
  screener's ESF prebuilt screens; additive only. `PrebuiltScreen` gains an
  optional `sort` (`{key, dir}`), and `PREBUILT_SCREENS` opens with web's seven FinStocks Score
  screens (`esf-leaders`, `esf-growth-leaders`, `esf-big-money`, `esf-ready-to-rise`,
  `esf-fair-price`, `esf-graham`, `esf-strong-health`), each a single `esf_*` flag filter with the
  score columns and a sort — by `esf_score` descending, by `esf_volume_score` for the accumulation
  screen, and by `esf_peg` ascending for the PEG screen. A host opens a preset with
  `sort: screen.sort ?? EMPTY_SCREEN.sort`, as web's ScreenerBody does. New `hasKnownFields(index,
{filters, columns})` says whether a catalogue knows every field a screen filters on or shows;
  the `esf_*` fields exist only on the backend's `dev` catalogue, and a host that lists presets
  should hide the ones its loaded catalogue cannot answer (web does not yet; `pruneScreen` would
  otherwise drop every filter and open the whole market as matches). The row closes with web
  dev's three options-regime screens (`regime-leaning-up`, `regime-leaning-down`,
  `regime-rangebound-melting`, RegimePulse 48a081d5) on the `regime_*` fields, which likewise exist
  only on the backend's `dev` catalogue; they carry no sort. `pruneScreen` now also checks the
  sort: a key the catalogue does not serve (other than `name`) falls back to `EMPTY_SCREEN.sort`,
  so a link from a richer catalogue cannot leave a dead sort behind. Also the black-box strategy
  library (web dev `src/interfaces/strategyLibrary.ts`, backend dev `GET
/templates/strategy-library` and `/{id}`): the `LibraryStrategy` types,
  `templatesApi.getStrategyLibrary` / `getStrategyLibraryDetail`, `queryKeys.strategyLibrary` /
  `strategyLibraryDetail`, and web's reading of it in `@finstocks/core/strategy` — the labels,
  the six-step SEBI risk scale (`RISK_LEVELS`, `riskLabel`, `riskShort`, `riskTone`, `clampRisk`),
  `riskDrivers`, `backtestPreview`, the chat hand-off (`libraryChatMessage`, `libraryChatContext`),
  and the client-side filters and sorts (`LibraryFilterState`, `applyLibraryFilters`,
  `sortLibrary`, `nextLibrarySort`, `viewLibrary`, `presentValues`, `scopeLibrary`). Every sort
  keeps reference strategies after the deployable ones. `deriveChatTitle` now strips hidden
  `[<…>]` markers, as web's does, so a library chat's title never shows one; a no-op for every
  message that carries none. And the RS Sector Matrix (web dev
  `src/components/pages/markets/rssectormatrix`, backend dev `GET /market/rs-sector-matrix` and
  `/pair`): the `RsSectorMatrix` / `RsPair` types, `marketApi.getRsSectorMatrix(box?)` /
  `getRsSectorPair(row, col, box?)`, `queryKeys.market.rsSectorMatrix` / `rsSectorPair`, and web's
  reading of the answer in `@finstocks/core/market` — `indexName`, `resultsAt`, `splitResults`,
  `lossesAt`, `beatingBenchmark`, `rsShortLabel`, `resolvePair` / `pickRow` (how a `?rs=&vs=` link
  settles against the data), the P&F chart geometry in log boxes (`pfSpans`, `pfExtent`,
  `pfLastColumnBoxes`, `pfRatioChange`), `RS_BOXES`, `RS_DEFAULT_BOX`, `RS_TOP_N`. Nothing here
  computes P&F; the backend does. The link into the section is `sectorStrengthPath(pair?)` /
  `parseSectorStrengthPath(path)` (`/market?rs=A&vs=B#sector-strength`), so a chat button and
  both apps spell it once. A chat answer's next-step button can now open a page:
  `FindingActionType` gains `open_page` and `FindingAction` an optional `path` (web dev 2ec8dd38);
  a host that knows only the older kinds compiles and ignores it. Web dev also serves 142 field
  manual pages as static documents under `/manuals/` (bd5a93ba), which such a button points at:
  `isManualPagePath`, `manualPageSlug`, `manualPageUrl(frontendUrl, slug)` and `manualPageTitle`
  in `@finstocks/core/market` tell one from a route and spell where it is served (a slug is
  `[a-z0-9-]+`, so an encoded `..` or a nested path is no page), `manualPageSlugOfUrl(frontendUrl,
url)` says which manual a tapped link stays on, if any; a host that gates
  the button on the page answering keys the probe with `queryKeys.manualPage(slug)`, and
  `HttpMethod` now admits `HEAD` for it.
- **v0.8.3** (tagged on main) — an IST date-and-time stamp keeps its clock on iOS. Hermes on iOS formats a format
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
