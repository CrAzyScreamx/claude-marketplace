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

## Logging
- Stdlib `logging`. Every API logs to the console and a rotating file. Defaults: `logs/app.log`, 50MB per file, 3 backups (`app.log.1`–`.3`, so at most 4 files / 200MB). Override through env (`LOG_FILE`, `LOG_LEVEL`, `LOG_MAX_BYTES`, `LOG_BACKUP_COUNT`).
- Add to `BaseSettings`:
  ```python
  log_file: Path = Path("logs/app.log")
  log_level: str = "INFO"
  log_max_bytes: int = 50 * 1024 * 1024
  log_backup_count: int = 3
  ```
- `app/logging_config.py` (never name it `logging.py`). Call `setup_logging(settings)` first thing in the lifespan; no uvicorn flags needed:
  ```python
  import logging.config

  from app.config import Settings


  def setup_logging(settings: Settings) -> None:
      settings.log_file.parent.mkdir(parents=True, exist_ok=True)
      logging.config.dictConfig(
          {
              "version": 1,
              "disable_existing_loggers": False,
              "formatters": {"plain": {"format": "%(asctime)s %(levelname)s %(name)s %(message)s"}},
              "handlers": {
                  "console": {"class": "logging.StreamHandler", "formatter": "plain"},
                  "file": {
                      "class": "logging.handlers.RotatingFileHandler",
                      "filename": str(settings.log_file),
                      "maxBytes": settings.log_max_bytes,
                      "backupCount": settings.log_backup_count,
                      "encoding": "utf-8",
                      "formatter": "plain",
                  },
              },
              "root": {"level": settings.log_level, "handlers": ["console", "file"]},
              # uvicorn's defaults set propagate=False, which would keep its logs out of the file.
              "loggers": {
                  "uvicorn": {"handlers": [], "propagate": True},
                  "uvicorn.access": {"handlers": [], "propagate": True},
              },
          }
      )
  ```
- **More than one worker process** (`--workers`, gunicorn): `RotatingFileHandler` is not multi-process safe, so rollovers fail (`PermissionError` on Windows). `uv add concurrent-log-handler` and set `"class": "concurrent_log_handler.ConcurrentRotatingFileHandler"`; the other keys stay the same.
- In each module: `logger = logging.getLogger(__name__)`, never `print`. Pass values as args (`logger.info("order %s paid", order_id)`), an exception to the f-string rule, so unemitted messages aren't formatted.
- `uvicorn.access` already records each request and `uvicorn.error` records unhandled tracebacks, so don't add request-logging middleware. Use `logger.exception(...)` when catching an error you handle.
- Never log secrets, tokens, passwords, auth headers, or full request bodies.
- Add `logs/` to `.gitignore`.

## Testing
- `httpx.AsyncClient` + `ASGITransport` (or `TestClient`) against the app. Override dependencies (`app.dependency_overrides`) to inject test DB/redis. Assert status + body schema.
- Set `LOG_FILE` to a `tmp_path` file so test runs don't write to `logs/`.
