# ci-cd (pipelines) — interview questions

Hand answers to the ci-cd coder.

1. **Platform & file location** — GitHub Actions (`.github/workflows/`),
   GitLab CI (`.gitlab-ci.yml`), CircleCI, Jenkins — which, and where configs
   live.
2. **Triggers** — which events run the pipeline (push, PR, tag/release,
   schedule/cron, manual dispatch) and on which branches.
3. **Stages & order** — what runs and in what sequence (lint → test → build →
   deploy) and which stages gate the next.
4. **Environments & deploy** — target(s), staging/prod, required approvals/
   protections, rollback approach.
5. **Secrets & env** — where secrets come from (provider store, OIDC vs
   long-lived keys) and per-environment variables.
6. Up to **2 more** as relevant: runners (hosted vs self-hosted, OS/matrix),
   dependency/build caching, artifacts passed between jobs.
