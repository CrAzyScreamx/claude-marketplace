# Database — SQLAlchemy 2.0 + Alembic

Read this only when the project persists data in a relational DB.

## Setup
- `uv add sqlalchemy alembic`; add the driver: `psycopg[binary]` (Postgres) or `aiosqlite`/`asyncpg` for async.
- Init migrations once: `uv run alembic init migrations`. Point `sqlalchemy.url` at an env var, never a literal.
- Get current API/config from **Context7** (`sqlalchemy`, `alembic`) — 2.0 differs sharply from 1.x.

## Models
- One `DeclarativeBase` subclass per project. Models use **`Mapped[...]` + `mapped_column()`** (2.0 typed style), never the legacy `Column()` class attributes.
- One model per table; group related models per module under `models/`. Keep models thin — no business logic, no I/O.
- Explicit `__tablename__`, explicit types, explicit nullability. Relationships via `relationship()` with typed `Mapped[list[X]]`.

## Sessions & engine
- Create the `Engine` once at startup; never per-call. Use a `sessionmaker`/`async_sessionmaker` factory.
- Scope a session per unit of work with a context manager (`with Session(engine) as s:`), commit at the boundary, roll back on error. Never share a session across threads/tasks.
- Pick sync **or** async and stay consistent (`Session` vs `AsyncSession`, `create_engine` vs `create_async_engine`). For FastAPI, prefer async and yield the session via a dependency (see `api.md`).

## Queries
- 2.0 style: `select(Model).where(...)` executed through the session — not the legacy `session.query(...)`.
- Never build SQL with f-strings/`%` — bound parameters only. Load relationships deliberately (`selectinload`/`joinedload`) to avoid N+1.

## Migrations
- Every schema change = a new Alembic revision: `uv run alembic revision --autogenerate -m "..."`. **Review the generated script** — autogenerate misses renames, server defaults, and some type changes.
- Apply with `uv run alembic upgrade head`. Never edit the DB schema by hand and never mutate an already-applied migration; add a new one.

## Testing
- Test against a real transactional DB (SQLite in-memory or a disposable Postgres), each test in a rolled-back transaction — not mocks of the ORM.
