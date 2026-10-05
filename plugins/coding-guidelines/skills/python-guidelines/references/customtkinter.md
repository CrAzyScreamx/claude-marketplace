# CustomTkinter — desktop GUI

Read when building a CustomTkinter desktop UI. Base `python-guidelines` (uv, ruff, pyright, pytest, src layout, type everything) still applies.

## Structure
- `App(ctk.CTk)` root window: owns appearance setup + navigation only. Each screen is a `ctk.CTkFrame` subclass in its own file (split when a view passes ~500 lines).
- Views hold widgets + their event handlers. Keep business/IO logic OUT of views — call into pure `src/<pkg>/` modules so it stays testable.
- Store widgets you read later as `self.<name>`; leave transient ones unassigned.
- Two-way binding via `ctk.StringVar`/`ctk.IntVar`, not manual get/set.

## Layout
- Use `grid()` with `grid_rowconfigure`/`grid_columnconfigure(..., weight=1)` so it resizes. Don't mix `grid` and `pack` in one container. `place()` only for overlays.
- Weights + `minsize` over hardcoded pixel geometry — it must scale with window size and HiDPI.

## Threading — the mainloop must NEVER block
- Any work >~100ms (network, file, subprocess) runs in a `threading.Thread`; keep the mainloop free.
- Never touch a widget from a worker thread. Marshal back with `widget.after(0, callback)` — `after()` is the only thread-safe bridge.
- Long task: disable the trigger widget, show an indeterminate `CTkProgressBar` (`.start()`), re-enable in the `after()` callback.

## Images (Pillow)
- Always `ctk.CTkImage(light_image=..., dark_image=..., size=(w, h))` — never `tk.PhotoImage`/`ImageTk` (blurry on HiDPI, no dark-mode swap).
- Keep a reference (`self.img = ...`) or it gets garbage-collected and disappears.

## Appearance / theming
- Set once at startup, before creating widgets: `ctk.set_appearance_mode("system")`, `ctk.set_default_color_theme("blue")` or a path to a custom theme `.json`.
- Prefer theme colors over per-widget `fg_color` hardcoding. Brand palette → one theme `.json`, not scattered overrides.
- Offer a `light`/`dark`/`system` toggle via `set_appearance_mode(...)`.

## Testing
- Test the pure logic modules, not widget rendering. Thin views → little to test.

## Docs
- Fetch current CustomTkinter API (widget args, `CTkImage`, theming) via **Context7 MCP** — it differs from plain `tkinter` and shifts across versions.
