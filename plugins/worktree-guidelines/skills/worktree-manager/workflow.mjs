export const meta = {
  name: 'worktree-feature',
  description: 'Code, type-check, and review a worktree feature until it passes',
  phases: [
    { title: 'Code', detail: 'one coder per task, all concurrent', model: 'sonnet' },
    { title: 'Type check', detail: 'one report-only checker per language', model: 'haiku' },
    { title: 'Fix types', detail: 'coders fix the reported errors, one per file', model: 'sonnet' },
    { title: 'Review', detail: 'one reviewer over the whole feature', model: 'opus' },
  ],
}

const { feature, tasks, languages } = args

const CODER = 'worktree-guidelines:worktree-coder'
const CHECKER = 'worktree-guidelines:worktree-type-checker'
const REVIEWER = 'worktree-guidelines:worktree-reviewer'

const REPORT = {
  type: 'object',
  required: ['built', 'guideline'],
  properties: {
    built: { type: 'string', description: 'what you built or changed' },
    guideline: { type: 'string', description: 'the <lang>-guidelines skill you followed' },
    blocked: {
      type: ['string', 'null'],
      description: 'the stack name if no guideline exists for it and you wrote nothing; otherwise null',
    },
    open: { type: 'string', description: 'anything still open' },
  },
}

// `clean` and `command` are required but never read: the script keys off
// errors.length, so a checker claiming clean:true while listing errors can't
// mask them. They stay required to force an explicit claim into the transcript.
const CHECK = {
  type: 'object',
  required: ['clean', 'command', 'errors'],
  properties: {
    clean: { type: 'boolean', description: 'true only if the command reported no errors' },
    command: { type: 'string', description: 'the exact type-check command you ran' },
    errors: {
      type: 'array',
      items: {
        type: 'object',
        required: ['file', 'message'],
        properties: {
          file: { type: 'string' },
          line: { type: 'number' },
          message: { type: 'string' },
        },
      },
    },
  },
}

const REVIEW = {
  type: 'object',
  required: ['verdict', 'findings'],
  properties: {
    verdict: { enum: ['PASS', 'CHANGES_REQUESTED'] },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['file', 'problem', 'rule'],
        properties: {
          file: { type: 'string' },
          line: { type: 'number' },
          problem: { type: 'string', description: 'what is wrong, concretely' },
          rule: { type: 'string', description: 'the guideline rule it violates' },
        },
      },
    },
  },
}

let work = tasks
let findings = []
let round = 0
// Every report from every round. Round 2+ spawns narrow fix-coders, so their
// reports alone would shrink the reviewer's picture of what the feature is.
const built = []

while (round < 3) {
  round++

  // --- Code: one coder per task, all concurrent ---
  phase('Code')
  const reports = (
    await parallel(
      work.map(t => () =>
        agent(codePrompt(feature, t, findings), {
          label: `code:${t.id}`,
          phase: 'Code',
          agentType: CODER,
          schema: REPORT,
        }),
      ),
    )
  ).filter(Boolean)

  // Barrier is intentional: type check must not start until every coder is done —
  // checking a half-written tree reports errors that fix themselves a minute later.
  const blocked = reports.filter(r => r.blocked)
  if (blocked.length) return { status: 'blocked', stacks: [...new Set(blocked.map(r => r.blocked))] }
  built.push(...reports)

  // --- Type check -> fix -> re-check, up to 3 attempts ---
  for (let attempt = 1; attempt <= 3; attempt++) {
    phase('Type check')
    const checks = (
      await parallel(
        languages.map(l => async () => {
          const c = await agent(checkPrompt(l), {
            label: `typecheck:${l.name}`,
            phase: 'Type check',
            agentType: CHECKER,
            schema: CHECK,
          })
          // Tag each error with the guideline of the checker that found it — the
          // file alone can't say (a coder may have added files no task lists).
          return { guideline: l.guideline, errors: c && Array.isArray(c.errors) ? c.errors : [] }
        }),
      )
    ).filter(Boolean)

    const errors = checks.flatMap(c => c.errors.map(e => ({ ...e, guideline: c.guideline })))
    if (!errors.length) break
    if (attempt === 3) {
      log(`type errors unresolved after 3 attempts: ${errors.length}`)
      break
    }

    phase('Fix types')
    await parallel(
      byFile(errors).map(g => () =>
        agent(fixTypesPrompt(g), {
          label: `fix:${g.file}`,
          phase: 'Fix types',
          agentType: CODER,
          schema: REPORT,
        }),
      ),
    )
  }

  // --- Review: exactly one, over the whole feature ---
  phase('Review')
  const review = await agent(reviewPrompt(feature, built), {
    label: 'review',
    phase: 'Review',
    agentType: REVIEWER,
    schema: REVIEW,
  })

  if (review && review.verdict === 'PASS') return { status: 'pass', rounds: round, reports: built }

  findings = review && Array.isArray(review.findings) ? review.findings : []
  if (!findings.length) return { status: 'pass', rounds: round, reports: built }

  // Last round: nothing re-codes after this, so don't regroup work no coder runs.
  if (round === 3) break

  work = regroup(tasks, findings)
  log(`round ${round}: ${findings.length} findings across ${work.length} file(s), re-coding`)
}

return { status: 'changes-requested', rounds: 3, findings }

// ---- prompts ---------------------------------------------------------------

function codePrompt(feature, task, all) {
  const mine = all.filter(f => task.files.includes(f.file))
  const fixes = mine.length
    ? `\nThe reviewer rejected this work. Fix exactly these findings — nothing else:\n${mine
        .map(f => `- ${f.file}${f.line ? `:${f.line}` : ''} — ${f.problem} (rule: ${f.rule})`)
        .join('\n')}\n`
    : ''
  return `Feature: ${feature}
Task ${task.id} (${task.stack}): ${task.scope}
Your files — touch no others: ${task.files.join(', ')}
Guideline: load the \`${task.guideline}\` skill and code to it.
Interview answers for your specialty:
${task.answers || '(none)'}
${fixes}
If \`${task.guideline}\` does not exist, write nothing and report blocked: "${task.stack}".`
}

function checkPrompt(lang) {
  return `Load the \`${lang.guideline}\` skill and run its ${lang.name} type-check command verbatim.
Report every error as {file, line, message}. Fix nothing, edit nothing.`
}

function fixTypesPrompt(group) {
  return `Fix the type errors in ${group.file} — that file only, nothing else.
Guideline: load the \`${group.guideline}\` skill and follow its typing practices. Real fixes only.
Interview answers for your specialty:
${group.answers || '(none)'}
Errors:
${group.errors.map(e => `- ${e.line ? `line ${e.line}: ` : ''}${e.message}`).join('\n')}`
}

function reviewPrompt(feature, reports) {
  return `Review the whole feature: ${feature}
What the coders report building:
${reports.map(r => `- ${r.built} (guideline: ${r.guideline})${r.open ? ` — open: ${r.open}` : ''}`).join('\n')}
Load each named \`<lang>-guidelines\` skill and review the worktree's changes against it.
Return PASS, or CHANGES_REQUESTED with one finding per real violation.`
}

// ---- grouping --------------------------------------------------------------

// One group per file, so no two fix-coders share a file. The guideline comes
// from the checker that found the error, not from the file's owning task.
function byFile(errors) {
  const groups = new Map()
  for (const e of errors) {
    if (!groups.has(e.file)) {
      groups.set(e.file, {
        file: e.file,
        guideline: e.guideline,
        answers: ownerOf(e.file, e.guideline).answers,
        errors: [],
      })
    }
    groups.get(e.file).errors.push(e)
  }
  return [...groups.values()]
}

// Same disjointness rule for review findings: one coder per file, carrying the
// originating task's stack, guideline, and interview answers.
function regroup(tasks, findings) {
  const groups = new Map()
  for (const f of findings) {
    if (groups.has(f.file)) continue
    const owner = ownerOf(f.file)
    groups.set(f.file, {
      id: `${owner.id}:${f.file}`,
      stack: owner.stack,
      guideline: owner.guideline,
      scope: `fix the reviewer findings in ${f.file}`,
      files: [f.file],
      answers: owner.answers,
    })
  }
  return [...groups.values()]
}

// A file no task claims — one a coder added itself — falls back to a task in the
// same stack when we know it, and to the first task only as a last resort.
function ownerOf(file, guideline) {
  return (
    tasks.find(t => t.files.includes(file)) ||
    (guideline && tasks.find(t => t.guideline === guideline)) ||
    tasks[0]
  )
}
