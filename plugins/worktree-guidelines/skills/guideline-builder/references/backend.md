# backend — category questions

Name it `<framework-or-lang>-guidelines`.

Ask:
- **External libraries** to use (framework, ORM/driver, validation, auth, HTTP client).
- **Exact tech stack** for the language (e.g. FastAPI + SQLAlchemy + Pydantic).
- **Environment**: how the project is set up per language — e.g. Python → `pyproject.toml`, `requirements.txt`, `venv`, `uvicorn`; Node → `package.json`, scripts; Go → modules.

Tooling: pin the ecosystem standard — Python → `ruff` + `pyright`; JS/TS → `eslint` + `prettier` + `tsc`; Go → `gofmt` + `golangci-lint`; Rust → `rustfmt` + `clippy`.
