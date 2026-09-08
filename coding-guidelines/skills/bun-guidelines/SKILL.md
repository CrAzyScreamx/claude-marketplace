---
name: bun-guidelines
description: Invoke BEFORE writing any TypeScript that runs on Bun (servers, CLIs, scripts, libraries, tests). Encodes the Bun + TypeScript strict + bun test + eslint/prettier/tsc conventions, architecture rules, and tooling commands.
---

# Bun + TypeScript Guidelines

Follow these before writing any TypeScript that runs on Bun. Bun is the runtime, package manager, bundler, and test runner — do not add Node-era tooling (ts-node, nodemon, jest, vitest, npm, npx) for jobs Bun already does.

## Stack
- Language: TypeScript, `strict: true`. Runtime & package manager: **Bun** (never npm/yarn/pnpm; `bun add`, `bun add -d`, `bun run`, `bunx`).
- Types: `bun add -d @types/bun` and `"types": ["bun"]` in `tsconfig.json` (required on TypeScript 6+).
- Tests: `bun test` (`bun:test` — `describe`/`test`/`expect`/`mock`). Lint/format/types: eslint + prettier + tsc.
- Use **Context7 MCP** (`/oven-sh/bun`) for current, version-accurate Bun and library docs — never rely on training data for API syntax, config, or migrations.

## Project setup
- Bootstrap with `bun init`; keep its `tsconfig.json` baseline: `module: "Preserve"`, `moduleResolution: "bundler"`, `verbatimModuleSyntax`, `allowImportingTsExtensions`, `noEmit`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `skipLibCheck`, `lib`/`target: ESNext`.
- ESM only (`"type": "module"`). No CommonJS, no `require`.
- `package.json` `scripts` are the single entry point for every task (`dev`, `start`, `test`, `lint`, `format`, `typecheck`, `build`).
- Commit `bun.lock`. Config for Bun itself lives in `bunfig.toml` only when a default must change.
- Env: `.env` is loaded automatically — no `dotenv`. Read via `Bun.env` / `process.env`; validate required vars once at startup and fail fast.

## Architecture
- Files ≤ ~500 lines. Split when they grow past that.
- Small, single-purpose functions; extract when one does too much.
- `src/` for source, `src/index.ts` as the entry, tests colocated as `*.test.ts` next to the unit they cover.
- Directory tree by purpose, not by type. No needless files, no catch-all `utils.ts`, no barrel `index.ts` unless it removes real friction.
- Keep I/O and side effects at the edges; core logic stays pure and importable.
- camelCase for functions/vars, PascalCase for types/classes, UPPER_SNAKE for constants, kebab-case file names.
- Comments minimal — explain *why*, never *what*. JSDoc on public exports only.

## TypeScript rules
- Type every exported signature. No `any`; use `unknown` and narrow. No non-null `!` unless the invariant is written next to it.
- `type` over `interface` unless declaration merging is needed. Use `import type` for type-only imports (`verbatimModuleSyntax` enforces it).
- Prefer plain objects and discriminated unions over classes; classes only for real stateful resources.
- Validate at trust boundaries (HTTP body, env, files) with a schema (zod); trust types inside.
- Throw `Error` subclasses with a clear message; never swallow errors. Let them surface unless handled meaningfully.
- Top-level `await` is fine — it's an ESM entry, not a wrapper function.

## Bun idioms — use these before a dependency
- Files: `Bun.file(path)` / `Bun.write(path, data)` over `fs` for whole-file reads/writes.
- Subprocess: `Bun.$` shell (`import { $ } from "bun"`) over `child_process`.
- HTTP: `Bun.serve({ routes, fetch })` with `Response.json()`; standard `fetch` for clients. Reach for a framework (Hono) only when middleware/routing depth justifies it.
- Hashing/passwords: `Bun.password`, `Bun.hash`, `Bun.CryptoHasher`. SQLite: `bun:sqlite`. Postgres/Redis: `Bun.sql` / `Bun.redis` before third-party drivers.
- Bun runs `.ts` directly — never transpile before running. Dev loop: `bun --watch run src/index.ts` (restart) or `bun --hot run src/index.ts` (HMR for servers).
- Build only when shipping: `bun build src/index.ts --outdir dist --target bun`; single binary with `--compile`.

## Testing (bun test)
- `bun test` discovers `*.test.ts` / `*.spec.ts`. Import from `bun:test`, not jest/vitest.
- Test behavior at the public boundary, not internals. `test.each` over copy-pasted cases. `mock()` / `spyOn()` sparingly.
- Every non-trivial function (branch, loop, parser, money/security path) leaves one runnable check behind.
- Coverage on demand: `bun test --coverage`; pin thresholds in `bunfig.toml` `[test]` only if CI gates on them.

## Conditional rules
- when the project **needs a web framework** (middleware, nested routers, OpenAPI), use **Hono** on `Bun.serve`; keep handlers thin and push logic into plain functions.
- when **shipping a CLI**, parse args with `util.parseArgs` from `node:util`; build a binary with `bun build --compile --outfile <name>`.
- when the project is a **monorepo**, use Bun workspaces (`"workspaces": ["packages/*"]` in root `package.json`) and `bun run --filter`.
- when a **Node-only dependency misbehaves** under Bun, check `bun.com/docs/runtime/nodejs-apis` compatibility first; prefer a Bun-native replacement over polyfills.

## Tooling — run before done
- Lint + fix: `bun run eslint . --fix`
- Format: `bun run prettier --write .`
- Types: `bun run tsc --noEmit`
- Tests: `bun test`
- All must pass clean before handing off.

## Laziness
- Bun built-ins and stdlib before any dependency. Never add a dep for what a few lines or a `Bun.*` API already covers.
- No speculative abstractions (interface with one impl, factory for one product), no config for a value that never changes, no scaffolding "for later".
