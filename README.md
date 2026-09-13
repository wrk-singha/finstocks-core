# tokens — the design-token source

`src/*.json` is the single source of truth for colour (light/dark), typography, spacing,
radius, elevation, motion, and z-index. `scripts/build.mjs` generates:

- `core/src/tokens/` — typed TypeScript consumed by mobile (`@finstocks/core/tokens`)
- `web/src/styles/tokens.css` — CSS custom properties consumed by the web app

Generated files are never hand-edited; CI runs `pnpm tokens:build --check`.
Schema and seed values: `docs/migration/DESIGN-KIT.md` §2.
