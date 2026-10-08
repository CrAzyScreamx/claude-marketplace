// Simplified Unicode bidi: reorders each line into visual order, for
// terminals that draw characters strictly left to right.

// E: a European digit, which joins RTL runs the way Unicode bidi rule N1 says.
type Kind = 'R' | 'L' | 'E' | 'N'

const RTL = /[֐-ࣿיִ-﷿ﹰ-﻿]/
const LTR = /[A-Za-z0-9À-ɏЀ-ӿ]/
const MIRROR: Record<string, string> = {
  '(': ')', ')': '(', '[': ']', ']': '[', '{': '}', '}': '{', '<': '>', '>': '<',
}
const MD_PREFIX = /^(\s*(?:[-*+]|\d+[.)]|>+|#{1,6})\s+)/

export const hasRtl = (s: string): boolean => RTL.test(s)

const kindOf = (ch: string): Kind =>
  RTL.test(ch) ? 'R' : /[0-9]/.test(ch) ? 'E' : LTR.test(ch) ? 'L' : 'N'

export function reorderLine(line: string, forcedBase?: 'L' | 'R'): string {
  const chars = Array.from(line)
  const kinds = chars.map(kindOf)
  // A single separator between digits is part of the number (rule W4).
  for (let i = 1; i < chars.length - 1; i++) {
    if (kinds[i] === 'N' && /[.,:/]/.test(chars[i]) && kinds[i - 1] === 'E' && kinds[i + 1] === 'E') kinds[i] = 'E'
  }
  const first = kinds.find(k => k === 'R' || k === 'L')
  const base: 'L' | 'R' = forcedBase ?? (first === 'R' ? 'R' : 'L')
  // A digit after left-to-right text, or at the start of an LTR line, is LTR (rule W7).
  let lastStrong: 'L' | 'R' = base
  for (let i = 0; i < kinds.length; i++) {
    if (kinds[i] === 'R' || kinds[i] === 'L') lastStrong = kinds[i] as 'L' | 'R'
    else if (kinds[i] === 'E' && lastStrong === 'L') kinds[i] = 'L'
  }

  // Neutrals take the direction of their neighbours when both agree, else the base.
  const strong = (k: Kind): Kind => (k === 'E' ? 'R' : k)
  const resolved: Kind[] = kinds.slice()
  for (let i = 0; i < chars.length; i++) {
    if (kinds[i] !== 'N') continue
    let j = i
    while (j < chars.length && kinds[j] === 'N') j++
    const before = i > 0 ? strong(kinds[i - 1]) : base
    const after = j < chars.length ? strong(kinds[j]) : base
    const dir = before === after ? before : base
    for (let k = i; k < j; k++) resolved[k] = dir
    i = j - 1
  }

  const levels = resolved.map(k => {
    if (k === 'R') return 1
    if (k === 'E') return 2
    return base === 'R' ? 2 : 0
  })
  const out = chars.map((ch, i) => (levels[i] % 2 === 1 && MIRROR[ch] ? MIRROR[ch] : ch))

  const max = Math.max(...levels)
  const order = chars.map((_, i) => i)
  for (let lvl = max; lvl >= 1; lvl--) {
    for (let i = 0; i < order.length; i++) {
      if (levels[order[i]] < lvl) continue
      let j = i
      while (j < order.length && levels[order[j]] >= lvl) j++
      const seg = order.slice(i, j).reverse()
      order.splice(i, seg.length, ...seg)
      i = j - 1
    }
  }
  return order.map(i => out[i]).join('')
}

// For terminals that run their own bidi with a left-to-right base on every
// line (macOS Terminal): the input whose reordering gives the wanted visual line.
export const preCompensate = (visual: string): string =>
  visual
    .split('\n')
    .map(line => (hasRtl(line) ? reorderLine(line, 'L') : line))
    .join('\n')

// Greedy word wrap, so each row can be reordered on its own.
function wrap(text: string, width: number): string[] {
  const rows: string[] = []
  let row = ''
  for (const word of text.split(' ')) {
    let w = word
    while (Array.from(w).length > width) {
      if (row) { rows.push(row); row = '' }
      const chars = Array.from(w)
      rows.push(chars.slice(0, width).join(''))
      w = chars.slice(width).join('')
    }
    if (!row) row = w
    else if (Array.from(row).length + 1 + Array.from(w).length <= width) row += ' ' + w
    else { rows.push(row); row = w }
  }
  rows.push(row)
  return rows
}

const NBSP = '\u00A0'
const LIST = /^\s*([-*+]|\d+[.)])\s+/

const baseOf = (s: string): Kind => {
  for (const ch of s) {
    const k = kindOf(ch)
    if (k !== 'N') return k
  }
  return 'L'
}

// Columns the markdown renderer draws: emphasis and code markers take none.
const drawnWidth = (s: string): number => Array.from(s.replace(/\*\*|__|`/g, '')).length

// An RTL paragraph ends at the right edge, with its list marker on that side.
// NBSP pads, as leading spaces would turn the line into an indented code block.
// numbersLeft keeps a numbered marker on the left: under a terminal's own
// left-to-right bidi, digits cannot be drawn to the right of RTL text.
function alignRight(line: string, width: number, numbersLeft = false): string {
  const m = LIST.exec(line)
  const body = m ? line.slice(m[0].length) : line
  const marker = !m ? '' : /\d/.test(m[1]) ? m[1].slice(-1) + m[1].slice(0, -1) : '•'
  const gap = marker ? 1 + Array.from(marker).length : 0
  const room = width - 1 - gap
  const rows = room >= 10 && Array.from(body).length > room ? wrap(body, room) : [body]
  const isLeft = numbersLeft && m !== null && /\d/.test(m[1])
  return rows
    .map((r, i) => {
      const mark = !marker ? '' : i > 0 ? NBSP.repeat(gap) : isLeft ? m![1] + ' ' : ' ' + marker
      const v = isLeft ? mark + reorderLine(r) : reorderLine(r) + mark
      return NBSP.repeat(Math.max(0, width - 1 - drawnWidth(v))) + v
    })
    .join('\n')
}

// Plain text such as command output: reorder each line, no markdown handling.
export const toVisualPlain = (text: string): string =>
  text
    .split('\n')
    .map(line => (hasRtl(line) ? reorderLine(line) : line))
    .join('\n')

export function toVisual(text: string, width = 0, numbersLeft = false): string {
  let inFence = false
  return text
    .split('\n')
    .map(line => {
      if (/^\s*(```|~~~)/.test(line)) {
        inFence = !inFence
        return line
      }
      if (inFence || !hasRtl(line)) return line
      const listPrefix = LIST.exec(line)?.[0] ?? ''
      const isHeadingOrQuote = !listPrefix && MD_PREFIX.test(line)
      if (width > 0 && !isHeadingOrQuote && baseOf(line.slice(listPrefix.length)) === 'R') {
        return alignRight(line, width, numbersLeft)
      }
      const prefix = MD_PREFIX.exec(line)?.[0] ?? ''
      const body = line.slice(prefix.length)
      const room = width - prefix.length
      if (width <= 0 || room < 10 || Array.from(body).length <= room) {
        return prefix + reorderLine(body)
      }
      const indent = ' '.repeat(Math.min(prefix.length, 3))
      return wrap(body, room)
        .map((r, i) => (i === 0 ? prefix : indent) + reorderLine(r))
        .join('\n')
    })
    .join('\n')
}

const RLI = '⁧'
const PDI = '⁩'

export function withMarks(text: string): string {
  let inFence = false
  return text
    .split('\n')
    .map(line => {
      if (/^\s*(```|~~~)/.test(line)) {
        inFence = !inFence
        return line
      }
      if (inFence || !hasRtl(line)) return line
      const prefix = MD_PREFIX.exec(line)?.[0] ?? ''
      return prefix + RLI + line.slice(prefix.length) + PDI
    })
    .join('\n')
}
