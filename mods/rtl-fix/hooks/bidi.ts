// Simplified Unicode bidi: reorders each line into visual order, for
// terminals that draw characters strictly left to right.

type Kind = 'R' | 'L' | 'N'

const RTL = /[֐-ࣿיִ-﷿ﹰ-﻿]/
const LTR = /[A-Za-z0-9À-ɏЀ-ӿ]/
const MIRROR: Record<string, string> = {
  '(': ')', ')': '(', '[': ']', ']': '[', '{': '}', '}': '{', '<': '>', '>': '<',
}
const MD_PREFIX = /^(\s*(?:[-*+]|\d+[.)]|>+|#{1,6})\s+)/

export const hasRtl = (s: string): boolean => RTL.test(s)

const kindOf = (ch: string): Kind => (RTL.test(ch) ? 'R' : LTR.test(ch) ? 'L' : 'N')

function reorderLine(line: string): string {
  const chars = Array.from(line)
  const kinds = chars.map(kindOf)
  const first = kinds.find(k => k !== 'N')
  const base: Kind = first === 'R' ? 'R' : 'L'
  const baseLevel = base === 'R' ? 1 : 0

  // Neutrals take the direction of their neighbours when both agree, else the base.
  const resolved: Kind[] = kinds.slice()
  for (let i = 0; i < chars.length; i++) {
    if (kinds[i] !== 'N') continue
    let j = i
    while (j < chars.length && kinds[j] === 'N') j++
    const before = i > 0 ? kinds[i - 1] : base
    const after = j < chars.length ? kinds[j] : base
    const dir = before === after ? before : base
    for (let k = i; k < j; k++) resolved[k] = dir
    i = j - 1
  }

  const levels = resolved.map((k, i) => {
    if (k === 'R') return 1
    // Latin letters and digits sit one level above an RTL base.
    return base === 'R' ? 2 : 0
  })
  const out = chars.map((ch, i) => (levels[i] % 2 === 1 && MIRROR[ch] ? MIRROR[ch] : ch))

  const max = Math.max(...levels)
  const minOdd = Math.min(...levels.filter(l => l % 2 === 1), max + 1)
  const order = chars.map((_, i) => i)
  for (let lvl = max; lvl >= minOdd && lvl >= 1; lvl--) {
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

export function toVisual(text: string, width = 0): string {
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
