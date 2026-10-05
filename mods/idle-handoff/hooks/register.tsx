import { atom, read, update } from 'claude-code'
import type { EngineInterface, PluginOptions, Register } from 'claude-code'

import type { Handoff, Stage } from '../types'

const MINUTE = 60_000
const TICK = 30_000
// The prompt cache lives an hour; a summary written later is billed afresh.
const CACHE_MINUTES = 60

const idleSince = atom({ plugin: 'idle-handoff', key: 'idleSince' } as const, null as number | null)
const stage = atom({ plugin: 'idle-handoff', key: 'stage' } as const, 'none' as Stage)
const offer = atom({ plugin: 'idle-handoff', key: 'offer' } as const, null as Handoff | null)
const isDirty = atom({ plugin: 'idle-handoff', key: 'isDirty' } as const, false)

type Settings = {
  warnMs: number
  graceMs: number
  shouldSummarizeOnIdle: boolean
  onExit: 'ask' | 'always' | 'never'
  onStart: 'ask' | 'load' | 'off'
  summaryWords: number
  shouldNotifyDesktop: boolean
}

const positive = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback

const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback

const settingsOf = (options: PluginOptions): Settings => ({
  warnMs: positive(options.idleWarnMinutes, 45) * MINUTE,
  graceMs: positive(options.graceMinutes, 5) * MINUTE,
  shouldSummarizeOnIdle: options.onIdle !== 'warn-only',
  onExit: oneOf(options.onExit, ['ask', 'always', 'never'], 'ask'),
  onStart: oneOf(options.onStart, ['ask', 'load', 'off'], 'ask'),
  summaryWords: Math.round(positive(options.summaryWords, 300)),
  shouldNotifyDesktop: options.desktopNotify !== false,
})

const summaryPrompt = (words: number) => `Write a handoff summary of this session so a fresh session in this project can pick up exactly where this one stopped.

Markdown, under ${words} words, no preamble, these sections (skip one that would be empty):
## Goal
## Done
## Current state
## Next steps
## Decisions & gotchas

Name files, commands, branches and task IDs (plan.md / tasks.md) concretely.`

const storeKey = (root: string) => `handoff:${root}`

const pad = (n: number) => String(n).padStart(2, '0')

const timeOf = (ms: number) => {
  const d = new Date(ms)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const dateTimeOf = (ms: number) => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${timeOf(ms)}`
}

const minutesOf = (ms: number) => Math.round(ms / MINUTE)

const contextOf = (h: Handoff) =>
  `Handoff summary saved by a previous session in this project on ${dateTimeOf(h.writtenAt)}. ` +
  `Use it as context to continue the work:\n\n${h.summary}`

const notifyDesktop = async ($: EngineInterface, text: string) => {
  // Best effort: notify-send exists on most Linux desktops; elsewhere this fails quietly.
  await $.process.run(['notify-send', '-a', 'Claude Code', 'Claude Code', text]).catch(() => undefined)
}

// Writes the summary and stores it for the next session; says whether it did.
const writeSummary = async ($: EngineInterface, s: Settings) => {
  $.ui.status('📝 writing handoff summary…')
  const reply = await $.model.fork({ prompt: summaryPrompt(s.summaryWords) })
  $.ui.status(undefined)

  if (!reply.isAnswered) {
    $.ui.log(`idle-handoff: no summary written (${reply.reason})`)
    return false
  }

  const root = await $.session.root()
  const handoff: Handoff = {
    sessionId: await $.session.id(),
    root,
    writtenAt: await $.clock.now(),
    summary: reply.text.trim(),
  }
  await $.store.set(storeKey(root), handoff)
  await update($, isDirty, () => false)
  $.ui.log(`idle-handoff: summary saved; the next session in ${root} will offer to load it.`)
  return true
}

const warn = async ($: EngineInterface, s: Settings, since: number) => {
  await update($, stage, () => 'warned')
  const idle = `Idle ${minutesOf(s.warnMs)} min: the prompt cache expires soon.`
  const text = s.shouldSummarizeOnIdle
    ? `${idle} Reply by ${timeOf(since + s.warnMs + s.graceMs)} or a handoff summary is saved for the next session.`
    : `${idle} Reply to keep it warm.`
  // A toast stays a minute at most; the band and status line carry the warning after that.
  $.ui.toast(text, { timeoutMs: Math.min(s.graceMs, MINUTE) })
  if (s.shouldSummarizeOnIdle) {
    $.ui.status(`⏳ handoff summary at ${timeOf(since + s.warnMs + s.graceMs)}`)
  }
  if (s.shouldNotifyDesktop) {
    await notifyDesktop($, text)
  }
}

const saveOnIdle = async ($: EngineInterface, s: Settings) => {
  await update($, stage, () => 'saving')
  const isSaved = await writeSummary($, s)
  // The person may have come back while the summary was being written; their
  // prompt already reset the stage, and the summary still stands.
  if ((await read($, stage)) === 'saving') {
    await update($, stage, () => 'saved')
  }
  return isSaved
}

const tick = async ($: EngineInterface, s: Settings) => {
  const since = await read($, idleSince)
  if (since === null) {
    return
  }

  const idle = (await $.clock.now()) - since
  const current = await read($, stage)

  if (current === 'none' && idle >= s.warnMs) {
    await warn($, s, since)
  } else if (current === 'warned' && idle >= s.warnMs + s.graceMs) {
    if (s.shouldSummarizeOnIdle && (await read($, isDirty))) {
      await saveOnIdle($, s)
    } else {
      await update($, stage, () => 'saved')
      $.ui.status(undefined)
    }
  }
}

const forget = async ($: EngineInterface, h: Handoff) => {
  const key = storeKey(h.root)
  const stored = (await $.store.get(key)) as Handoff | undefined
  if (stored?.writtenAt === h.writtenAt) {
    await $.store.delete(key)
  }
  await update($, offer, () => null)
}

const load = async ($: EngineInterface, h: Handoff) => {
  await $.session.append({ message: { type: 'user', content: [{ type: 'text', text: contextOf(h) }] } })
  await forget($, h)
  $.ui.log(`idle-handoff: loaded the summary from ${dateTimeOf(h.writtenAt)} into context.\n\n${h.summary}`)
}

const offerSaved = async ($: EngineInterface, s: Settings, h: Handoff) => {
  if (s.onStart === 'load') {
    await load($, h)
  } else if (s.onStart === 'ask') {
    await update($, offer, () => h)
    $.ui.toast(`A previous session left a handoff summary (${dateTimeOf(h.writtenAt)}).`, { timeoutMs: 10_000 })
  }
}

// /clear goes on under a new session id without firing session.start, so the
// fresh conversation is set up, and the saved summary offered, here.
const startOver = async ($: EngineInterface, s: Settings) => {
  await update($, idleSince, () => null)
  await update($, stage, () => 'none')
  await update($, isDirty, () => false)
  $.ui.status(undefined)

  const saved = (await $.store.get(storeKey(await $.session.root()))) as Handoff | undefined
  if (saved !== undefined) {
    await offerSaved($, s, saved)
  }
}

const SAVE = 'Save summary'
const SKIP = 'Skip'
const CANCEL = 'Cancel'

// Saves a summary before /exit or /clear as the settings say; false when cancelled.
const saveBeforeLeaving = async ($: EngineInterface, s: Settings, command: string) => {
  if (s.onExit === 'never' || !(await read($, isDirty))) {
    return true
  }

  if (s.onExit === 'ask') {
    const leaving = command === 'clear' ? 'clearing' : 'quitting'
    const choice = await $.ui
      .ask(`Save a handoff summary for the next session before ${leaving}?`, {
        header: 'Handoff',
        options: [SAVE, SKIP, CANCEL],
      })
      .catch(() => CANCEL)

    if (choice === SKIP) {
      return true
    }
    if (choice !== SAVE) {
      return false
    }
  }

  await writeSummary($, s)
  return true
}

export const register: Register = (on, options) => {
  const s = settingsOf(options)

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    if (!e.isInteractive) {
      return result
    }

    await $.command.register({
      name: 'handoff',
      description: 'Load (default), save or discard the handoff summary for this project',
      argumentHint: '[load|save|discard]',
    })

    if (minutesOf(s.warnMs + s.graceMs) >= CACHE_MINUTES) {
      $.ui.log(
        `idle-handoff: warn + grace is ${minutesOf(s.warnMs + s.graceMs)} min, past the ${CACHE_MINUTES}-min prompt cache; ` +
          'the idle summary will be billed without the cache.',
      )
    }

    const saved = (await $.store.get(storeKey(await $.session.root()))) as Handoff | undefined
    if (saved !== undefined && saved.sessionId !== (await $.session.id())) {
      await offerSaved($, s, saved)
    }

    $.clock.every(TICK, () => {
      void tick($, s)
    })

    return result
  })

  on('prompt.submit', async ($, e, next) => {
    await update($, idleSince, () => null)
    if ((await read($, stage)) !== 'none') {
      await update($, stage, () => 'none')
      $.ui.status(undefined)
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      const now = await $.clock.now()
      await update($, idleSince, () => now)
      await update($, isDirty, () => true)
    }
    return next(e)
  })

  on('command.run', { command: ['exit', 'clear'] }, async ($, e, next) => {
    if (!(await saveBeforeLeaving($, s, e.command))) {
      return { text: `/${e.command} cancelled.` }
    }

    const result = await next(e)
    if (e.command === 'clear') {
      await startOver($, s)
    }
    return result
  })

  on('command.run', { command: 'handoff' }, async ($, e) => {
    const verb = e.args.trim()

    if (verb === 'save') {
      return (await writeSummary($, s))
        ? { text: 'Saved a handoff summary for the next session.' }
        : { text: 'No handoff summary was written.' }
    }

    const root = await $.session.root()
    const saved = (await $.store.get(storeKey(root))) as Handoff | undefined
    if (saved === undefined) {
      return { text: 'No handoff summary is saved for this project.' }
    }

    await forget($, saved)
    if (verb === 'discard') {
      return { text: `Discarded the handoff summary from ${dateTimeOf(saved.writtenAt)}.` }
    }
    return {
      text: `Loaded the handoff summary from ${dateTimeOf(saved.writtenAt)}:\n\n${saved.summary}`,
      context: [contextOf(saved)],
    }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) {
      return next(e)
    }

    const { Box, Button, Text } = $.ui.resolve(e)
    const pending = await read($, offer)

    if (pending !== null) {
      return (
        <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
          <Text color="cyan">
            📋 A previous session left a handoff summary ({dateTimeOf(pending.writtenAt)}). Load it into context?
          </Text>
          <Button key="load" label="Load" hotkey="l" variant="primary" onPress={() => load($, pending)} />
          <Button key="discard" label="Discard" hotkey="d" onPress={() => forget($, pending)} />
          <Button key="later" label="Later" role="dismiss" onPress={() => update($, offer, () => null)} />
        </Box>
      )
    }

    const since = await read($, idleSince)
    if ((await read($, stage)) === 'warned' && since !== null) {
      const idle = `⏳ Idle ${minutesOf(s.warnMs)} min: the prompt cache expires soon. Send anything to keep this session`
      return (
        <Box>
          <Text color="yellow">
            {s.shouldSummarizeOnIdle
              ? `${idle}; otherwise a handoff summary is saved at ${timeOf(since + s.warnMs + s.graceMs)}.`
              : `${idle}.`}
          </Text>
        </Box>
      )
    }

    return next(e)
  })
}
