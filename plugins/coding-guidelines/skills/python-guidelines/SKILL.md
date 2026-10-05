---
name: python-guidelines
description: Invoke BEFORE writing any Python code (CLI tools, libraries, APIs, modules, tests). Encodes the project's Python + uv + ruff + pyright + pytest architecture, plus conditional references for DB, API, caching, and CustomTkinter GUI work.
---

# Python Guidelines

Follow these before writing any Python code. Load the matching reference below **only** when that concern is in play.

## Conditional references — read the file when the case applies
- **Using a database?** → read `references/db.md` (SQLAlchemy 2.0 + Alembic).
- **Building/exposing an API?** → read `references/api.md` (FastAPI).
- **Adding caching?** → read `references/caching.md` (Redis / redis-py).
- **Building a CustomTkinter desktop GUI?** → read `references/customtkinter.md` (CTk structure, threading, CTkImage, theming).

Don't load a reference the task doesn't touch. A plain CLI with no DB/API/cache uses this file alone.

## Stack
- Language: Python 3.12+, fully type-annotated.
- Env & deps: **uv** with `pyproject.toml` (never hand-edit `requirements.txt`; no bare `pip install`). Add deps with `uv add`, run with `uv run`.
- CLI: **Typer** (or Click). Libraries: expose a clean public API in `__init__.py`, no CLI coupling.
- Use **Context7 MCP** for current, version-accurate docs of every library in the stack — never rely on training data for API syntax, config, or migrations.

## Architecture
- Files ≤ ~500 lines. Split when they grow past that.
- Small, single-purpose functions — one clear responsibility each; extract when a function does too much.
- **src layout**: `src/<pkg>/`, tests in `tests/`. Entry point via `cli.py`/`__main__.py`; `pyproject.toml` `[project.scripts]` wires the console command.
- Directory tree by purpose, not by type. No needless files, no catch-all `utils.py`.
- Keep I/O and side effects at the edges; core logic stays pure and importable.
- snake_case for functions/vars/modules, PascalCase for classes, UPPER_SNAKE for constants.
- Comments minimal — explain *why*, never *what*. Docstrings on public functions/classes only.

## Python rules
- Type every signature (params + return). Prefer builtins `list`/`dict`/`X | None` over `typing.List`/`Optional`.
- Prefer `@dataclass` (or Pydantic when validation is needed) over ad-hoc dicts for structured data.
- `pathlib.Path` over `os.path`. f-strings over `%`/`.format`. Context managers (`with`) for any resource.
- Raise specific exceptions; never bare `except:`. Let errors surface unless you handle them meaningfully.
- Stdlib first: `pathlib`/`itertools`/`functools`/`collections`/`dataclasses`/`json`/`subprocess` before any dependency.
- No mutable default args. Guard entry points with `if __name__ == "__main__":`.

## Testing (pytest)
- `pytest`, tests in `tests/`, files `test_*.py`, plain `assert`. Fixtures only when they remove real duplication.
- Test behavior at the public boundary, not internals. Parametrize (`@pytest.mark.parametrize`) over copy-pasted cases.
- Every non-trivial function (branch, loop, parser, money/security path) leaves one runnable check behind.

## Tooling — run before done
- Lint + fix: `uv run ruff check --fix .`
- Format: `uv run ruff format .`
- Types: `uv run pyright`
- Tests: `uv run pytest`
- All must pass clean before handing off.

## Laziness
- Stdlib and one-liners before custom classes or new dependencies. Never add a dep for what a few lines cover.
- No speculative abstractions (interface with one impl, factory for one product), no config for a value that never changes, no scaffolding "for later".
