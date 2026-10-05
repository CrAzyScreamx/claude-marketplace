---
name: guideline-builder
description: "Builds a missing `<lang>-guidelines` skill for a language/stack, packaged as a standalone plugin and registered in a marketplace, before any code is written. Use whenever no `<lang>-guidelines` skill exists yet for the stack about to be coded (React, FastAPI, Docker, CI/CD, or anything else) — invoke this FIRST, before any coder runs, then follow the generated skill."
---

# guideline-builder

When no `<lang>-guidelines` skill exists for the stack in play, build one — packaged as a standalone **plugin** — before any code is written. Do not start coding until the plugin exists and its SKILL.md has been read.

The generated skill's name MUST keep the `-guidelines` suffix (e.g. `react-guidelines`, `fastapi-guidelines`, `containerization-guidelines`). The coder resolves the guideline by that suffix — never rename this contract.

## Output contract — non-negotiable

Writing the SKILL.md is not the finish line. Both of these must happen, in order:
1. **Package as a plugin (step 6).** Never write a bare `SKILL.md` into a skills directory — especially not `~/.claude/skills/`. The output is a plugin folder (`<plugin>/.claude-plugin/plugin.json` + `skills/<skill>-guidelines/SKILL.md`). A lone SKILL.md is a failed run.
2. **Ask the placement question (step 7)** and register the plugin in a marketplace's `plugins[]`. Don't end the run without asking whether to save it in a remote marketplace or locally, then writing the marketplace entry.

Caught yourself about to hand off after only writing a SKILL.md? Stop — steps 6–7 were skipped.

## Workflow

### 1. Classify & confirm
Decide which category is being built and confirm with the user:
- **frontend** — browser UI (React, Vue, Svelte, …).
- **backend** — server/API/CLI/library (Python, Go, Node API, …).
- **containerization** — Docker packaging.
- **ci-cd** — pipeline/automation config (GitHub Actions, GitLab CI, …).

Each category's exact skill-naming rule lives in its reference file (step 2) — read it there rather than repeating it here.

A mixed feature (frontend + backend + Docker + CI) = build one plugin per category.

### 2. Collect the stack — branch by category
Always collect: language, framework, runtime, test tool, lint/format/type tooling. If the user is unsure, propose the ecosystem standard and confirm.

Then **read the reference file for the category you classified in step 1** and ask its questions — do not inline them here:
- frontend → `references/frontend.md`
- backend → `references/backend.md`
- containerization → `references/containerization.md`
- ci-cd → `references/ci-cd.md`

Each reference file carries the category's naming rule, questions, and tooling.

### 3. Encode architecture rules
Adapt to the stack's idiom:
- Files stay small (≤ ~500 lines); split when they grow past that.
- Comments minimal — explain *why*, never *what*.
- Decompose into small, single-purpose functions/components.
- Logical, purpose-driven directory tree; no needless files.
- Clear naming per idiom (snake_case, camelCase, PascalCase).
- Fold in the category answers from step 2 as concrete rules.

**Adding an extension to a guideline** (any new rule/practice, whether building it now or extending an existing one): before writing it, ask the user which mode it takes —
- **Always-follow** → bake the rule directly into the SKILL.md body so the coder applies it on every run.
- **Conditional rule** → it only applies in a specific situation. Record it in the generated SKILL.md body under a "Conditional rules" heading (not a `references/` file), phrased as "when `<situation>`, do `<rule>`", so the coder applies it only when that situation occurs.

Default to asking per extension; don't assume. If the user says a class of extensions is always one mode, follow that without re-asking.

### 4. Encode the tooling
Pin the exact lint/format/type commands the category's reference file names (step 2), plus any ecosystem standard for the specific language in play. Encode the commands verbatim so the coder runs them.

### 5. Point at live docs
Instruct the generated skill to use the **Context7 MCP** for current, version-accurate docs of the libraries/frameworks in the stack — never rely on training data for API syntax, config, or migrations.

### 6. Write the SKILL.md body to a temp file
Write the terse, imperative guideline rules (lean — no prose padding) to a temp file, e.g. `<scratchpad>/<stack>-guidelines.SKILL.md`. Include the full frontmatter (`name: <stack>-guidelines`, where `<stack>` is the bare framework/language — e.g. `react` → `react-guidelines` — plus a `description` that tells Claude to invoke it before writing this stack). This temp file is the INPUT to the scaffold script — do NOT write it into any skills directory yourself.

The **plugin name and skill name are separate**: the skill name is `<stack>-guidelines` and MUST end in `-guidelines` (the coder resolves the guideline by that suffix); the plugin name is a plain package name (e.g. `react-frontend`) — pick a sensible one and confirm with the user.

### 7. Ask placement, then run the scaffold script — the ONLY approved packaging
First ask the user: **is there a remote marketplace you work with that you want this saved in?**
- **Yes** → they give its local path → that path is `--dest`.
- **No** → save locally: `--dest` is this marketplace's root.

Then package + register in one deterministic step by RUNNING the script (never hand-write plugin files, never drop a bare SKILL.md):
```
node "${CLAUDE_PLUGIN_ROOT}/skills/guideline-builder/scaffold.mjs" \
  --plugin <plugin-name> --skill <stack>-guidelines \
  --dest <marketplace-root> \
  --description "<invoke-before-writing description>" --body <temp-SKILL.md>
```
Bundle any reference files the SKILL.md points at with repeated `--ref <name>=<path>` flags — each copies `<path>` into `skills/<stack>-guidelines/references/<name>`, and `<name>` may include subdirs (e.g. `--ref db/postgres.md=<temp-postgres.md>`). Write each reference body to its own temp file first, same as the SKILL.md body.

The script creates `<dest>/<plugin-name>/` with `plugin.json` + `skills/<stack>-guidelines/SKILL.md` (plus any `references/` files), and appends the entry to `<dest>/.claude-plugin/marketplace.json`. If that marketplace file doesn't exist yet, add `--market-name <name> --owner <owner>` (ask the user) and the script creates it. It refuses to overwrite an existing plugin of the same name (checking both the marketplace and the plugin dir on disk) and exits 2 — if that happens, ask the user whether to **overwrite** (re-run the same command with `--force`) or pick a new `--plugin` name. A run that ends without this script having succeeded is a FAILED run.

### 8. Hand off
- A freshly-written plugin is NOT installed as a loadable skill this session. Report the exact SKILL.md path and **read it back by path**; the coder loads the guidelines by reading that file until the plugin is installed in a later session.
- Then code through the loaded guidelines.
