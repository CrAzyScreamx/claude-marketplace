import { test, expect } from 'claude-code/testing'

import { toVisual, withMarks } from './bidi'

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
