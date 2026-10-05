---
name: containerization-guidelines
description: Invoke BEFORE writing any Dockerfile or containerizing an app for deployment. Language-agnostic image-build conventions — multi-stage builds, non-root, layer caching, healthcheck, and hadolint tooling.
---

# Containerization Guidelines

Follow these before writing any Dockerfile or packaging an app into an image. Language-agnostic; adapt the build/run commands to the app's stack.

## Base image
- Pin by digest or exact tag — never `latest`. `FROM node:22.11-slim@sha256:...`.
- Smallest image that works: `-slim` / `-alpine` for runtimes, `distroless` or `scratch` for static binaries. Don't ship a full OS to run one binary.
- Use **Context7 MCP** for current Dockerfile syntax, base-image tags, and `docker build`/BuildKit flags — never rely on training data.

## Multi-stage build
- Separate `builder` (compilers, dev deps, source) from the final runtime stage. Copy only the built artifact + runtime deps forward.
- Name stages (`AS builder`) and `COPY --from=builder`. Final stage carries no toolchain, no source, no dev dependencies.
- One concern per stage; don't split further than build vs runtime unless a real cache win exists.

## Layer caching — order matters
- Copy dependency manifests and install deps BEFORE copying source, so code changes don't bust the dep layer:
  `COPY package.json package-lock.json ./` → `RUN install` → `COPY . .`.
- Chain related `RUN` commands with `&&` and clean caches in the same layer (`apt-get ... && rm -rf /var/lib/apt/lists/*`). A separate cleanup layer saves nothing.
- Pin dependency versions via lockfile; use the deterministic install (`npm ci`, `pip install -r`, `go mod download`).

## Non-root & security
- Create and switch to an unprivileged user: `RUN adduser -D app` → `USER app`. Never run as root in the final stage.
- `COPY --chown=app:app` so files aren't root-owned. Read-only where possible.
- No secrets in layers or ENV — pass at runtime (`--secret`, mounted files, orchestrator secrets). `ARG`/`ENV` values persist in history.
- `.dockerignore` excludes `.git`, `node_modules`, secrets, local env files, build output — keeps context small and secrets out.

## Runtime config
- `WORKDIR` set explicitly. `EXPOSE` the app port (documentation).
- Prefer exec-form `ENTRYPOINT ["..."]` / `CMD ["..."]` — shell form breaks signal handling (PID 1 won't get SIGTERM). Add an init (`--init` / tini) only if the app spawns children and won't reap them.
- `HEALTHCHECK` hitting a real readiness endpoint, with sensible `--interval`/`--timeout`/`--retries`.
- Config via ENV with safe defaults; nothing environment-specific baked into the image.

## Architecture
- Keep the Dockerfile focused and readable; one image = one concern. Split into multiple Dockerfiles rather than one branching mega-file.
- Comments minimal — explain *why* (a non-obvious flag, a cache trick), never *what*.

## Tooling — run before done
- Lint: `hadolint Dockerfile` (fix every warning or justify with an inline `# hadolint ignore=DLxxxx`).
- Build clean: `docker build -t app:test .` — must succeed with no warnings.
- Verify: run the image, confirm it starts as non-root (`docker run --rm app:test id`) and the healthcheck passes.

## Laziness
- Official/verified base images over hand-rolled ones. Multi-stage over manual artifact juggling. BuildKit cache mounts (`RUN --mount=type=cache`) over custom cache scripts.
- No base image bigger than the job needs, no stage that doesn't earn a cache boundary, no tool in the final image the app doesn't run.
