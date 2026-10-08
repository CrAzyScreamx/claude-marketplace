import { test, expect } from 'claude-code/testing'

import { preCompensate, reorderLine, toVisual, toVisualPlain, withMarks } from './bidi'

test('leaves LTR text alone', () => {
  expect(toVisual('hello world\n- item')).toBe('hello world\n- item')
})

test('reverses a Hebrew line into visual order', () => {
  expect(toVisual('שלום')).toBe('םולש')
})

test('keeps embedded Latin words and digits in reading order', () => {
  expect(toVisual('שלום abc 123')).toBe('abc 123 םולש')
})

test('keeps markdown list prefix and skips code fences', () => {
  expect(toVisual('- שלום')).toBe('- םולש')
  expect(toVisual('```\nשלום\n```')).toBe('```\nשלום\n```')
})

test('marks mode wraps RTL lines in isolates', () => {
  expect(withMarks('שלום')).toBe('⁧שלום⁩')
})

test('wraps long RTL lines before reordering so the start stays on top', () => {
  const out = toVisual('אבג דהו זחט יכל מנס עפצ קרש', 12).split('\n')
  expect(out.length).toBeGreaterThan(1)
  expect(out[0]).toBe('טחז והד גבא')
})

test('right-aligns an RTL line with no-break spaces', () => {
  const out = toVisual('שלום', 12)
  expect(out).toBe(' '.repeat(7) + 'םולש')
})

test('moves an RTL list marker to the right side', () => {
  expect(toVisual('- שלום', 12)).toBe(' '.repeat(5) + 'םולש •')
  expect(toVisual('1. שלום', 12)).toBe(' '.repeat(4) + 'םולש .1')
})

test('does not count markdown markers as columns', () => {
  expect(toVisual('**שלום** `ab`', 14)).toBe('\u00A0'.repeat(6) + '`ab` **םולש**')
})

test('leaves an English-first line on the left', () => {
  expect(toVisual('see שלום', 20)).toBe('see םולש')
})

test('reorders plain command output line by line', () => {
  expect(toVisualPlain('-rw-r--r-- 5 אוק׳ 17:19 x\nabc')).toBe('-rw-r--r-- 5 17:19 ׳קוא x\nabc')
})

test('keeps a version number whole inside an RTL line', () => {
  expect(toVisual('גרסה 0.1.0 (בדיקה)')).toBe('(הקידב) 0.1.0 הסרג')
})

test('pre-compensated text reorders back to the visual line under an LTR base', () => {
  for (const line of ['גרסה 0.1.0 (בדיקה) עובדת ב-2026.', 'הפקודה `git status` מראה את המצב.', '1. צעד ראשון.']) {
    const visual = toVisual(line, 60, true)
    const shown = preCompensate(visual).split('\n').map(r => reorderLine(r, 'L')).join('\n')
    expect(shown).toBe(visual)
  }
})
