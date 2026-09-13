# @finstocks/core

The shared core of FinStocks — the nexus of the two apps. Pure TypeScript: domain types,
market/trading/strategy maths, static data, query keys, endpoint definitions, and the generated
design tokens. No React, React Native, DOM, `fetch`, or storage imports (lint-enforced).

Consumers: `finstocks-mobile` and `DownStocks/frontend`, which install it as a **git-tag
dependency** for now (`"@finstocks/core": "git+https://github.com/wrk-singha/finstocks-core.git#v0.2.2"`;
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
- `tokens/test/` — WCAG contrast assertions (with a dated allowlist → decision H8).

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
