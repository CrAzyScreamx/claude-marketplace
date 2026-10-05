// Block `git worktree add` in Bash — it bypasses the EnterWorktree hook that
// injects the manager pipeline, so the agent ends up coding inline.
import { readInput, deny, allow, isWorktreeAdd } from './lib/git.mjs';

const { tool_input } = await readInput();

if (!isWorktreeAdd(tool_input?.command ?? '')) allow();

deny([
  'Do not create worktrees with `git worktree add` — it skips the worktree',
  'workflow entirely. Use the `EnterWorktree` tool instead; it sets up the',
  'worktree and hands the feature to the `worktree-manager` agent.',
  '',
  'EnterWorktree already creates the worktree under `.claude/worktrees/` in the',
  'current repository — that is the only supported location. If the user asked',
  'for a worktree "in .claude", this is what they want; just call EnterWorktree.',
  'If they named some other path, use EnterWorktree anyway and tell them where',
  'it went.',
].join('\n'));
