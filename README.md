# @finstocks/core

The shared core of FinStocks — the nexus of the two apps. Pure TypeScript: domain types,
market/trading/strategy maths, static data, query keys, endpoint definitions, and the generated
design tokens. No React, React Native, DOM, `fetch`, or storage imports (lint-enforced).

Consumers: `finstocks-mobile` and `DownStocks/frontend`, which install it as a **git-tag
dependency** for now (`"@finstocks/core": "git+https://github.com/wrk-singha/finstocks-core.git#v0.2.14"`;
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
- `src/queryKeys.ts` — the React Query key factory both apps build keys with.
- `src/api/` — endpoint definitions over the `HttpClient` contract in `api/http.ts`: each domain
  exports a factory (`tradingApi(http)`), paths are relative to the API root without `/api`,
  order mutations take an idempotency key, pre-login routes are `anonymous`. Transport (fetch,
  axios, SSE, WebSocket) stays in each app.
- Tests run on Node directly (`node --test`, type stripping): test files import `../x.ts` with the
  extension, and the code uses only erasable syntax (no enums, no namespaces, no parameter
  properties — `tsc` enforces it). ESLint blocks React, React Native, DOM, fetch, storage and app
  aliases inside `src/`.
- Subpath imports: `@finstocks/core` (everything), or `@finstocks/core/{types,market,trading,strategy,screener,portfolio,data,format,queryKeys,api,tokens}`.
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
