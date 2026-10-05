// Shared helpers for worktree-guidelines hooks: stdin parsing, PreToolUse
// decision emitters, and detection of manual `git worktree add`.

// Read + parse the hook's JSON payload from stdin ({} if empty/invalid).
export async function readInput() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// PreToolUse decision emitters. Emitting no decision leaves the normal
// permission flow untouched — so allow() just exits without a verdict; deny()
// blocks the tool with a reason Claude sees.
export function deny(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  }));
  process.exit(0);
}

export function allow() {
  process.exit(0);
}

// True if a shell command creates a worktree. Splits on shell separators so a
// chained `foo && git worktree add …` is still caught; strips quoted spans so a
// `worktree add` inside a commit message doesn't false-positive; and tolerates
// leading env-assignments / env|sudo|command|nohup and a $(…) or (…) wrapper so
// those don't slip past. `worktree list/remove` and paths that merely contain
// the words are not matched.
// ponytail: heuristic over a Bash string, not a security boundary — a determined
// caller can still evade it; upgrade to shell tokenization only if that matters.
export function isWorktreeAdd(command) {
  const stripQuotes = (s) => s.replace(/'[^']*'/g, '').replace(/"[^"]*"/g, '');
  const re = /^\s*(?:(?:\w+=\S*|env|sudo|command|nohup)\s+)*\$?\(?\s*(?:\S*\/)?git\b[\s\S]*?\bworktree\s+add\b/;
  return command
    .split(/\|\||&&|[|;&\n]/)
    .some((seg) => re.test(stripQuotes(seg)));
}

// Inject guidance into the conversation without deciding the tool call.
export function addContext(text, event = 'PreToolUse') {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: event, additionalContext: text },
  }));
  process.exit(0);
}
