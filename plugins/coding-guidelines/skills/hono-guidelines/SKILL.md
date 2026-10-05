---
name: hono-guidelines
description: Invoke BEFORE writing any TypeScript backend code on Node (HTTP APIs, route handlers, DB access, migrations, services, tests). Encodes the Node + pnpm + Hono + zod + Drizzle/Postgres + Vitest + eslint/prettier/tsc conventions, architecture rules, and tooling commands.
---

# Hono + Drizzle Backend Guidelines

Follow these before writing any TypeScript backend code that runs on Node. Running on Bun instead? Use `bun-guidelines` for the runtime rules and this file for the API and DB rules.

## Stack
- Language: TypeScript, `strict: true`. Runtime: **Node 24 LTS+**. Package manager: **pnpm** (never npm/yarn; `pnpm add`, `pnpm add -D`, `pnpm exec`, `pnpm dlx`).
- HTTP: **Hono** on `@hono/node-server`. Validation: **zod** via `@hono/zod-validator`.
- DB: **Drizzle ORM** + **drizzle-kit** on **Postgres** (`drizzle-orm/node-postgres`, `pg`).
- Tests: **Vitest**. Lint/format/types: **eslint** (typescript-eslint `strictTypeChecked`) + **prettier** + **tsc**.
- Use **Context7 MCP** for current, version-accurate docs (`/websites/hono_dev`, `/honojs/middleware`, `/websites/orm_drizzle_team`, vitest, zod). Never rely on training data for API syntax, config, or migrations.

## Project setup
- ESM only (`"type": "module"`). No CommonJS, no `require`.
- Node runs `.ts` directly (type stripping), so you don't need tsx, ts-node or a build step. Set `erasableSyntaxOnly`, `verbatimModuleSyntax`, `allowImportingTsExtensions`, `noEmit`, `noUncheckedIndexedAccess`, `module`/`moduleResolution: "nodenext"`, `target: "esnext"` in `tsconfig.json`. Relative imports carry the `.ts` extension.
- Because of `erasableSyntaxOnly`: no `enum`, `namespace`, or constructor parameter properties. Use `as const` objects and union types instead.
- `package.json` `scripts` are the single entry point: `dev` = `node --watch --env-file=.env src/index.ts`, `start` = `node --env-file-if-exists=.env src/index.ts`, plus `test`, `lint`, `format`, `typecheck`, `db:generate`, `db:migrate`.
- Load env with Node's `--env-file`, not `dotenv`. Parse `process.env` once with a zod schema in `src/env.ts` and fail fast at startup. Everything else imports the typed `env`, never `process.env`.
- Pin `"packageManager"` and `"engines.node"`, and commit `pnpm-lock.yaml`.

## Architecture
- Files ≤ ~500 lines. Split when they grow past that.
- Organize by feature, not by layer: `src/<feature>/{routes.ts,service.ts,schema.ts}` with tests colocated as `*.test.ts`. Shared pieces go in `src/db/` (client and Drizzle tables), `src/env.ts`, `src/app.ts` (builds the Hono app) and `src/index.ts` (calls `serve`).
- **Thin handlers**: validate, call a service function, return `c.json(...)`. Business logic goes in plain functions that take their dependencies (`db`, inputs) as arguments and never touch Hono's `Context`.
- Don't add a repository layer on top of Drizzle unless there's a real second implementation. Services query `db` directly.
- Split `app.ts` from `index.ts` so tests can call `app.request()` without opening a port.
- No catch-all `utils.ts`. Don't add barrel `index.ts` files.
- camelCase functions/vars, PascalCase types, UPPER_SNAKE constants, kebab-case file names, snake_case DB columns (set `casing: "snake_case"` on `drizzle()` and in `drizzle.config.ts`).
- Comments minimal: explain *why*, never *what*. JSDoc on public exports only.

## TypeScript rules
- Type every exported signature. No `any`; use `unknown` and narrow. No non-null `!` unless the invariant is written next to it.
- Prefer `type` over `interface`. Use `import type` for type-only imports.
- Derive types instead of duplicating them: `z.infer<typeof schema>`, `typeof table.$inferSelect` / `$inferInsert`.
- Prefer plain objects and discriminated unions over classes. Use classes only for real stateful resources.
- Don't leave floating promises (eslint `no-floating-promises`). Every `async` call is awaited, returned, or explicitly `void`-ed with a reason.

## HTTP (Hono)
- Chain routes on one `new Hono()` per feature and mount them with `app.route('/<feature>', routes)`. Export `type AppType = typeof app` when a typed `hc` client is consumed.
- Validate **every** input at the boundary with `zValidator('json' | 'query' | 'param' | 'header', schema)` and read it via `c.req.valid(...)`. Never read the raw body or query in a handler.
- Use `z.coerce` for query and param numbers and dates. Strip unknown keys, and never spread request input straight into an insert.
- Errors: throw `HTTPException(status, { message })` for expected failures. Have one `app.onError` map unknown errors to a 500 with a generic body and log the real error server-side. Never leak stack traces or SQL.
- Return precise status codes (`201` on create, `204` with `c.body(null, 204)`, `404` for a missing row, `409` for a unique violation). Don't return 200 for everything.
- Built-in middleware first (`hono/logger`, `hono/cors`, `hono/secure-headers`, `hono/body-limit`, `hono/request-id`). Only write custom middleware for what those don't cover.
- Shut down gracefully: on SIGINT/SIGTERM, `server.close()` and then `pool.end()`.

## Database (Drizzle + Postgres)
- Create one `pg.Pool` and one `drizzle({ client: pool, schema, casing: 'snake_case' })` instance at startup in `src/db/client.ts`. Never create them per request.
- Define tables in `src/db/schema.ts`, splitting per feature into `src/db/schema/<feature>.ts` once it grows. Use explicit `notNull()`, defaults and `.unique()`. Add indexes for every foreign key and every column you filter on.
- Primary keys: `uuid().defaultRandom()` or `integer().generatedAlwaysAsIdentity()`. Timestamps: `timestamp({ withTimezone: true }).defaultNow()`.
- Queries: use the SQL-like builder (`db.select().from(t).where(eq(...))`) or the relational `db.query.<t>.findMany({ with })` to load relations without N+1. Select only the columns you need.
- Raw SQL only through the `sql` template tag, which binds parameters. Never string-concatenate SQL.
- Wrap multi-statement writes in `db.transaction(async (tx) => ...)` and pass `tx` down. Use `.returning()` instead of a follow-up select.
- Map Postgres errors at the service edge (`23505` unique → 409, `23503` FK → 409/422).
- Migrations: change the schema, run `pnpm db:generate` (`drizzle-kit generate`), **review the SQL**, then run `pnpm db:migrate` (`drizzle-kit migrate`). Commit the migration files. Never use `drizzle-kit push` against shared or prod DBs, and never edit a migration that has already been applied.
- `drizzle.config.ts`: `defineConfig({ dialect: 'postgresql', schema, out: './drizzle', casing: 'snake_case', dbCredentials: { url } })`. Read the URL from env, never a literal.

## Testing (Vitest)
- Colocate `*.test.ts` files next to the code. Test routes through `app.request(path, init)` and assert status and body. Test services as plain functions.
- Run DB tests against a real disposable Postgres (a Docker container or a CI service) with migrations applied. Isolate each test in a rolled-back transaction or a truncate. Don't mock Drizzle.
- Use `test.each` instead of copy-pasted cases, and use `vi.mock` / `vi.spyOn` sparingly, only for external HTTP and clocks.
- Every non-trivial function (branch, loop, parser, money or security path) leaves one runnable check behind.

## Conditional rules
- when the API **needs authentication**: use `hono/jwt` (`jwt({ secret, alg })`, read claims via `c.get('jwtPayload')`) for stateless APIs, or **better-auth** with its Drizzle adapter when you need sessions, OAuth or sign-up flows. Hash passwords with `argon2` (never bcrypt-by-hand or plain SHA). Keep secrets in `env`. Mount auth middleware per route group, not globally on public routes. Authorize resources in the service (does the row belong to the user?), not just at the route.
- when the API **exposes public docs / OpenAPI**: switch the feature routers to `OpenAPIHono` + `createRoute` from `@hono/zod-openapi` (zod schemas stay the single source of truth). Serve the spec at `/openapi.json` via `app.doc(...)` and the UI with `@scalar/hono-api-reference`. Don't hand-write the spec.
- when work must **run outside the request** (emails, retries, scheduled or long jobs): use **BullMQ** on Redis (`ioredis`). One `Queue` per job type, defined next to its feature. Run workers in a separate entry (`src/worker.ts`, script `worker`). Job payloads are zod-validated IDs, not whole rows. Make jobs idempotent and set `attempts` + `backoff`. Close queues and workers on shutdown.

## Tooling: run before done
- Lint + fix: `pnpm exec eslint . --fix`
- Format: `pnpm exec prettier --write .`
- Types: `pnpm exec tsc --noEmit`
- Tests: `pnpm exec vitest run`
- Everything must pass clean before handing off.

## Laziness
- Node built-ins (`fetch`, `crypto.randomUUID`, `node:util` `parseArgs`, `--env-file`, `--watch`) and Hono's built-in middleware come before any dependency. Never add a dep for what a few lines cover.
- No speculative abstractions (interface with one impl, generic repository, DI container), no config for a value that never changes, no scaffolding "for later".
