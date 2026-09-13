# @finstocks/core

The shared core of FinStocks — the nexus of the two apps. Pure TypeScript: domain types,
market/trading/strategy maths, static data, query keys, endpoint definitions, and the generated
design tokens. No React, React Native, DOM, `fetch`, or storage imports (lint-enforced).

Consumers: `finstocks-mobile` and `DownStocks/frontend`, which install it as a **git-tag
dependency** for now (`"@finstocks/core": "github:wrk-singha/finstocks-core#v0.1.0"`), moving to a
registry after the org transfer. Import paths: `@finstocks/core`, `@finstocks/core/tokens`,
`@finstocks/core/tokens.css`.

## Layout

- `src/` — the package. `src/tokens/` is **generated**; never hand-edit.
- `tokens/src/*.json` — the design-token source (colour light/dark, type, space, motion).
- `tokens/scripts/build.mjs` — generates `src/tokens/index.ts` and `tokens/dist/tokens.css`.
- `tokens/test/` — WCAG contrast assertions (with a dated allowlist → decision H8).

## Commands

```bash
pnpm install
pnpm check          # tokens:check + typecheck + tests
pnpm tokens:build   # after editing tokens/src/*.json — commit the outputs
```

## Releasing

Bump `version`, commit, tag `vX.Y.Z`, push with tags. Consumers pin the tag.
Rules and extraction plan: the migration docs (`wrk-singha/finstocks-migration`, `SHARED-CORE.md`).
