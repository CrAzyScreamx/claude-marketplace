# API — FastAPI

Read this only when the project exposes an HTTP API.

## Setup
- `uv add fastapi`; ASGI server `uv add uvicorn` (dev: `uv run uvicorn app.main:app --reload`). For prod use uvicorn workers or gunicorn+uvicorn worker class.
- Get current API/config from **Context7** (`fastapi`, `pydantic`) — Pydantic v2 and lifespan/DI patterns changed recently.

## Structure
- `app/main.py` builds the `FastAPI()` app; routes live in `app/routers/<area>.py` mounted via `APIRouter`, not all in one file.
- Keep endpoints thin: parse/validate → call a service function → return a model. Business logic lives in importable service functions, not in the route.
- Layer: `routers/` (HTTP), `services/` (logic), `schemas/` (Pydantic I/O models), `models/` (DB, see `db.md`). Keep DB models and API schemas separate — never return ORM objects directly.

## Request/response
- All request bodies and responses are **Pydantic v2 models**. Set `response_model=` on every route so output is validated and documented.
- Type path/query params directly on the function signature; FastAPI validates and documents them.
- Raise `HTTPException` for expected client errors; add exception handlers for cross-cutting cases. Return correct status codes (201 on create, 204 on delete).

## Dependencies & lifecycle
- Use `Depends()` for shared concerns (DB session, auth, settings). Yield the DB session from a dependency so it's opened/closed per request:
  `async def get_session(): async with SessionLocal() as s: yield s`.
- Startup/shutdown (engine, redis pool) via the **lifespan** context manager on `FastAPI(lifespan=...)`, not deprecated `@app.on_event`.
- Config via `pydantic-settings` `BaseSettings` from env; never hardcode secrets/URLs.

## Async
- `async def` endpoints for I/O-bound work; use async DB/redis clients throughout. Never call blocking I/O inside an async route — offload with `run_in_executor`/`anyio` if unavoidable.

## Testing
- `httpx.AsyncClient` + `ASGITransport` (or `TestClient`) against the app. Override dependencies (`app.dependency_overrides`) to inject test DB/redis. Assert status + body schema.
