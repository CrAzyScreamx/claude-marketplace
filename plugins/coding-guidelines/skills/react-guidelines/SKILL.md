---
name: react-guidelines
description: Invoke BEFORE writing any React/TypeScript frontend code (components, hooks, routes, forms). Encodes the project's React + TypeScript + Vite + pnpm conventions, architecture rules, and tooling commands.
---

# React Guidelines

Follow these before writing any React/TypeScript frontend code.

## Stack
- Language: TypeScript (strict).
- Build/dev: Vite. Package manager: **pnpm** (never npm/yarn).
- Routing: `react-router-dom`. Forms: `react-hook-form`. Components: **MUI** (`@mui/material`).
- Load the `frontend-design` skill and design against it. Gather the design brief first: reference image, navbar placement, default page, logo, project idea, plus brand colors / theme / target device as relevant.
- Use **Context7 MCP** for current, version-accurate docs of React, react-router, react-hook-form, MUI, Vite — never rely on training data for API syntax, config, or migrations.

## Architecture
- Files ≤ ~500 lines. Split when they grow past that.
- One component per file. Component file = PascalCase (`UserCard.tsx`). Hooks = `useX.ts` (camelCase).
- Decompose into small, single-purpose components and hooks. Extract logic into custom hooks when a component does too much.
- Directory tree by purpose: `components/` (shared/dumb), `features/<feature>/` (feature-scoped components + hooks), `pages/` or `routes/` (route entries), `hooks/` (shared hooks), `lib/` (helpers), `types/`.
- No needless files, no barrel `index.ts` re-exports unless they remove real friction.
- Comments minimal — explain *why*, never *what*.

## React rules
- Function components only. Hooks at top level — never conditional.
- Type props with an explicit `type Props = {...}`; no `React.FC`.
- Derive state during render; don't mirror props into state. Reach for `useEffect` only for real external sync (subscriptions, DOM, non-React). Fetch/derived data is not an effect.
- Keys: stable IDs, never array index.
- Lift state only as far as needed; colocate otherwise.
- `useMemo`/`useCallback` only when a measured cost or referential-stability need exists — not by default.

## Routing (react-router-dom)
- Define routes in one place. Use loaders/`useLoaderData` for route data where it fits; otherwise a data hook.
- Lazy-load route components with `React.lazy` for code-splitting.

## Components (MUI)
- Use MUI components (`@mui/material`) before hand-rolling UI. Icons from `@mui/icons-material`.
- Theme once via `ThemeProvider` + `createTheme`; read tokens from `theme`, no hardcoded colors/spacing.
- Style with the `sx` prop or `styled()` — not inline `style` or ad-hoc CSS files.
- Wrap MUI inputs with react-hook-form via `Controller`.

## Forms (react-hook-form)
- `useForm` + `register`/`Controller`. Validate with a schema resolver (zod) at the form boundary.
- Never build controlled inputs by hand when RHF covers it. For MUI fields, bind via `Controller`.

## Tooling — run before done
- Lint + fix: `pnpm eslint . --fix`
- Format: `pnpm prettier --write .`
- Types: `pnpm tsc --noEmit`
- All three must pass clean before handing off.

## Laziness
- Native platform first: `<input type="date">`, CSS (`:has`, container queries, grid) over JS, `<dialog>` over a modal lib. No new dependency for what a few lines or an installed lib already does.
- No speculative abstractions, no scaffolding "for later".
