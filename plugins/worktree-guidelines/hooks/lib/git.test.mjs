// Self-check for git.mjs. Run: node hooks/lib/git.test.mjs
import assert from 'node:assert';
import { isWorktreeAdd } from './git.mjs';

// Real worktree-creating commands — including forms that once slipped past the
// guard: leading env-assignment / env / sudo / command / nohup, a $(…) or (…)
// wrapper, and a quoted `-c`/`-C` option value.
for (const cmd of [
  'git worktree add /tmp/x -b feat',
  'cd /repo && git worktree add ../wt',
  '/usr/bin/git worktree add ../wt',
  'git  worktree   add ../wt',
  'env git worktree add ../wt',
  'sudo git worktree add ../wt',
  'VAR=x git worktree add ../wt',
  'command git worktree add ../wt',
  'nohup git worktree add ../wt',
  '(git worktree add ../wt)',
  '$(git worktree add ../wt)',
  "git -c user.name='x' worktree add ../wt",
  "git -C 'my repo' worktree add ../wt",
]) assert.equal(isWorktreeAdd(cmd), true, `should block: ${cmd}`);

// Not worktree creation — and a `worktree add` living inside a quoted commit
// message or after `echo` must not false-positive.
for (const cmd of [
  'git worktree list',
  'git worktree remove /tmp/x',
  'git commit -m "add worktree add docs"',
  'echo git worktree add',
]) assert.equal(isWorktreeAdd(cmd), false, `should allow: ${cmd}`);

console.log('ok');
