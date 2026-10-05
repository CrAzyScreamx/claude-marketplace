# Caching — Redis (redis-py)

Read this only when the project needs a shared/persistent cache. First ask: does a stdlib `functools.lru_cache`/`@cache` on a pure function already cover it? If in-process memoization is enough, use that and skip Redis.

Use Redis when the cache must be **shared across processes/machines, survive restarts, or hold TTL'd data** (sessions, rate limits, expensive query results).

## Setup
- `uv add redis` (redis-py includes async via `redis.asyncio`). Run Redis via Docker/compose for local dev.
- Get current API from **Context7** (`redis`) — async client and connection-pool APIs have shifted.

## Connection
- Create **one** connection pool / client at startup and reuse it; never open a connection per call. In FastAPI, build it in the lifespan handler and inject via `Depends` (see `api.md`).
- Match sync/async to the app: `redis.Redis` for sync, `redis.asyncio.Redis` for async. Close the pool on shutdown.
- URL/credentials from env via settings — never hardcoded.

## Usage
- Namespace keys (`user:{id}:profile`), keep them deterministic, document the scheme in one place.
- **Always set a TTL** (`ex=`/`setex`) unless the key is deliberately permanent — an unbounded cache is a memory leak.
- Store bytes/str/JSON explicitly; pick one serialization (JSON for interop, `pickle` only for trusted internal data). Decode consistently (`decode_responses=True` or handle bytes everywhere).
- Cache-aside pattern: look up → on miss compute + `set` with TTL → return. Wrap it in one small helper, don't scatter get/set logic.

## Invalidation & failure
- Invalidate on write: delete/update the key when the source of truth changes. Prefer short TTLs over clever invalidation when staleness is tolerable.
- Redis is a cache, not the source of truth: on a Redis error, fall back to computing the value — never let a cache outage take down the request.

## Testing
- Use `fakeredis` or a disposable Redis instance. Test the cache-aside helper (miss → compute → hit) rather than mocking every call.
