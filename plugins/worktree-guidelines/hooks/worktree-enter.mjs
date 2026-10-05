// Entry steering: inject guidance when Claude enters a worktree.
import { readInput, addContext } from './lib/git.mjs';

await readInput();

addContext([
  'You have entered a git worktree for a feature. Do NOT write the feature code',
  'yourself — run the `worktree-manager` skill and act as the manager. It owns the',
  'whole pipeline: interview the user via `feature-interviewer`, split tasks, run',
  'parallel `worktree-coder`s, then `worktree-type-checker` and `worktree-reviewer`,',
  'looping until the review passes. You delegate every line of code and handle',
  'everything user-facing, including building a missing `<lang>-guidelines` skill via',
  '`guideline-builder` when a coder reports `No guideline for <stack>.`',
].join('\n'));
