// Entry steering: inject guidance when Claude enters a worktree.
import { readInput, addContext } from './lib/git.mjs';

await readInput();

addContext([
  'You have entered a git worktree for a feature. Do NOT write the feature code',
  'yourself — run the `worktree-manager` skill and act as the manager. It interviews',
  'the user via `feature-interviewer`, confirms a `<lang>-guidelines` skill exists for',
  'each stack (building one via `guideline-builder` if not), splits the work into',
  'tasks, then launches the Workflow that runs the coder / type-check / review loop.',
  'You delegate every line of code and handle everything user-facing, including',
  'reporting the Workflow result back to the user.',
].join('\n'));
