import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Limit } from '../types'

const THRESHOLD = 90

const limits = atom({ plugin: 'usage-alert', key: 'limits' } as const, [] as Limit[])

const LABELS: Record<string, string> = {
  five_hour: '5-hour',
  seven_day: 'weekly',
}

const label = (kind: string) => LABELS[kind] ?? kind

export const register: Register = on => {
  // Windows already alerted on; cleared when a window drops below the threshold.
  const alerted = new Set<string>()

  on('session.measure', async ($, e, next) => {
    const current: Limit[] = e.rateLimits.map(r => ({
      kind: r.kind,
      percentUsed: r.percentUsed,
    }))
    await update($, limits, () => current)

    const hot = current.filter(r => r.percentUsed >= THRESHOLD)

    for (const r of current) {
      if (r.percentUsed < THRESHOLD) {
        alerted.delete(r.kind)
      }
    }

    for (const r of hot) {
      if (!alerted.has(r.kind)) {
        alerted.add(r.kind)
        $.ui.toast(`⚠️ ${label(r.kind)} limit at ${Math.round(r.percentUsed)}%`)
      }
    }

    const summary = current
      .map(r => `${label(r.kind)} ${Math.round(r.percentUsed)}%`)
      .join(' · ')
    const alert = hot.length > 0 ? '⚠️ ' : ''
    $.ui.status(summary === '' ? undefined : `${alert}${summary}`)

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const hot = (await read($, limits)).filter(r => r.percentUsed >= THRESHOLD)

    if (hot.length === 0) {
      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box>
        <Text color="red" bold>
          ⚠️ {hot.map(r => `${label(r.kind)} ${Math.round(r.percentUsed)}%`).join(' · ')}
        </Text>
      </Box>
    )
  })
}
