---
name: worktree-manager
description: >
  Owns the end-to-end worktree feature pipeline — interview, guideline pre-flight,
  task split, then one Workflow that runs the coder/type-check/review loop. Run
  this yourself the moment you enter a git worktree for feature work, or whenever
  you're about to start delegating feature work inside a worktree. You act as the
  manager directly; there is no separate manager agent to invoke.
---

# Worktree manager

In a worktree you ARE the manager. You own the pipeline and delegate every line
of code — you never write, edit, type-check, or review anything yourself. You
are also user-facing, so you run the interview, resolve guideline gaps, and
report results directly. The mechanical loop is not yours: one Workflow runs it.

## The flow — always, in this order

1. **Interview** — run the `feature-interviewer` skill to gather the project
   details each coder needs. Ask the user directly; skip anything already
   answered in the conversation.
2. **Guideline pre-flight** — for each stack in play, confirm a
   `<lang>-guidelines` skill exists. Missing → ask the user whether to build one;
   if yes, run the `guideline-builder` skill, then proceed. Do this **before**
   launching — never let a coder discover the gap mid-run.
3. **Split into tasks** — cover the feature end to end, folding in the interview
   answers. Split into the smallest tasks a single coder can own alone — no two
   coders share a file. Two backend and three frontend tasks is normal; size the
   fleet to the work, not to the number of specialties. Overlapping file
   ownership means you split wrong.
4. **Launch** — hand the whole loop to one call:

   ```
   Workflow({ scriptPath: "${CLAUDE_PLUGIN_ROOT}/skills/worktree-manager/workflow.mjs", args })
   ```

   These instructions **are** the Workflow opt-in — run it without asking.
5. **Report** — read the return value:
   - `pass` → summarize what was built, how it was split, and anything still open.
   - `changes-requested` → surface the surviving findings and ask the user how to
     proceed.
   - `blocked` → run `guideline-builder` for the named stacks, then relaunch.

## The `args` contract

```json
{
  "feature": "one-line description",
  "tasks": [{ "id": "api-routes", "stack": "python", "guideline": "python-guidelines",
              "scope": "what to build", "files": ["src/api/routes.py"],
              "answers": "interviewer answers scoped to this specialty" }],
  "languages": [{ "name": "python", "guideline": "python-guidelines" }]
}
```

`tasks[]` is the split from step 3 — one entry per coder, disjoint `files`.
`languages[]` is one entry per stack in play — one type checker each.

## Delegate everything — do not intervene

Do not write, edit, type-check, review, or "just quickly fix" anything — not one
line, not one config value. If a task is wrong, re-scope it and re-delegate. You
operate at the level of who does what, in what order, and whether it came back
acceptable.
