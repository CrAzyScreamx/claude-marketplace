import type { Register } from 'claude-code'

import { hasRtl, toVisual, withMarks } from './bidi'

// Message rows sit under a two-cell gutter (bullet or prompt marker).
const fixFor = (isMarks: boolean) => (text: string, viewport?: { columns: number }) =>
  isMarks ? withMarks(text) : toVisual(text, viewport ? viewport.columns - 4 : 0)

export const register: Register = (on, options) => {
  const fix = fixFor(options?.mode === 'marks')

  on('ui.render', { component: 'UserMessage' }, ($, e, next) => {
    if (!hasRtl(e.props.text)) return next(e)
    return next({ ...e, props: { ...e.props, text: fix(e.props.text, e.viewport) } })
  })

  on('ui.render', { component: 'AssistantMessage' }, ($, e, next) => {
    if (!hasRtl(e.props.text)) return next(e)
    return next({ ...e, props: { ...e.props, text: fix(e.props.text, e.viewport) } })
  })
}
