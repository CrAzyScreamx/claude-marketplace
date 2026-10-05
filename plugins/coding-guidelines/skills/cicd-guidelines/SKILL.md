---
name: cicd-guidelines
description: Invoke BEFORE writing any GitHub Actions workflow or CI/CD config (.github/workflows/*.yml). Encodes triggers, stage gating, hosted runners, GitHub Secrets, and actionlint tooling.
---

# CI/CD Guidelines — GitHub Actions

Follow these before writing or editing any workflow in `.github/workflows/`. Use **Context7 MCP** for current action versions, `actions/*` inputs, and workflow syntax — never rely on training data for pinned versions or YAML keys.

## Triggers
- Run on push to the default branch and on version tags:
  ```yaml
  on:
    push:
      branches: [main]
      tags: ['v*']
  ```
- One workflow file per purpose (e.g. `ci.yml`). Don't cram unrelated triggers into one file — split when concerns diverge.
- Set concurrency to cancel superseded runs: `concurrency: {group: ${{ github.workflow }}-${{ github.ref }}, cancel-in-progress: true}`.

## Stages & gating — lint → test → build → deploy
- One job per stage. Each gates the next with `needs:`; deploy runs only after all three pass:
  ```yaml
  jobs:
    lint:   { runs-on: ubuntu-latest, steps: [...] }
    test:   { needs: lint,  runs-on: ubuntu-latest, steps: [...] }
    build:  { needs: test,  runs-on: ubuntu-latest, steps: [...] }
    deploy: { needs: build, runs-on: ubuntu-latest, steps: [...] }
  ```
- Gate deploy to release refs so branch pushes only run CI: `if: startsWith(github.ref, 'refs/tags/v')`.
- Pass artifacts between jobs with `actions/upload-artifact` / `download-artifact` — jobs don't share a filesystem.

## Runners
- GitHub-hosted `ubuntu-latest`. No dependency cache configured — keep it that way until a slow install measurably justifies `actions/cache` or `setup-*`'s built-in `cache:` input.
- Pin the language toolchain version explicitly in the `setup-*` step; don't rely on the runner default.

## Secrets & env
- Deploy auth via GitHub Secrets (`${{ secrets.NAME }}`). Store deploy targets in a GitHub **Environment** (`environment: production`) so protection rules and required reviewers apply.
- Never `echo` a secret or put it in a URL/log — mask stays only if it never reaches stdout. No secrets in `if:` expressions (they're evaluated in plaintext).
- Set least-privilege token scope at the top: `permissions: {contents: read}`, widen per-job only where needed.

## Action & version hygiene
- Pin third-party actions to a full commit SHA, not a tag — `uses: actions/checkout@<sha>`. First-party `actions/*` may use a major tag (`@v4`) if you accept auto-updates; SHA is safer.
- Every step has a `name:`. Fail fast — no `continue-on-error` unless a flaky step is explicitly tolerated and commented.

## Architecture
- Keep each workflow file focused and short (≤ ~500 lines; realistically far less). Extract repeated job logic into a reusable workflow (`workflow_call`) or composite action rather than copy-pasting.
- Comments minimal — explain *why* (a non-obvious `if`, an ordering constraint), never *what*.
- `snake_case` or `kebab-case` job/step ids consistently; match the repo's existing style.

## Tooling — run before done
- Lint: `actionlint` on every changed workflow (validates syntax, `if:` expressions, and action inputs). Fix every warning.
- YAML lint: `yamllint .github/workflows/` if the repo already uses yamllint.
- Dry-run locally with `act` where feasible (`act push`) to catch job-graph and step errors before pushing.

## Laziness
- Official `actions/*` over hand-rolled shell for checkout, setup, artifacts, caching. `needs:` for ordering over manual polling. `matrix:` over duplicated jobs.
- No cache, matrix, or extra job that doesn't earn its keep. No workflow that duplicates what a single job with `needs:` already expresses. Speculative environments/approvals = skip until a real deploy target needs them.
