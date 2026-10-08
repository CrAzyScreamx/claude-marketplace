import type { Engine, Register } from 'claude-code'

import { hasRtl, preCompensate, toVisual, toVisualPlain, withMarks } from './bidi'

type Mode = 'visual' | 'marks' | 'terminal'

// Terminals that run their own bidi with a left-to-right base on every line.
const SELF_BIDI_TERMINALS = new Set(['Apple_Terminal'])

async function detectMode($: Engine): Promise<Mode> {
  return SELF_BIDI_TERMINALS.has((await $.env.get('TERM_PROGRAM')) ?? '') ? 'terminal' : 'visual'
}

export const register: Register = (on, options) => {
  const chosen = options?.mode
  // `auto` asks the environment once, on the first draw that needs a mode.
  let mode: Mode | undefined =
    chosen === 'visual' || chosen === 'marks' || chosen === 'terminal' ? chosen : undefined

  // Message rows sit under a two-cell gutter (bullet or prompt marker).
  const fix = (m: Mode, text: string, viewport?: { columns: number }) => {
    if (m === 'marks') return withMarks(text)
    const width = viewport ? viewport.columns - 4 : 0
    return m === 'terminal' ? preCompensate(toVisual(text, width, true)) : toVisual(text, width)
  }
  const fixPlain = (m: Mode, text: string) =>
    m === 'terminal' ? preCompensate(toVisualPlain(text)) : toVisualPlain(text)

  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    if (!hasRtl(e.props.text)) return next(e)
    const text = fix((mode ??= await detectMode($)), e.props.text, e.viewport)
    return next({ ...e, props: { ...e.props, text } })
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    if (!hasRtl(e.props.text)) return next(e)
    // A summary row ends in a faint " · summary" mark that takes columns too.
    const viewport = e.viewport && e.props.isSummary ? { columns: e.viewport.columns - 10 } : e.viewport
    const text = fix((mode ??= await detectMode($)), e.props.text, viewport)
    return next({ ...e, props: { ...e.props, text } })
  })

  // A standalone row draws Bash output in ToolResult; an inline row, in ToolUse.
  const fixOutput = (m: Mode, tool: string, output: unknown): unknown => {
    const out = output as { stdout?: unknown; stderr?: unknown } | undefined
    if (m === 'marks' || tool !== 'Bash' || !out || typeof out.stdout !== 'string') return output
    const stderr = typeof out.stderr === 'string' ? out.stderr : ''
    if (!hasRtl(out.stdout) && !hasRtl(stderr)) return output
    return { ...out, stdout: fixPlain(m, out.stdout), ...(stderr && { stderr: fixPlain(m, stderr) }) }
  }

  on('ui.render', { component: 'ToolResult' }, async ($, e, next) => {
    const output = fixOutput((mode ??= await detectMode($)), e.props.tool, e.props.output)
    return output === e.props.output ? next(e) : next({ ...e, props: { ...e.props, output } })
  })

  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    const output = fixOutput((mode ??= await detectMode($)), e.props.tool, e.props.output)
    return output === e.props.output ? next(e) : next({ ...e, props: { ...e.props, output } })
  })
}
