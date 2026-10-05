---
name: generate-image
description: "Generates images using OpenRouter. Triggers on /generate-image [prompt] [--model model-id] or automatically when an image is needed in context."
---

# generate-image Skill

## Trigger Conditions

Invoke this skill when:
- User types `/generate-image [prompt]` — optionally with `--model [model-id]`
- User says "generate an image of X", "create a picture of X", "draw X", "make a visual of X", "show me an image of X"
- The task clearly requires a visual asset (logo, banner, illustration, diagram, etc.)

## How to Execute

The generate-image script path was provided at session start (see `[image-generator] Tool script ready` in session context).

Use the **Bash tool** to call it directly:

```bash
node "<script-path-from-session-context>" "<prompt>" [--model <model-id>] [--output-dir <dir>]
```

The script handles everything: API call, response parsing, base64 decode, file save.
It prints `Image saved: <path>` on success or a clear error message on failure.

## Examples

```bash
# Default model (google/gemini-3.1-flash-image-preview)
node "/path/to/scripts/generate.js" "a sunset over mountains"

# Override model
node "/path/to/scripts/generate.js" "a minimalist cat logo" --model google/imagen-4.0-generate-001

# Save to a specific directory
node "/path/to/scripts/generate.js" "abstract art" --output-dir ./assets
```

## After the script runs

Report to the user:
- The saved file path
- The model used
- Optionally, offer to open or display the image

## Model Reference

All models use OpenRouter's `/api/v1/chat/completions` endpoint — no special routing needed.

| Model | Notes |
|-------|-------|
| `google/gemini-3.1-flash-image-preview` | Default — best quality |
| `google/imagen-4.0-generate-001` | High-fidelity photorealism |
| `black-forest-labs/flux-kontext-pro` | Fast, artistic styles |
