import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

const MINUTE = 60_000

const engine = (on: On, sessionId: string, answer?: string) => {
  const seen = { toasts: [] as string[], forks: 0, logs: [] as string[], asked: 0, ran: [] as string[] }
  on('tool.call', { tool: 'AskUserQuestion' }, (_$, e) => {
    seen.asked += 1
    const question = e.questions[0]?.question ?? ''
    return { result: { questions: e.questions, answers: { [question]: answer ?? '' } } } as never
  })
  on('command.run', (_$, e) => {
    seen.ran.push(e.command)
    return { text: `ran ${e.command}` }
  })
  on('session.root', () => ({ value: '/proj' }))
  on('session.id', () => ({ value: sessionId }))
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('turn.complete', (_$, e) => ({ text: e.answer }))
  on('prompt.submit', (_$, e) => ({ text: e.text }))
  on('process.run', () => ({ value: { exitCode: 0, stdout: '', stderr: '' } }) as never)
  on('ui.toast', (_$, e) => {
    seen.toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.status', () => ({ value: undefined }))
  on('ui.log', (_$, e) => {
    seen.logs.push(e.text)
    return { value: undefined }
  })
  on('model.fork', () => {
    seen.forks += 1
    return { value: { isAnswered: true, text: '## Done\n- wired the parser', usage: {} } } as never
  })
  return seen
}

const start = ($: Engine) => $.session.start({ cwd: '/proj', surface: 'terminal', isInteractive: true })

const run = ($: Engine, command: string, args = '') =>
  $.command.run({ command, args, origin: { kind: 'user' }, presentation: {} } as never)

const handoff = ($: Engine) => run($, 'handoff')

const finishTurn =($: Engine) =>
  $.turn.complete({ answer: 'ok', durationMs: 1, isAborted: false, turnId: 't1' } as never)

test('warns at 45 idle minutes and saves a handoff at 50', async ($, on) => {
  const clock = mock.clock(on)
  mock.store(on)
  const seen = engine(on, 'S1')

  await start($)
  await finishTurn($)

  await clock.advance(44 * MINUTE)
  expect(seen.toasts).toHaveLength(0)

  await clock.advance(1 * MINUTE)
  expect(seen.toasts).toHaveLength(1)
  expect(seen.toasts[0]).toContain('handoff summary')
  expect(seen.forks).toBe(0)

  await clock.advance(5 * MINUTE)
  expect(seen.forks).toBe(1)
  expect(seen.logs.some(line => line.includes('summary saved'))).toBe(true)
  expect(await handoff($)).toMatchObject({ text: expect.stringContaining('wired the parser') })
})

test('a reply during the grace period cancels the save', async ($, on) => {
  const clock = mock.clock(on)
  mock.store(on)
  const seen = engine(on, 'S1')

  await start($)
  await finishTurn($)
  await clock.advance(46 * MINUTE)
  await $.prompt.submit({ text: 'back' } as never)
  await clock.advance(10 * MINUTE)

  expect(seen.forks).toBe(0)
  expect(await handoff($)).toMatchObject({ text: expect.stringContaining('No handoff') })
})

test('the next session offers the handoff and /handoff loads it', async ($, on) => {
  const saved = { sessionId: 'S1', root: '/proj', writtenAt: 0, summary: '## Done\n- wired the parser' }
  mock.clock(on)
  mock.store(on, { 'handoff:/proj': saved })
  const seen = engine(on, 'S2')

  await start($)
  expect(seen.toasts[0]).toContain('previous session left a handoff summary')

  expect(await handoff($)).toMatchObject({ context: [expect.stringContaining('wired the parser')] })
  expect(await handoff($)).toMatchObject({ text: expect.stringContaining('No handoff') })
})

test('the idle timings come from the settings', { options: { idleWarnMinutes: 10, graceMinutes: 2 } }, async ($, on) => {
  const clock = mock.clock(on)
  mock.store(on)
  const seen = engine(on, 'S1')

  await start($)
  await finishTurn($)

  await clock.advance(10 * MINUTE)
  expect(seen.toasts[0]).toContain('Idle 10 min')
  expect(seen.forks).toBe(0)

  await clock.advance(2 * MINUTE)
  expect(seen.forks).toBe(1)
})

test('warn-only never writes a summary', { options: { onIdle: 'warn-only' } }, async ($, on) => {
  const clock = mock.clock(on)
  mock.store(on)
  const seen = engine(on, 'S1')

  await start($)
  await finishTurn($)
  await clock.advance(60 * MINUTE)

  expect(seen.toasts).toHaveLength(1)
  expect(seen.forks).toBe(0)
})

test('/exit with unsaved work asks, and Save writes the summary before quitting', async ($, on) => {
  mock.clock(on)
  mock.store(on)
  const seen = engine(on, 'S1', 'Save summary')

  await start($)
  await finishTurn($)
  await run($, 'exit')

  expect(seen.asked).toBe(1)
  expect(seen.forks).toBe(1)
  expect(seen.ran).toContain('exit')
})

test('/clear: Cancel keeps the session and writes nothing', async ($, on) => {
  mock.clock(on)
  mock.store(on)
  const seen = engine(on, 'S1', 'Cancel')

  await start($)
  await finishTurn($)

  expect(await run($, 'clear')).toMatchObject({ text: '/clear cancelled.' })
  expect(seen.ran).not.toContain('clear')
  expect(seen.forks).toBe(0)
})

test('/clear with nothing new since the last summary does not ask', async ($, on) => {
  mock.clock(on)
  mock.store(on)
  const seen = engine(on, 'S1', 'Save summary')

  await start($)
  await run($, 'clear')

  expect(seen.asked).toBe(0)
  expect(seen.ran).toContain('clear')
})

// /clear fires no session.start, so the offer has to come from the clear itself.
test('/clear: Save writes the summary and the cleared session offers it', async ($, on) => {
  mock.clock(on)
  mock.store(on)
  const seen = engine(on, 'S1', 'Save summary')

  await start($)
  await finishTurn($)
  await run($, 'clear')

  expect(seen.forks).toBe(1)
  expect(seen.ran).toContain('clear')
  expect(seen.toasts.some(text => text.includes('previous session left a handoff summary'))).toBe(true)
  expect(await handoff($)).toMatchObject({ context: [expect.stringContaining('wired the parser')] })
})

test('/clear starts the idle clock over, with nothing unsaved', async ($, on) => {
  const clock = mock.clock(on)
  mock.store(on)
  const seen = engine(on, 'S1', 'Skip')

  await start($)
  await finishTurn($)
  await run($, 'clear')
  await clock.advance(60 * MINUTE)

  expect(seen.toasts).toHaveLength(0)
  expect(seen.forks).toBe(0)
  await run($, 'clear')
  expect(seen.asked).toBe(1)
})

test('onExit always saves without asking',{ options: { onExit: 'always' } }, async ($, on) => {
  mock.clock(on)
  mock.store(on)
  const seen = engine(on, 'S1')

  await start($)
  await finishTurn($)
  await run($, 'clear')

  expect(seen.asked).toBe(0)
  expect(seen.forks).toBe(1)
  expect(seen.ran).toContain('clear')
})

// The test kit does not answer a plugin's $.session.append yet, so Load is
// covered by /handoff above; this checks the band draws and Discard forgets.
test('the band offers the handoff on every surface and Discard forgets it', async ($, on) => {
  const saved = { sessionId: 'S1', root: '/proj', writtenAt: 0, summary: '## Done\n- wired the parser' }
  mock.clock(on)
  mock.store(on, { 'handoff:/proj': saved })
  engine(on, 'S2')

  await start($)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({
      plugin: 'idle-handoff',
      surface,
      component: 'AbovePrompt',
      props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 100 } as never,
    })
    expect(await ui.find({ type: 'Button', key: 'load' })).toBeDefined()
    await ui.unmount()
  }

  const ui = await $.ui.mount({
    plugin: 'idle-handoff',
    surface: 'terminal',
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 100 } as never,
  })
  await ui.press({ key: 'discard' })
  expect(await handoff($)).toMatchObject({ text: expect.stringContaining('No handoff') })
})
