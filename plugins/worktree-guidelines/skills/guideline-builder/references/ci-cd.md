# ci-cd — category questions

Name it `cicd-guidelines`.

Ask, in this order:
- **Platform & file location**: GitHub Actions (`.github/workflows/`), GitLab CI (`.gitlab-ci.yml`), CircleCI, Jenkins — which, and where configs live.
- **Triggers**: which events run the pipeline (push, PR, tag/release, schedule/cron, manual dispatch) and on which branches.
- **Stages & order**: what runs and in what sequence (lint → test → build → deploy) and which stages gate the next.
- **Runners & caching**: hosted vs self-hosted, OS/matrix, dependency/build caching, artifact upload/download between jobs.
- **Secrets & env**: where secrets come from (provider secret store, OIDC vs long-lived keys) and per-environment variables.
- **Deploy & gating**: target(s), environments (staging/prod), required approvals/protections, rollback approach.

Tooling: no type step — pin the config linter/validator (`actionlint` for GitHub Actions, `gitlab-ci-lint`, `yamllint`) and any dry-run/local-run check (`act`).
