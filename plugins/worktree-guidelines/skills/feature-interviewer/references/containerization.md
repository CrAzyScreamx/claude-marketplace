# containerization (Docker) — interview questions

Hand answers to the containerization coder.

1. **Services to containerize** — what runs (app, worker, db, cache) and which
   need their own image.
2. **Base image & runtime** — language runtime + version, slim/alpine
   preference, any required system packages.
3. **Build shape** — build vs runtime dependencies, multi-stage split, which
   artifacts get copied into the final image.
4. **Runtime config** — exposed ports, env vars/secrets, volumes, entrypoint/
   command, non-root user.
5. **Compose topology** (only if needed) — services, networks, `depends_on`/
   healthchecks, dev vs prod overrides.
6. Up to **2 more** as relevant: target registry & image tagging, resource
   limits, healthcheck command.
